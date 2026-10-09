import type { Settings, SettingsPatch, FileEntry, FileContent, ManualChapter, Lang, GitIdentity, GitStatus, BranchList, Account, RepoInfo, RecentProject, AgentInfo, AgentMode } from './types'
import type { AgentEvent } from './agent'
import type { Skill } from './skills'
import type { PastSession, TranscriptEntry } from './transcript'
import type { Task, Team, TeamData, SyncInfo } from './team'

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
  'agent.detect': () => Promise<AgentInfo[]>
  // runId is chosen by the renderer so it can match events that arrive before this call resolves.
  'agent.run': (o: { runId: number; agentId: string; prompt: string; system: string; mode: AgentMode; model: string; taskId: string | null; sessionId: string | null }) => Promise<void>
  'agent.stop': (runId: number) => Promise<void>
  'agent.sessionGet': (key: string) => Promise<string | null>
  'agent.sessionSet': (key: string, id: string | null) => Promise<void>
  'agent.sessions': () => Promise<PastSession[]>
  'agent.transcript': (id: string) => Promise<TranscriptEntry[]>
  'team.attach': (login: string) => Promise<{ state: 'enabled' | 'disabled'; offline: boolean }>
  'team.enable': () => Promise<{ pushed: boolean; error: string | null }>
  'team.read': () => Promise<TeamData | null>
  'team.saveTeam': (team: Team) => Promise<void>
  'team.saveTask': (task: Task) => Promise<void>
  'team.deleteTask': (id: string) => Promise<void>
  'team.images': (taskId: string) => Promise<string[]>
  'team.imageData': (taskId: string, file: string) => Promise<string>
  'team.imagePath': (taskId: string, file: string) => Promise<string>
  'team.addImage': (taskId: string, base64: string, ext: string) => Promise<string>
  'team.removeImage': (taskId: string, file: string) => Promise<void>
  'team.scanSkills': (url: string) => Promise<{ skills: { name: string; dir: string; description: string; files: number; scripts: number; tooBig: boolean; exists: boolean }[]; truncated: boolean }>
  'team.importSkills': (url: string, dirs: string[]) => Promise<string[]>
  'team.skills': () => Promise<Skill[]>
  'team.saveSkill': (skill: Skill) => Promise<void>
  'team.deleteSkill': (name: string) => Promise<void>
  'team.addNote': (taskId: string, text: string) => Promise<void>
  'team.setPresence': (p: { taskId: string | null; branch: string | null; status: 'idle' | 'working' }) => Promise<void>
  'team.syncNow': () => Promise<void>
  'team.resetToRemote': () => Promise<void>
  'team.detach': () => Promise<void>
  'auth.collaborators': () => Promise<{ login: string; avatarUrl: string }[]>
  'auth.invite': (login: string) => Promise<'invited' | 'already'>
  'git.startBranch': (name: string) => Promise<void>
  'git.stashAll': (label: string) => Promise<void>
  'git.commitAll': (message: string) => Promise<void>
}

// Every main -> renderer event.
export interface Events {
  'fs.changed': { path: string }
  'pty.data': { id: number; data: string }
  'pty.exit': { id: number; code: number }
  'git.progress': { percent: number; text: string }
  'agent.event': { runId: number; ev: AgentEvent }
  'agent.exit': { runId: number; code: number | null }
  'team.changed': { at: string }
  'team.sync': SyncInfo
}
