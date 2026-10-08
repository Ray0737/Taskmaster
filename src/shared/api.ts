import type { Settings, SettingsPatch, FileEntry, FileContent, ManualChapter, Lang, GitIdentity, GitStatus, BranchList, Account, RepoInfo, RecentProject } from './types'

export type EditRole = 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll'

// Every IPC channel. Renderer calls with call('<key>', ...args). Main registers with handle('<key>', fn).
export interface Api {
  'settings.get': () => Promise<Settings>
  'settings.set': (patch: SettingsPatch) => Promise<Settings>
  'win.setOverlay': (color: string, symbolColor: string) => Promise<void>
  'win.role': (role: EditRole) => Promise<void>
  'shell.openExternal': (url: string) => Promise<void>
  'app.quit': () => Promise<void>
  'app.openLogs': () => Promise<void>
  'dialog.openFolder': () => Promise<string | null>
  'project.open': (path: string) => Promise<string>
  'fs.list': (dir: string) => Promise<FileEntry[]>
  'fs.read': (path: string) => Promise<FileContent>
  'fs.write': (path: string, text: string) => Promise<void>
  'fs.create': (path: string, dir: boolean) => Promise<void>
  'fs.rename': (from: string, to: string) => Promise<void>
  'fs.delete': (path: string) => Promise<void>
  'fs.reveal': (path: string) => Promise<void>
  'fs.listAll': () => Promise<string[]>
  'pty.available': () => Promise<boolean>
  'pty.create': (o: { cols: number; rows: number; cmd?: string }) => Promise<number>
  'pty.write': (id: number, data: string) => Promise<void>
  'pty.resize': (id: number, cols: number, rows: number) => Promise<void>
  'pty.kill': (id: number) => Promise<void>
  'manual.list': (lang: Lang) => Promise<ManualChapter[]>
  'manual.read': (lang: Lang, file: string) => Promise<string>
  'git.version': () => Promise<string | null>
  'git.identity': () => Promise<GitIdentity>
  'git.setIdentity': (i: GitIdentity) => Promise<void>
  'git.isRepo': (dir: string) => Promise<boolean>
  'git.init': (dir: string) => Promise<void>
  'git.status': () => Promise<GitStatus>
  'git.stage': (paths: string[]) => Promise<void>
  'git.unstage': (paths: string[]) => Promise<void>
  'git.discard': (tracked: string[], untracked: string[]) => Promise<void>
  'git.commit': (message: string) => Promise<void>
  'git.branches': () => Promise<BranchList>
  'git.switch': (name: string, create: boolean) => Promise<void>
  'git.sync': () => Promise<void>
  'git.show': (relPath: string) => Promise<string | null>
  'git.remoteUrl': () => Promise<string | null>
  'git.clone': (url: string, parent: string, name: string) => Promise<string>
  'git.cloneCancel': () => Promise<void>
  'auth.status': () => Promise<Account | null>
  'auth.connect': () => Promise<Account | null>
  'auth.repos': () => Promise<RepoInfo[]>
  'recent.list': () => Promise<RecentProject[]>
  'recent.add': (path: string) => Promise<void>
  'recent.remove': (path: string) => Promise<RecentProject[]>
  'project.create': (parent: string, name: string, github: false | 'public' | 'private') => Promise<{ path: string; warning?: string }>
  'project.close': () => Promise<void>
}

// Every main -> renderer event.
export interface Events {
  'fs.changed': { path: string }
  'pty.data': { id: number; data: string }
  'pty.exit': { id: number; code: number }
  'git.progress': { percent: number; text: string }
}
