import { it, expect } from 'vitest'
import { diffTeam } from '../src/shared/notify'
import { buildSystemPrompt, extractAssignments } from '../src/shared/prompt'
import { parsePresence, DEFAULT_ROLES, type TeamData, type Task } from '../src/shared/team'

const T0 = '2026-10-09T10:00:00.000Z'
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: 'T ' + id, brief: '', role: 'custom', assignee: null, status: 'todo', files: [], branch: null, createdBy: 'ray', createdAt: T0, updatedAt: T0, ...extra })
const data = (tasks: Task[], extra: Partial<TeamData> = {}): TeamData => ({
  team: { lead: 'ray', members: [{ login: 'ray', role: 'custom', joinedAt: T0 }, { login: 'bo', role: 'frontend', joinedAt: T0 }], roles: DEFAULT_ROLES },
  tasks, notes: [], presence: [], ...extra
})

it('diffTeam reports tasks assigned to me, notes on my tasks, and teammates starting a task', () => {
  const prev = data([task('t-aaaaaaaa'), task('t-bbbbbbbb', { assignee: 'ray' })])
  const next = data([task('t-aaaaaaaa', { assignee: 'ray' }), task('t-bbbbbbbb', { assignee: 'ray' }), task('t-cccccccc', { assignee: 'bo', createdBy: 'bo' })], {
    notes: [{ taskId: 't-bbbbbbbb', login: 'bo', at: T0, text: 'hi', file: 'n1.md' }, { taskId: 't-cccccccc', login: 'bo', at: T0, text: 'x', file: 'n2.md' }, { taskId: 't-bbbbbbbb', login: 'ray', at: T0, text: 'mine', file: 'n3.md' }],
    presence: [{ login: 'bo', taskId: 't-cccccccc', branch: 'tm/bo/t-cccccccc', status: 'working', at: T0 }, { login: 'ray', taskId: 't-aaaaaaaa', branch: null, status: 'working', at: T0 }]
  })
  expect(diffTeam(prev, next, 'ray')).toEqual([
    { kind: 'assigned', taskId: 't-aaaaaaaa' },
    { kind: 'note', taskId: 't-bbbbbbbb', login: 'bo' },
    { kind: 'started', taskId: 't-cccccccc', login: 'bo' }
  ])
  expect(diffTeam(next, next, 'ray')).toEqual([]) // nothing new: nothing reported again
})

it('extractAssignments reads proposals, ignores broken ones and caps at three', () => {
  const text = 'Done.\n<tm-assign login="bo" title="Fix header" role="frontend">Header overlaps on mobile.</tm-assign>\n<tm-assign title="no login">x</tm-assign>\n' +
    '<tm-assign login="al" title="  ">blank title</tm-assign>' + [1, 2, 3, 4].map((i) => `<tm-assign login="u${i}" title="T${i}">b${i}</tm-assign>`).join('')
  const r = extractAssignments(text)
  expect(r).toHaveLength(3)
  expect(r[0]).toEqual({ login: 'bo', title: 'Fix header', brief: 'Header overlaps on mobile.', role: 'frontend' })
  expect(r[1]).toEqual({ login: 'u1', title: 'T1', brief: 'b1' })
  expect(extractAssignments('no tags here')).toEqual([])
})

it('the system prompt lists teammates and the <tm-assign> rule only when there is a team', () => {
  const base = { others: [], notes: [] }
  const solo = buildSystemPrompt({ ...base, members: [{ login: 'ray', role: 'Custom' }], task: { title: 't', brief: 'b', files: [] } })
  expect(solo).not.toContain('tm-assign')
  const team = buildSystemPrompt({ ...base, members: [{ login: 'ray', role: 'Custom' }, { login: 'bo', role: 'Front end' }] })
  expect(team).toContain('@bo (Front end)')
  expect(team).toContain('<tm-assign')
  expect(team).toContain('must approve')
})

it('presence keeps the agent-running flag and defaults it to false', () => {
  expect(parsePresence({ login: 'bo', taskId: null, branch: null, status: 'working', running: true, at: T0 })?.running).toBe(true)
  expect(parsePresence({ login: 'bo', status: 'idle', at: T0 })?.running).toBe(false)
})
