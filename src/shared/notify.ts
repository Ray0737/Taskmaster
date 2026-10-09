import type { TeamData } from './team'

// What changed in the team data between two reads, from the point of view of `me`. Pure: the notification store decides what to
// show. Changes made by `me` are not reported (the store skips the diff for its own saves).
export type TeamEvent =
  | { kind: 'assigned'; taskId: string }                    // a task is now assigned to me
  | { kind: 'note'; taskId: string; login: string }         // a teammate left a note on a task I own or created
  | { kind: 'started'; taskId: string; login: string }      // a teammate started working on a task

export function diffTeam(prev: TeamData, next: TeamData, me: string): TeamEvent[] {
  const out: TeamEvent[] = []
  const before = new Map(prev.tasks.map((t) => [t.id, t]))
  for (const t of next.tasks) {
    const was = before.get(t.id)
    if (t.assignee === me && was?.assignee !== me && t.status !== 'done') out.push({ kind: 'assigned', taskId: t.id })
  }
  const seen = new Set(prev.notes.map((n) => `${n.taskId}/${n.file}`))
  for (const n of next.notes) {
    if (n.login === me || seen.has(`${n.taskId}/${n.file}`)) continue
    const t = next.tasks.find((x) => x.id === n.taskId)
    if (t && (t.assignee === me || t.createdBy === me)) out.push({ kind: 'note', taskId: n.taskId, login: n.login })
  }
  const was = new Map(prev.presence.map((p) => [p.login, p]))
  for (const p of next.presence) {
    if (p.login === me || !p.taskId) continue
    const old = was.get(p.login)
    if (old?.taskId !== p.taskId && next.tasks.some((t) => t.id === p.taskId)) out.push({ kind: 'started', taskId: p.taskId, login: p.login })
  }
  return out
}
