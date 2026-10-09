import { create } from 'zustand'
import { extractAssignments } from '@shared/prompt'
import { isLogin, newTaskId, type Task } from '@shared/team'
import { errMsg } from '../ipc'
import { tr } from '../i18n'
import { runCommand } from '../commands'
import { agentHooks } from '../views/registry'
import { useApp } from './app'
import { useTeam, teamListeners } from './team'
import { toast } from './ui'

// Notifications are kept in memory for the open project. Pending agent proposals are lost when the app closes.
export type Notice =
  | { id: number; at: string; read: boolean; kind: 'assigned' | 'note' | 'started'; taskId: string; login?: string }
  | { id: number; at: string; read: boolean; kind: 'proposal'; login: string; title: string; brief: string; role?: string; state: 'open' | 'approved' | 'dismissed' }

type NewNotice = Notice extends infer N ? (N extends Notice ? Omit<N, 'id' | 'at' | 'read'> : never) : never

interface NoticeState {
  items: Notice[]
  add(n: NewNotice): void
  markRead(id: number): void
  markAllRead(): void
  clear(): void
  approve(id: number): Promise<void>
  dismiss(id: number): void
}

let seq = 0
const KEPT = 100

export const useNotices = create<NoticeState>((set, get) => ({
  items: [],
  add: (n) => set((s) => ({ items: [{ ...n, id: ++seq, at: new Date().toISOString(), read: false } as Notice, ...s.items].slice(0, KEPT) })),
  markRead: (id) => set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, read: true } : x)) })),
  markAllRead: () => set((s) => ({ items: s.items.map((x) => ({ ...x, read: true })) })),
  clear: () => set((s) => ({ items: s.items.filter((x) => x.kind === 'proposal' && x.state === 'open') })), // open proposals stay until decided

  // Creates the proposed task for a teammate. Checked here, not trusted from the agent: the login must be a team member.
  approve: async (id) => {
    const n = get().items.find((x) => x.id === id)
    const { data, me } = useTeam.getState()
    if (!n || n.kind !== 'proposal' || n.state !== 'open' || !data || !me) return
    const member = data.team.members.find((m) => m.login === n.login)
    if (!isLogin(n.login) || !member) { toast(tr('notices.notMember', { login: n.login }), 'error'); return }
    const now = new Date().toISOString()
    const task: Task = {
      id: newTaskId(), title: n.title, brief: n.brief, role: data.team.roles.some((r) => r.id === n.role) ? n.role! : member.role,
      assignee: n.login, status: 'todo', files: [], branch: null, createdBy: me, createdAt: now, updatedAt: now
    }
    try {
      await useTeam.getState().saveTask(task)
      set((s) => ({ items: s.items.map((x) => (x.id === id && x.kind === 'proposal' ? { ...x, state: 'approved', read: true } : x)) }))
      toast(tr('notices.approved', { login: n.login, title: n.title }))
    } catch (e) { toast(errMsg(e), 'error') }
  },
  dismiss: (id) => set((s) => ({ items: s.items.map((x) => (x.id === id && x.kind === 'proposal' ? { ...x, state: 'dismissed', read: true } : x)) }))
}))

export const unreadCount = (items: Notice[]): number => items.filter((x) => (x.kind === 'proposal' ? x.state === 'open' : !x.read)).length

const open = (): void => runCommand('view.notifications')

// Teammates' changes (see diffTeam).
teamListeners.push((events) => {
  const add = useNotices.getState().add
  const titleOf = (id: string): string => useTeam.getState().data?.tasks.find((t) => t.id === id)?.title ?? id
  for (const e of events) {
    add(e.kind === 'assigned' ? { kind: 'assigned', taskId: e.taskId } : { kind: e.kind, taskId: e.taskId, login: e.login })
    if (e.kind === 'assigned') toast(tr('notices.assigned', { task: titleOf(e.taskId) }), 'info', { label: tr('notices.open'), run: open })
  }
})

// The agent's <tm-assign> blocks become proposals; nothing is created until the user approves.
agentHooks.onResult.push((r) => {
  if (!r.ok) return
  const found = extractAssignments(r.text)
  for (const a of found) useNotices.getState().add({ kind: 'proposal', login: a.login, title: a.title, brief: a.brief, role: a.role, state: 'open' })
  if (found.length) toast(tr('notices.proposed', { n: found.length }), 'info', { label: tr('notices.open'), run: open })
})

useApp.subscribe((s, p) => { if (s.root !== p.root) useNotices.setState({ items: [] }) })
