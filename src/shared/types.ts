export type ThemeId = 'mono-dark' | 'mono-light' | 'mocha' | 'github-dark'
export type Lang = 'en' | 'th'
export type AgentMode = 'plan' | 'acceptEdits' | 'bypassPermissions'

export interface Layout {
  sidebar: number; agent: number; panel: number // percent sizes
  sidebarVisible: boolean; agentVisible: boolean; panelVisible: boolean
}

export interface Settings {
  lang: Lang
  theme: ThemeId
  fontSize: number
  autoSave: 'off' | 'delay'
  wordWrap: boolean
  defaultAgent: string | null
  defaultMode: AgentMode
  fetchInterval: 15 | 30 | 60
  syncPaused: boolean
  setupDone: boolean
  layout: Layout
}

export type SettingsPatch = Partial<Omit<Settings, 'layout'>> & { layout?: Partial<Layout> }

export interface FileEntry { name: string; path: string; dir: boolean }

export type FileContent =
  | { kind: 'text'; text: string; readonly: boolean }
  | { kind: 'binary' }
  | { kind: 'tooBig' }
  | { kind: 'missing' }

export interface ManualChapter { file: string; title: string; headings: string[] }

export interface GitIdentity { name: string; email: string }

// Letters come straight from `git status --porcelain=v1`: ' ' none, M modified, A added, D deleted, R renamed, ? untracked.
export interface GitStatusEntry { path: string; index: string; work: string }
export interface GitStatus {
  branch: string | null // null = detached HEAD
  upstream: string | null
  ahead: number
  behind: number
  files: GitStatusEntry[]
}
export interface BranchList { current: string | null; all: string[] }

export interface Account { login: string; name: string | null; avatarUrl: string }
export interface RepoInfo { fullName: string; owner: string; name: string; private: boolean; updatedAt: string; cloneUrl: string }
export interface RecentProject { path: string; name: string; lastOpened: string }
