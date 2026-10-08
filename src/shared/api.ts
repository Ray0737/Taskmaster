import type { Settings, SettingsPatch, FileEntry, FileContent, ManualChapter, Lang } from './types'

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
}

// Every main -> renderer event.
export interface Events {
  'fs.changed': { path: string }
  'pty.data': { id: number; data: string }
  'pty.exit': { id: number; code: number }
}
