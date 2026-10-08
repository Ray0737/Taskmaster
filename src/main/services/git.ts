import { execFile, spawn, type ChildProcess } from 'child_process'
import { promises as fsp } from 'fs'
import { join, resolve } from 'path'
import { shell } from 'electron'
import type { GitIdentity, GitStatus, BranchList } from '@shared/types'
import { handle, emit } from '../ipc'
import { state } from '../state'
import { inside } from './fs'

const lastLines = (s: string): string => s.trim().split(/\r?\n/).filter(Boolean).slice(-3).join('\n')

export interface RunOpts { input?: string; timeout?: number }

// Never pass credentials or tokens through here: errors are shown to the user and logged.
export function git(cwd: string, args: string[], o: RunOpts = {}): Promise<string> {
  return new Promise((res, rej) => {
    const p = execFile(
      'git', args,
      {
        cwd, maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout: o.timeout ?? 120_000, encoding: 'utf8',
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' }
      },
      (err, stdout, stderr) => {
        if (err) rej(new Error(lastLines(`${stderr}\n${stdout}`) || err.message))
        else res(stdout)
      }
    )
    p.stdin?.end(o.input ?? '')
  })
}

export function parseStatus(out: string): GitStatus {
  const recs = out.split('\0')
  const head = recs.shift() ?? ''
  const st: GitStatus = { branch: null, upstream: null, ahead: 0, behind: 0, files: [] }
  if (!head.startsWith('## HEAD (no branch)')) {
    const m = /^## (?:No commits yet on |Initial commit on )?(\S+?)(?:\.\.\.(\S+))?(?: \[(.+)\])?$/.exec(head)
    if (m) {
      st.branch = m[1]
      st.upstream = m[2] ?? null
      st.ahead = Number(/ahead (\d+)/.exec(m[3] ?? '')?.[1] ?? 0)
      st.behind = Number(/behind (\d+)/.exec(m[3] ?? '')?.[1] ?? 0)
    }
  }
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i]
    if (r.length < 4) continue
    const index = r[0], work = r[1]
    st.files.push({ path: r.slice(3), index, work })
    if (index === 'R' || index === 'C' || work === 'R' || work === 'C') i++ // next record = original path
  }
  return st
}

export async function gitVersion(): Promise<string | null> {
  try { return /(\d+\.\d+[\w.]*)/.exec(await git(process.cwd(), ['--version']))?.[1] ?? null } catch { return null }
}

const cfg = async (key: string): Promise<string> => {
  try { return (await git(process.cwd(), ['config', '--global', key])).trim() } catch { return '' }
}
export const getIdentity = async (): Promise<GitIdentity> => ({ name: await cfg('user.name'), email: await cfg('user.email') })

export async function setIdentity(i: GitIdentity): Promise<void> {
  if (!i.name.trim() || !i.email.includes('@')) throw new Error('Name and a valid email are required')
  await git(process.cwd(), ['config', '--global', 'user.name', i.name.trim()])
  await git(process.cwd(), ['config', '--global', 'user.email', i.email.trim()])
}

const samePath = (a: string, b: string): boolean => {
  const n = (s: string) => (process.platform === 'win32' ? resolve(s).toLowerCase() : resolve(s))
  return n(a) === n(b)
}

export async function isRepoRoot(dir: string): Promise<boolean> {
  try { return samePath((await git(dir, ['rev-parse', '--show-toplevel'])).trim(), dir) } catch { return false }
}

export const initRepo = async (dir: string): Promise<void> => { await git(dir, ['init', '-b', 'main']) }

export const status = async (root: string): Promise<GitStatus> =>
  parseStatus(await git(root, ['status', '--porcelain=v1', '-z', '-b', '--untracked-files=all']))

export const stage = async (root: string, paths: string[]): Promise<void> => {
  if (paths.length) await git(root, ['add', '-A', '--', ...paths])
}
export const unstage = async (root: string, paths: string[]): Promise<void> => {
  if (paths.length) await git(root, ['reset', '-q', '--', ...paths])
}
export const discardTracked = async (root: string, paths: string[]): Promise<void> => {
  if (paths.length) await git(root, ['restore', '--', ...paths])
}

export async function commit(root: string, message: string): Promise<void> {
  if (!message.trim()) throw new Error('Commit message is required')
  await git(root, ['commit', '-F', '-'], { input: message })
}

export async function branches(root: string): Promise<BranchList> {
  const all = (await git(root, ['branch', '--format=%(refname:short)'])).split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  const current = (await git(root, ['branch', '--show-current'])).trim() || null
  return { current, all }
}

export async function switchBranch(root: string, name: string, create: boolean): Promise<void> {
  await git(root, ['check-ref-format', '--branch', name])
  await git(root, create ? ['switch', '-c', name] : ['switch', name])
}

export async function showHead(root: string, relPath: string): Promise<string | null> {
  try { return await git(root, ['show', `HEAD:${relPath}`]) } catch { return null }
}

export async function remoteUrl(root: string): Promise<string | null> {
  try { return (await git(root, ['remote', 'get-url', 'origin'])).trim() || null } catch { return null }
}

export async function syncRepo(root: string): Promise<void> {
  const st = await status(root)
  if (!st.upstream) { await git(root, ['push', '-u', 'origin', 'HEAD'], { timeout: 300_000 }); return }
  try {
    await git(root, ['pull', '--rebase', '--autostash'], { timeout: 300_000 })
  } catch (e) {
    if (/conflict/i.test((e as Error).message)) throw new Error('Conflicts — resolve in terminal')
    throw e
  }
  await git(root, ['push'], { timeout: 300_000 })
}

let cloneProc: ChildProcess | null = null
export const cancelClone = (): void => { cloneProc?.kill() }

export function cloneRepo(url: string, parent: string, name: string, onProgress: (percent: number, text: string) => void): Promise<string> {
  const target = join(parent, name)
  return new Promise((res, rej) => {
    let tail = ''
    const p = spawn('git', ['clone', '--progress', '--', url, target], {
      windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' }
    })
    cloneProc = p
    p.stderr.on('data', (d: Buffer) => {
      for (const line of d.toString().split(/[\r\n]+/).filter(Boolean)) {
        tail = line
        const m = /(\d+)%/.exec(line)
        if (m) onProgress(Number(m[1]), line)
      }
    })
    p.on('error', (e) => { cloneProc = null; rej(e) })
    p.on('close', (code) => {
      cloneProc = null
      if (code === 0) res(target)
      else rej(new Error(tail || `git clone failed (${code})`))
    })
  })
}

export function registerGit(): void {
  const root = (): string => {
    if (!state.root) throw new Error('No project open')
    return state.root
  }
  const rels = (ps: string[]): string[] => ps.map((p) => { inside(root(), p); return p })
  handle('git.version', gitVersion)
  handle('git.identity', getIdentity)
  handle('git.setIdentity', setIdentity)
  handle('git.isRepo', async (dir) => isRepoRoot(dir))
  handle('git.init', async (dir) => initRepo(dir))
  handle('git.status', async () => status(root()))
  handle('git.stage', async (p) => stage(root(), rels(p)))
  handle('git.unstage', async (p) => unstage(root(), rels(p)))
  handle('git.discard', async (tracked, untracked) => {
    await discardTracked(root(), rels(tracked))
    for (const p of rels(untracked)) await shell.trashItem(inside(root(), p))
  })
  handle('git.commit', async (m) => commit(root(), m))
  handle('git.branches', async () => branches(root()))
  handle('git.switch', async (n, c) => switchBranch(root(), n, c))
  handle('git.sync', async () => syncRepo(root()))
  handle('git.show', async (p) => { rels([p]); return showHead(root(), p) })
  handle('git.remoteUrl', async () => remoteUrl(root()))
  handle('git.clone', async (url, parent, name) => {
    await fsp.access(parent)
    return cloneRepo(url, parent, name, (percent, text) => emit('git.progress', { percent, text }))
  })
  handle('git.cloneCancel', async () => cancelClone())
}
