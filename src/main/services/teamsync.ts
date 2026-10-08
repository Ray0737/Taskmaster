import { promises as fsp } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { git } from './git'
import { DEFAULT_ROLES } from '@shared/team'
import { writeTeam } from './teamfs'
import { exists } from '../util'

export const BRANCH = 'taskmaster/context'
const REMOTE_REF = `refs/remotes/origin/${BRANCH}`

export interface Ctx { root: string; wt: string; login: string }

export const worktreeDir = (userData: string, root: string): string =>
  join(userData, 'worktrees', createHash('sha1').update(root).digest('hex').slice(0, 12))

export class SyncConflict extends Error {}
export const isNetworkError = (m: string): boolean =>
  /could not resolve host|unable to access|could not read from remote|does not appear to be a git repository|repository not found|authentication failed|timed out|connection (refused|reset|timed)|network is unreachable|no such remote|failed to connect/i.test(m)
// git 2.53 prints only hint lines in the error (lastLines keeps 3), so match the hint text too.
export const isRejected = (m: string): boolean => /\[rejected\]|non-fast-forward|fetch first|fast-forwards|integrate the remote changes/i.test(m)

const refExists = async (cwd: string, ref: string): Promise<boolean> => {
  try { await git(cwd, ['rev-parse', '--verify', '--quiet', ref]); return true } catch { return false }
}
const count = async (cwd: string, range: string): Promise<number> => {
  try { return Number((await git(cwd, ['rev-list', '--count', range])).trim()) || 0 } catch { return 0 }
}
// commits not yet on the remote branch (all commits if the remote branch does not exist yet)
const aheadCount = async (wt: string): Promise<number> =>
  (await refExists(wt, REMOTE_REF)) ? count(wt, `${REMOTE_REF}..HEAD`) : count(wt, 'HEAD')

export async function fetchContext(root: string): Promise<'ok' | 'missing' | 'offline'> {
  try {
    await git(root, ['fetch', '--quiet', 'origin', `+refs/heads/${BRANCH}:${REMOTE_REF}`], { timeout: 30_000 })
    return 'ok'
  } catch (e) {
    return /couldn't find remote ref/i.test((e as Error).message) ? 'missing' : 'offline'
  }
}

async function validWorktree(wt: string): Promise<boolean> {
  if (!(await exists(wt))) return false
  try { return (await git(wt, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim() === BRANCH } catch { return false }
}

// Makes sure the context worktree exists if the branch exists locally or on the remote. Never touches the user's checkout.
export async function attach(ctx: Ctx): Promise<{ state: 'enabled' | 'disabled'; offline: boolean }> {
  if (await validWorktree(ctx.wt)) return { state: 'enabled', offline: false }
  await git(ctx.root, ['worktree', 'prune'])
  const f = await fetchContext(ctx.root)
  const local = await refExists(ctx.root, `refs/heads/${BRANCH}`)
  if (f !== 'ok' && !local) return { state: 'disabled', offline: f === 'offline' }
  await fsp.rm(ctx.wt, { recursive: true, force: true })
  await fsp.mkdir(join(ctx.wt, '..'), { recursive: true })
  if (local) await git(ctx.root, ['worktree', 'add', ctx.wt, BRANCH])
  else await git(ctx.root, ['worktree', 'add', '--track', '-b', BRANCH, ctx.wt, `origin/${BRANCH}`])
  return { state: 'enabled', offline: f === 'offline' }
}

// Creates the orphan branch with team.json and pushes it. The enabling user becomes the lead.
export async function enable(ctx: Ctx): Promise<{ pushed: boolean; error: string | null }> {
  try { await git(ctx.root, ['remote', 'get-url', 'origin']) } catch {
    throw new Error('This project has no remote yet — push it to GitHub first (Source Control → Sync), then enable Taskmaster.')
  }
  if (!(await refExists(ctx.root, 'HEAD'))) throw new Error('Make a first commit before enabling Taskmaster.')
  await git(ctx.root, ['worktree', 'prune'])
  await fsp.rm(ctx.wt, { recursive: true, force: true })
  await fsp.mkdir(join(ctx.wt, '..'), { recursive: true })
  await git(ctx.root, ['worktree', 'add', '--detach', ctx.wt])
  await git(ctx.wt, ['checkout', '--orphan', BRANCH])
  await git(ctx.wt, ['rm', '-rf', '-q', '--ignore-unmatch', '.'])
  await writeTeam(ctx.wt, { lead: ctx.login, members: [{ login: ctx.login, role: 'custom', joinedAt: new Date().toISOString() }], roles: DEFAULT_ROLES })
  await commitAll(ctx, 'enable taskmaster')
  try {
    await git(ctx.wt, ['push', '-u', 'origin', BRANCH], { timeout: 120_000 })
    return { pushed: true, error: null }
  } catch (e) {
    return { pushed: false, error: (e as Error).message } // stays enabled locally; flush() pushes later
  }
}

export async function commitAll(ctx: Ctx, summary: string): Promise<boolean> {
  await git(ctx.wt, ['add', '-A'])
  if (!(await git(ctx.wt, ['status', '--porcelain'])).trim()) return false
  await git(ctx.wt, ['commit', '-m', `tm: ${ctx.login} ${summary}`])
  return true
}

async function pushNow(ctx: Ctx): Promise<boolean> {
  if ((await aheadCount(ctx.wt)) === 0) return false
  try {
    await git(ctx.wt, ['push', '-u', 'origin', BRANCH], { timeout: 120_000 })
    return true
  } catch (e) {
    if (!isRejected((e as Error).message)) throw e
  }
  await pull(ctx) // remote moved: rebase our commits on top (throws SyncConflict), then push once more
  await git(ctx.wt, ['push', '-u', 'origin', BRANCH], { timeout: 120_000 })
  return true
}

export async function flush(ctx: Ctx, summary: string): Promise<{ pushed: boolean }> {
  await commitAll(ctx, summary)
  return { pushed: await pushNow(ctx) }
}

// `-X theirs` while rebasing means OUR replayed commit wins a content conflict (per file, last push wins).
export async function pull(ctx: Ctx): Promise<'changed' | 'same' | 'missing' | 'offline'> {
  const f = await fetchContext(ctx.root)
  if (f !== 'ok') return f
  if ((await count(ctx.wt, `HEAD..${REMOTE_REF}`)) === 0) return 'same'
  await commitAll(ctx, 'sync')
  try {
    await git(ctx.wt, ['rebase', '-X', 'theirs', REMOTE_REF], { timeout: 120_000 })
  } catch (e) {
    try { await git(ctx.wt, ['rebase', '--abort']) } catch { /* no rebase running */ }
    throw new SyncConflict((e as Error).message)
  }
  return 'changed'
}

export async function reset(ctx: Ctx): Promise<void> {
  await fetchContext(ctx.root)
  if (!(await refExists(ctx.wt, REMOTE_REF))) throw new Error('Nothing on the remote to reset to')
  await git(ctx.wt, ['reset', '--hard', REMOTE_REF])
  await git(ctx.wt, ['clean', '-fdq'])
}
