import type { PromptContext } from './prompt'

export type TaskStatus = 'todo' | 'doing' | 'review' | 'done'
export const STATUSES: TaskStatus[] = ['todo', 'doing', 'review', 'done']

export interface Task {
  id: string; title: string; brief: string
  role: string; assignee: string | null; status: TaskStatus
  files: string[]; branch: string | null
  createdBy: string; createdAt: string; updatedAt: string
}
export interface Role { id: string; label: string; prompt: string }
export interface Member { login: string; role: string; joinedAt: string }
export interface Team { lead: string; members: Member[]; roles: Role[] }
export interface Note { taskId: string; login: string; at: string; text: string; file: string }
export interface Presence { login: string; taskId: string | null; branch: string | null; status: 'idle' | 'working'; running?: boolean; at: string } // running: their agent is answering right now
export interface TeamData { team: Team; tasks: Task[]; notes: Note[]; presence: Presence[] }
export type SyncState = 'off' | 'idle' | 'syncing' | 'offline' | 'conflict'
export interface SyncInfo { state: SyncState; at: string | null; error: string | null }

export const DEFAULT_ROLES: Role[] = [
  { id: 'frontend', label: 'Front end', prompt: 'UI, components, styling, client state' },
  { id: 'backend', label: 'Back end', prompt: 'API, server logic, auth' },
  { id: 'data', label: 'DB / MCP', prompt: 'schema, migrations, MCP servers, integrations' },
  { id: 'custom', label: 'Custom', prompt: '' }
]
export const PRESET_ROLE_IDS = DEFAULT_ROLES.map((r) => r.id)

export const isLogin = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(s)
export const isTaskId = (s: unknown): s is string => typeof s === 'string' && /^t-[a-z0-9]{8}$/.test(s)
const isRoleId = (s: unknown): s is string => typeof s === 'string' && /^[\w-]{1,32}$/.test(s)

export function slugLogin(s: string): string {
  const x = s.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[^A-Za-z0-9]+/, '').replace(/-+$/, '').slice(0, 64)
  return x || 'me'
}

export function newTaskId(rand: () => number = Math.random): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += Math.floor(rand() * 36).toString(36)
  return 't-' + s
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null)
const str = (v: unknown, max: number, d = ''): string => (typeof v === 'string' ? v.slice(0, max) : d)
const iso = (v: unknown): string => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : '1970-01-01T00:00:00.000Z')

export function parseTask(raw: unknown): Task | null {
  const o = obj(raw)
  if (!o || !isTaskId(o.id) || typeof o.title !== 'string') return null
  return {
    id: o.id,
    title: str(o.title, 200),
    brief: str(o.brief, 20000),
    role: isRoleId(o.role) ? o.role : 'custom',
    assignee: isLogin(o.assignee) ? o.assignee : null,
    status: STATUSES.includes(o.status as TaskStatus) ? (o.status as TaskStatus) : 'todo',
    files: Array.isArray(o.files) ? o.files.filter((f): f is string => typeof f === 'string' && f.length > 0).map((f) => f.slice(0, 200)).slice(0, 50) : [],
    branch: typeof o.branch === 'string' && o.branch ? o.branch.slice(0, 200) : null,
    createdBy: isLogin(o.createdBy) ? o.createdBy : 'unknown',
    createdAt: iso(o.createdAt),
    updatedAt: iso(o.updatedAt)
  }
}

export function parseTeam(raw: unknown): Team | null {
  const o = obj(raw)
  if (!o || !isLogin(o.lead)) return null
  const members: Member[] = []
  for (const m of Array.isArray(o.members) ? o.members : []) {
    const x = obj(m)
    if (x && isLogin(x.login)) members.push({ login: x.login, role: isRoleId(x.role) ? x.role : 'custom', joinedAt: iso(x.joinedAt) })
  }
  const roles: Role[] = []
  for (const r of Array.isArray(o.roles) ? o.roles : []) {
    const x = obj(r)
    if (x && isRoleId(x.id)) roles.push({ id: x.id, label: str(x.label, 60, x.id), prompt: str(x.prompt, 2000) })
  }
  return { lead: o.lead, members, roles: roles.length ? roles : DEFAULT_ROLES.map((r) => ({ ...r })) }
}

export function parsePresence(raw: unknown): Presence | null {
  const o = obj(raw)
  if (!o || !isLogin(o.login)) return null
  return {
    login: o.login,
    taskId: isTaskId(o.taskId) ? o.taskId : null,
    branch: typeof o.branch === 'string' && o.branch ? o.branch.slice(0, 200) : null,
    status: o.status === 'working' ? 'working' : 'idle',
    running: o.running === true,
    at: iso(o.at)
  }
}

export const noteFileName = (login: string, at: string): string => `${at.replace(/[:.]/g, '-')}-${login}.md`

export function parseNoteFile(taskId: string, file: string, text: string): Note | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-(.+)\.md$/.exec(file)
  if (!m || !isTaskId(taskId) || !isLogin(m[6])) return null
  return { taskId, login: m[6], at: `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`, text: text.trim(), file }
}

const OFFLINE_AFTER_MS = 3 * 60 * 1000
export function presenceStatus(p: Presence, nowMs: number): 'working' | 'idle' | 'offline' {
  const age = nowMs - Date.parse(p.at)
  return Number.isNaN(age) || age > OFFLINE_AFTER_MS ? 'offline' : p.status
}

// Turns team data into the input of buildSystemPrompt (Plan 3). The agent's role is the active task's role if there is one.
export function buildPromptContext(d: TeamData, me: string, taskId: string | null): PromptContext {
  const task = taskId ? d.tasks.find((t) => t.id === taskId) : undefined
  const member = d.team.members.find((m) => m.login === me)
  const roleOf = (id: string | undefined): Role | undefined => d.team.roles.find((r) => r.id === id)
  const role = roleOf(task?.role ?? member?.role)
  const others = d.tasks
    .filter((t) => t.status === 'doing' && t.assignee && t.assignee !== me && t.id !== task?.id)
    .map((t) => ({ login: t.assignee!, role: roleOf(d.team.members.find((m) => m.login === t.assignee)?.role ?? t.role)?.label ?? t.role, taskTitle: t.title }))
  return {
    role: role ? { label: role.label, prompt: role.prompt } : undefined,
    task: task ? { title: task.title, brief: task.brief, files: task.files } : undefined,
    others,
    members: d.team.members.map((m) => ({ login: m.login, role: roleOf(m.role)?.label ?? m.role })),
    notes: d.notes.map((n) => ({ taskTitle: d.tasks.find((t) => t.id === n.taskId)?.title ?? n.taskId, login: n.login, text: n.text, at: n.at }))
  }
}
