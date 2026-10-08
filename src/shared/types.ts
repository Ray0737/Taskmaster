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
