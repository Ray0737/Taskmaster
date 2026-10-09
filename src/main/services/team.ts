import { app } from 'electron'
import { isLogin, type Task, type Team, type SyncInfo, type SyncState } from '@shared/team'
import { handle, emit } from '../ipc'
import { state } from '../state'
import { log } from '../log'
import { getSettings } from './settings'
import { join } from 'path'
import { readAll, writeTeam, writeTask, deleteTask, writePresence, addNote, listSkills, writeSkill, deleteSkill, pluginDir, listImages, addImage, readImage, removeImage, attachDir } from './teamfs'
import type { Skill } from '@shared/skills'
import { attach, enable, flush, pull, reset, worktreeDir, SyncConflict, type Ctx } from './teamsync'

const BACKOFF = [15, 30, 60, 120, 300] // seconds, after failures
const FLUSH_DELAY = 3000
const BEAT_EVERY = 60_000

let ctx: Ctx | null = null // set by attach (even when Taskmaster is not enabled yet)
let enabled = false
let info: SyncInfo = { state: 'off', at: null, error: null }
let summary = 'update'
let backoff = 0
let flushTimer: ReturnType<typeof setTimeout> | undefined
let pollTimer: ReturnType<typeof setTimeout> | undefined
let beatTimer: ReturnType<typeof setInterval> | undefined
let me: { taskId: string | null; branch: string | null; status: 'idle' | 'working' } = { taskId: null, branch: null, status: 'idle' }
let queue: Promise<unknown> = Promise.resolve()

// All git work and all file writes in the worktree run one at a time (a rebase must not race a write).
// Folder the agent host passes to Claude Code as --plugin-dir, only when the user opted in (skills are teammates' instructions).
export async function teamPluginDir(): Promise<string | null> {
  if (!ctx || !enabled || !getSettings().teamSkills) return null
  return (await listSkills(ctx.wt)).length ? pluginDir(ctx.wt) : null
}

// Absolute paths of a task's screenshots, for the agent host (empty when Taskmaster is off).
export async function teamTaskImages(taskId: string | null): Promise<string[]> {
  if (!ctx || !enabled || !taskId) return []
  return (await listImages(ctx.wt, taskId)).map((f) => join(attachDir(ctx!.wt, taskId), f))
}

const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const p = queue.then(fn)
  queue = p.catch(() => undefined)
  return p
}

function setInfo(s: SyncState, error: string | null = null): void {
  info = { state: s, at: new Date().toISOString(), error }
  emit('team.sync', info)
}
const paused = (): boolean => getSettings().syncPaused

function failed(e: unknown): void {
  const msg = (e as Error).message
  log('team sync', msg)
  if (e instanceof SyncConflict) { setInfo('conflict', msg); return }
  backoff = Math.min(backoff + 1, BACKOFF.length - 1)
  setInfo('offline', msg)
}
function succeeded(): void { backoff = 0; setInfo('idle') }

const runFlush = (): Promise<void> => serial(async () => {
  if (!ctx || !enabled || paused()) return
  setInfo('syncing')
  try { await flush(ctx, summary); summary = 'update'; succeeded() } catch (e) { failed(e) }
})

const runPoll = (): Promise<void> => serial(async () => {
  if (!ctx || !enabled || paused()) return
  try {
    const r = await pull(ctx)
    if (r === 'offline') { failed(new Error('Cannot reach the remote')); return }
    if (r === 'changed') emit('team.changed', { at: new Date().toISOString() })
    succeeded()
  } catch (e) { failed(e) }
})

function markDirty(s: string): void {
  summary = s
  clearTimeout(flushTimer)
  flushTimer = setTimeout(() => void runFlush(), FLUSH_DELAY)
}

function schedulePoll(): void {
  clearTimeout(pollTimer)
  const secs = info.state === 'offline' ? BACKOFF[backoff] : getSettings().fetchInterval
  pollTimer = setTimeout(async () => { await runPoll(); if (ctx && enabled) schedulePoll() }, secs * 1000)
}

const beat = (): Promise<void> => serial(async () => {
  if (!ctx || !enabled) return
  await writePresence(ctx.wt, { login: ctx.login, ...me, at: new Date().toISOString() })
  markDirty('presence')
})

function start(): void {
  enabled = true
  schedulePoll()
  clearInterval(beatTimer)
  beatTimer = setInterval(() => void beat(), BEAT_EVERY)
  void beat()
  void runPoll() // fetch what teammates did while we were away, and push anything left over from last time
  markDirty('startup')
}

export function stopTeam(): void {
  clearTimeout(flushTimer); clearTimeout(pollTimer); clearInterval(beatTimer)
  ctx = null; enabled = false; me = { taskId: null, branch: null, status: 'idle' }
  setInfo('off')
}

const need = (): Ctx => {
  if (!ctx || !enabled) throw new Error('Taskmaster is not enabled for this project')
  return ctx
}

export function registerTeam(): void {
  handle('team.attach', async (login) => {
    if (!state.root) throw new Error('No project open')
    if (!isLogin(login)) throw new Error('Invalid login')
    stopTeam()
    const c: Ctx = { root: state.root, wt: worktreeDir(app.getPath('userData'), state.root), login }
    ctx = c
    const r = await serial(() => attach(c))
    if (r.state === 'disabled') { setInfo(r.offline ? 'offline' : 'off'); return r }
    await serial(async () => { // join the team automatically if this is the first time on this machine
      const all = await readAll(c.wt)
      if (all && !all.team.members.some((m) => m.login === login)) {
        await writeTeam(c.wt, { ...all.team, members: [...all.team.members, { login, role: 'custom', joinedAt: new Date().toISOString() }] })
      }
    })
    start()
    return r
  })

  handle('team.enable', async () => {
    if (!ctx) throw new Error('No project open')
    const c = ctx
    const r = await serial(() => enable(c))
    start()
    if (!r.pushed) setInfo('offline', r.error)
    return r
  })

  handle('team.read', async () => (ctx && enabled ? readAll(ctx.wt) : null))
  handle('team.saveTeam', (t: Team) => serial(async () => { await writeTeam(need().wt, t); markDirty('team') }))
  handle('team.saveTask', (t: Task) => serial(async () => {
    await writeTask(need().wt, { ...t, updatedAt: new Date().toISOString() })
    markDirty(`task ${t.title.slice(0, 40)}`)
  }))
  handle('team.deleteTask', (id: string) => serial(async () => { await deleteTask(need().wt, id); markDirty('delete task') }))
  handle('team.images', async (id: string) => (ctx && enabled ? listImages(ctx.wt, id) : []))
  handle('team.imagePath', async (id: string, file: string) => {
    const c = need()
    if (!(await listImages(c.wt, id)).includes(file)) throw new Error('Invalid image')
    return join(attachDir(c.wt, id), file)
  })
  handle('team.imageData', async (id: string, file: string) => readImage(need().wt, id, file))
  handle('team.addImage', (id: string, b64: string, ext: string) => serial(async () => { const f = await addImage(need().wt, id, b64, ext); markDirty('screenshot'); return f }))
  handle('team.removeImage', (id: string, file: string) => serial(async () => { await removeImage(need().wt, id, file); markDirty('remove screenshot') }))
  handle('team.skills', async () => (ctx && enabled ? listSkills(ctx.wt) : []))
  handle('team.saveSkill', (s: Skill) => serial(async () => { await writeSkill(need().wt, s); markDirty(`skill ${s.name}`) }))
  handle('team.deleteSkill', (name: string) => serial(async () => { await deleteSkill(need().wt, name); markDirty('delete skill') }))
  handle('team.addNote', (taskId, text) => serial(async () => { const c = need(); await addNote(c.wt, taskId, c.login, text); markDirty('note') }))
  handle('team.setPresence', async (p) => { me = p; await beat() })
  handle('team.syncNow', async () => { await runFlush(); await runPoll() })
  handle('team.resetToRemote', () => serial(async () => {
    try { await reset(need()); succeeded(); emit('team.changed', { at: new Date().toISOString() }) } catch (e) { failed(e); throw e }
  }))
  handle('team.detach', async () => stopTeam())
}
