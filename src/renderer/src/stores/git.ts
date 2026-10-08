import { create } from 'zustand'
import type { Account, BranchList, GitStatus, GitStatusEntry } from '@shared/types'
import { call, on } from '../ipc'
import { useApp } from './app'

// One-letter badge for a status entry (spec §12.4): M modified, A added, U untracked, D deleted, R renamed, ! conflict.
export function letterOf(e: GitStatusEntry): string {
  const { index: i, work: w } = e
  if (i === 'U' || w === 'U' || (i === 'A' && w === 'A') || (i === 'D' && w === 'D')) return '!'
  if (w === '?') return 'U'
  const c = i !== ' ' ? i : w
  return c === 'C' ? 'R' : c
}

interface GitState {
  account: Account | null
  accountChecked: boolean
  status: GitStatus | null // null = no project or not a repository
  branches: BranchList | null
  letters: Record<string, string> // relative path -> badge letter
  dirtyDirs: Record<string, boolean> // relative folder -> has changes inside
  refresh(): Promise<void>
  loadAccount(): Promise<void>
  connect(): Promise<Account | null>
}

export const useGit = create<GitState>((set) => ({
  account: null, accountChecked: false, status: null, branches: null, letters: {}, dirtyDirs: {},

  refresh: async () => {
    const root = useApp.getState().root
    if (!root) { set({ status: null, branches: null, letters: {}, dirtyDirs: {} }); return }
    try {
      const [status, branches] = await Promise.all([call('git.status'), call('git.branches')])
      if (useApp.getState().root !== root) return // project changed while waiting
      const letters: Record<string, string> = {}
      const dirtyDirs: Record<string, boolean> = {}
      for (const f of status.files) {
        letters[f.path] = letterOf(f)
        const parts = f.path.split('/')
        for (let n = 1; n < parts.length; n++) dirtyDirs[parts.slice(0, n).join('/')] = true
      }
      set({ status, branches, letters, dirtyDirs })
    } catch {
      if (useApp.getState().root === root) set({ status: null, branches: null, letters: {}, dirtyDirs: {} })
    }
  },

  loadAccount: async () => {
    let account: Account | null = null
    try { account = await call('auth.status') } catch { /* offline or no token: git-only mode */ }
    set({ account, accountChecked: true })
  },

  connect: async () => {
    let account: Account | null = null
    try { account = await call('auth.connect') } catch { /* user closed the login window */ }
    set({ account, accountChecked: true })
    return account
  }
}))

// Keep status fresh: project change, file changes (debounced), window focus. `.git` changes are not watched,
// so every git action in the UI calls refresh() itself.
useApp.subscribe((s, p) => { if (s.root !== p.root) void useGit.getState().refresh() })
let timer: ReturnType<typeof setTimeout> | undefined
const soon = () => { clearTimeout(timer); timer = setTimeout(() => void useGit.getState().refresh(), 400) }
on('fs.changed', soon)
window.addEventListener('focus', soon)
