import { execFile } from 'child_process'
import type { Account, RepoInfo } from '@shared/types'
import { handle } from '../ipc'

let token: string | null = null // memory only, never written anywhere
let account: Account | null = null

export const getToken = (): string | null => token

export function parseCredential(out: string): string | null {
  for (const line of out.split(/\r?\n/)) if (line.startsWith('password=')) return line.slice(9).trim() || null
  return null
}

export function tryExec(bin: string, args: string[], o: { input?: string; env?: Record<string, string>; timeout?: number } = {}): Promise<string | null> {
  return new Promise((res) => {
    const p = execFile(bin, args, {
      windowsHide: true, timeout: o.timeout ?? 15_000, encoding: 'utf8', maxBuffer: 1024 * 1024,
      env: { ...process.env, ...o.env }
    }, (err, stdout) => res(err ? null : stdout))
    p.stdin?.on('error', () => {}) // e.g. EPIPE when the program does not exist
    p.stdin?.end(o.input ?? '')
  })
}

export function toRepoInfo(r: { full_name: string; owner: { login: string }; name: string; private: boolean; updated_at: string; clone_url: string }): RepoInfo {
  return { fullName: r.full_name, owner: r.owner.login, name: r.name, private: r.private, updatedAt: r.updated_at, cloneUrl: r.clone_url }
}

export const sanitizeRepoName = (name: string): string =>
  name.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'project'

async function api<T>(path: string, tok: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch('https://api.github.com' + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${tok}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Taskmaster',
      'X-GitHub-Api-Version': '2022-11-28', ...(init.headers as Record<string, string> | undefined)
    },
    signal: AbortSignal.timeout(15_000)
  })
  if (!r.ok) {
    let msg = r.statusText
    try { msg = ((await r.json()) as { message?: string }).message ?? msg } catch { /* not json */ }
    throw new Error(`GitHub ${r.status}: ${msg}`)
  }
  return (await r.json()) as T
}

async function userFor(tok: string): Promise<Account | null> {
  try {
    const u = await api<{ login: string; name: string | null; avatar_url: string }>('/user', tok)
    return { login: u.login, name: u.name, avatarUrl: u.avatar_url }
  } catch { return null }
}

const CRED_INPUT = 'protocol=https\nhost=github.com\n\n'
const fill = (interactive: boolean): Promise<string | null> =>
  tryExec('git', ['credential', 'fill'], {
    input: CRED_INPUT, timeout: interactive ? 180_000 : 15_000,
    env: { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: interactive ? 'always' : 'never' }
  })

// Silent: `gh auth token`, then Git Credential Manager without any prompt.
export async function loadAccount(): Promise<Account | null> {
  if (account) return account
  const candidates = [(await tryExec('gh', ['auth', 'token']))?.trim() || null, parseCredential((await fill(false)) ?? '')]
  for (const t of candidates) {
    if (!t) continue
    const a = await userFor(t)
    if (a) { token = t; account = a; return a }
  }
  return null
}

// Opens the Git Credential Manager browser login if there is no valid token yet.
export async function connectAccount(): Promise<Account | null> {
  account = null; token = null
  const stale = await fill(false)
  if (stale) {
    const a = await userFor(parseCredential(stale) ?? '')
    if (a) { token = parseCredential(stale); account = a; return a }
    await tryExec('git', ['credential', 'reject'], { input: stale }) // tell GCM it is dead
  }
  const out = await fill(true)
  const t = out ? parseCredential(out) : null
  const a = t ? await userFor(t) : null
  if (!a || !t || !out) return null
  await tryExec('git', ['credential', 'approve'], { input: out }) // let GCM store it
  token = t; account = a
  return a
}

function need(): string {
  if (!token) throw new Error('Not signed in to GitHub')
  return token
}

export async function listRepos(): Promise<RepoInfo[]> {
  const out: RepoInfo[] = []
  for (let page = 1; page <= 3; page++) {
    const raw = await api<Parameters<typeof toRepoInfo>[0][]>(`/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`, need())
    out.push(...raw.map(toRepoInfo))
    if (raw.length < 100) break
  }
  return out
}

export async function createRepo(name: string, isPrivate: boolean): Promise<RepoInfo> {
  return toRepoInfo(await api('/user/repos', need(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: sanitizeRepoName(name), private: isPrivate })
  }))
}

export function registerAuth(): void {
  handle('auth.status', loadAccount)
  handle('auth.connect', connectAccount)
  handle('auth.repos', listRepos)
}
