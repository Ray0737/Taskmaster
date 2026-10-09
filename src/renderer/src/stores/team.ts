import { create } from 'zustand'
import {
  buildPromptContext, isLogin, newTaskId, slugLogin, PRESET_ROLE_IDS,
  type Role, type Task, type Team, type TeamData, type SyncInfo
} from '@shared/team'
import { buildSystemPrompt, extractNote } from '@shared/prompt'
import { diffTeam, type TeamEvent } from '@shared/notify'
import { call, on, errMsg } from '../ipc'
import { useApp } from './app'
import { useGit } from './git'
import { useAgent } from './agent'
import { toast } from './ui'
import { tr } from '../i18n'
import { agentHooks } from '../views/registry'
import { runCommand } from '../commands'

export const roleName = (t: (k: string) => string, r: Role | undefined): string =>
  !r ? t('role.custom') : PRESET_ROLE_IDS.includes(r.id) ? t(`role.${r.id}`) : r.label

interface TeamState {
  status: 'unknown' | 'off' | 'enabled'
  offline: boolean
  data: TeamData | null
  sync: SyncInfo
  me: string | null
  activeTaskId: string | null // the task the agent panel is working on
  pendingNote: { taskId: string; text: string } | null
  busy: boolean
  attach(): Promise<void>
  enable(): Promise<void>
  refresh(quiet?: boolean): Promise<void> // quiet: our own change, so no notifications
  reset(): void
  saveTask(t: Task): Promise<void>
  deleteTask(id: string): Promise<void>
  createTask(title: string): Promise<Task>
  saveTeam(t: Team): Promise<void>
  addNote(taskId: string, text: string): Promise<void>
  setActiveTask(id: string | null): void
  saveNote(taskId: string, text: string): Promise<void>
  dismissNote(): void
}

const OFF: SyncInfo = { state: 'off', at: null, error: null }

// Called with what a teammate changed (the notifications store listens).
export const teamListeners: ((events: TeamEvent[]) => void)[] = []

// Tells the agent panel what the agent should know (role, task, scope, team) — see buildSystemPrompt.
function pushAgentContext(): void {
  const { data, me, activeTaskId } = useTeam.getState()
  const task = data?.tasks.find((t) => t.id === activeTaskId)
  if (!data || !me) { useAgent.getState().setContext({ taskId: null, system: '', scope: [] }); return }
  useAgent.getState().setContext({
    taskId: task ? task.id : null,
    system: buildSystemPrompt(buildPromptContext(data, me, task ? task.id : null)),
    scope: task?.files ?? []
  })
}

export const useTeam = create<TeamState>((set, get) => ({
  status: 'unknown', offline: false, data: null, sync: OFF, me: null, activeTaskId: null, pendingNote: null, busy: false,

  attach: async () => {
    const root = useApp.getState().root
    if (!root) { get().reset(); return }
    set({ status: 'unknown', busy: true })
    try {
      if (!useGit.getState().accountChecked) await useGit.getState().loadAccount()
      const acct = useGit.getState().account
      const ident = await call('git.identity')
      const me = acct && isLogin(acct.login) ? acct.login : slugLogin(ident.name || 'me')
      set({ me })
      const r = await call('team.attach', me)
      if (useApp.getState().root !== root) return // project changed meanwhile
      set({ status: r.state === 'enabled' ? 'enabled' : 'off', offline: r.offline })
      if (r.state !== 'enabled') return
      await get().refresh()
      const d = get().data
      const mine = d?.tasks.filter((t) => t.assignee === me && t.status !== 'done').length ?? 0
      if (d && mine > 0) {
        const role = d.team.roles.find((x) => x.id === d.team.members.find((m) => m.login === me)?.role)
        toast(tr('team.joined', { login: me, role: roleName(tr, role), count: mine }), 'info', { label: tr('team.joined.open'), run: () => runCommand('view.tasks') })
      }
    } catch (e) {
      set({ status: 'off' })
      toast(tr('team.attachFailed', { error: errMsg(e) }), 'error')
    } finally { set({ busy: false }) }
  },

  enable: async () => {
    set({ busy: true })
    try {
      const r = await call('team.enable')
      set({ status: 'enabled' })
      await get().refresh()
      if (!r.pushed) toast(tr('team.enable.pushFailed', { error: r.error ?? '' }), 'error')
    } catch (e) { toast(errMsg(e), 'error') } finally { set({ busy: false }) }
  },

  refresh: async (quiet = false) => {
    if (get().status !== 'enabled') return
    try {
      const prev = get().data
      const next = await call('team.read')
      set({ data: next })
      pushAgentContext()
      const me = get().me
      if (!quiet && prev && next && me) { const ev = diffTeam(prev, next, me); if (ev.length) for (const l of teamListeners) l(ev) }
    } catch { /* keep the last data */ }
  },

  reset: () => {
    set({ status: 'unknown', offline: false, data: null, sync: OFF, me: null, activeTaskId: null, pendingNote: null, busy: false })
    pushAgentContext()
  },

  saveTask: async (t) => { await call('team.saveTask', t); await get().refresh(true) },
  deleteTask: async (id) => {
    await call('team.deleteTask', id)
    if (get().activeTaskId === id) get().setActiveTask(null)
    await get().refresh(true)
  },

  createTask: async (title) => {
    const me = get().me!
    const d = get().data
    const now = new Date().toISOString()
    const task: Task = {
      id: newTaskId(), title: title.slice(0, 200), brief: '', assignee: null, status: 'todo', files: [], branch: null,
      role: d?.team.members.find((m) => m.login === me)?.role ?? 'custom', createdBy: me, createdAt: now, updatedAt: now
    }
    await get().saveTask(task)
    return task
  },

  saveTeam: async (t) => { await call('team.saveTeam', t); await get().refresh(true) },
  addNote: async (taskId, text) => { await call('team.addNote', taskId, text); await get().refresh(true) },
  setActiveTask: (id) => { set({ activeTaskId: id, pendingNote: null }); pushAgentContext() },

  // Saves the note and moves a task that is `doing` to `review` (spec §8).
  saveNote: async (taskId, text) => {
    await get().addNote(taskId, text)
    const task = get().data?.tasks.find((t) => t.id === taskId)
    if (task?.status === 'doing') {
      await get().saveTask({ ...task, status: 'review' })
      await call('team.setPresence', { taskId: null, branch: null, status: 'idle' })
    }
    set({ pendingNote: null })
    toast(tr('note.saved'))
  },
  dismissNote: () => set({ pendingNote: null })
}))

on('team.changed', () => void useTeam.getState().refresh())
on('team.sync', (sync) => useTeam.setState({ sync }))

useApp.subscribe((s, p) => {
  if (s.root === p.root) return
  if (s.root) void useTeam.getState().attach()
  else { void call('team.detach').catch(() => {}); useTeam.getState().reset() }
})

// When the agent finishes a turn on a task: keep its <tm-note>, or offer to write one.
agentHooks.onResult.push((r) => {
  const st = useTeam.getState()
  if (!r.ok || !r.taskId || r.taskId !== st.activeTaskId) return
  const note = extractNote(r.text)
  if (note) void st.saveNote(r.taskId, note).catch((e) => toast(errMsg(e), 'error'))
  else useTeam.setState({ pendingNote: { taskId: r.taskId, text: r.text.slice(0, 600) } })
})
