import { it, expect } from 'vitest'
import {
  DEFAULT_ROLES, isLogin, slugLogin, isTaskId, newTaskId, parseTask, parseTeam, parsePresence,
  noteFileName, parseNoteFile, presenceStatus, buildPromptContext, type TeamData
} from '../src/shared/team'
import { buildSystemPrompt } from '../src/shared/prompt'

const T0 = '2026-10-08T12:00:00.000Z'
const goodTask = { id: 't-abc12345', title: 'Login page', brief: 'Build it', role: 'frontend', assignee: 'ray', status: 'doing', files: ['src/ui/**'], branch: 'tm/ray/t-abc12345', createdBy: 'ray', createdAt: T0, updatedAt: T0 }

it('login and id validation', () => {
  for (const ok of ['ray', 'Ray-1', 'a.b_c', 'x']) expect(isLogin(ok), ok).toBe(true)
  for (const bad of ['', '.hidden', '-x', '../x', 'a/b', 'a b', 'a'.repeat(65), 'ก']) expect(isLogin(bad), bad).toBe(false)
  expect(isTaskId('t-abc12345')).toBe(true)
  for (const bad of ['t-ABC12345', 't-abc1234', 't-abc123456', '../t-abc12345', 'x-abc12345', '']) expect(isTaskId(bad), bad).toBe(false)
})

it('slugLogin makes a safe login', () => {
  expect(slugLogin('Ray Hecker')).toBe('Ray-Hecker')
  expect(slugLogin('  ทดสอบ  ')).toBe('me')
  expect(slugLogin('a/b\\c')).toBe('a-b-c')
  expect(isLogin(slugLogin('..weird..'))).toBe(true)
})

it('newTaskId is valid and uses the given random source', () => {
  expect(isTaskId(newTaskId())).toBe(true)
  expect(newTaskId(() => 0)).toBe('t-00000000')
  const ids = new Set(Array.from({ length: 200 }, () => newTaskId()))
  expect(ids.size).toBe(200)
})

it('parseTask accepts a good task and normalizes', () => {
  expect(parseTask(goodTask)).toEqual(goodTask)
  const t = parseTask({ ...goodTask, status: 'banana', files: ['a', 5, 'b'], extra: 1, assignee: 12 })!
  expect(t.status).toBe('todo')
  expect(t.files).toEqual(['a', 'b'])
  expect(t.assignee).toBeNull()
  expect(t).not.toHaveProperty('extra')
})

it('parseTask rejects bad ids, junk and non-objects', () => {
  for (const bad of [null, 'x', 5, [], {}, { ...goodTask, id: '../../x' }, { ...goodTask, id: 't-ABC' }, { ...goodTask, title: 5 }]) expect(parseTask(bad)).toBeNull()
})

it('parseTask caps field sizes', () => {
  const t = parseTask({ ...goodTask, title: 'x'.repeat(500), brief: 'y'.repeat(50000), files: Array.from({ length: 100 }, (_, i) => `f${i}`) })!
  expect(t.title.length).toBe(200)
  expect(t.brief.length).toBe(20000)
  expect(t.files).toHaveLength(50)
})

it('parseTeam defaults roles and drops bad members', () => {
  const t = parseTeam({ lead: 'ray', members: [{ login: 'ray', role: 'frontend', joinedAt: T0 }, { login: '../x', role: 'x', joinedAt: T0 }, 'junk'] })!
  expect(t.lead).toBe('ray')
  expect(t.members.map((m) => m.login)).toEqual(['ray'])
  expect(t.roles).toEqual(DEFAULT_ROLES)
  expect(parseTeam({ lead: '../x', members: [] })).toBeNull()
  expect(parseTeam(null)).toBeNull()
  const custom = parseTeam({ lead: 'ray', members: [], roles: [{ id: 'qa', label: 'QA', prompt: 'tests' }, { id: 'bad id', label: 'x', prompt: '' }] })!
  expect(custom.roles).toEqual([{ id: 'qa', label: 'QA', prompt: 'tests' }])
})

it('parsePresence', () => {
  expect(parsePresence({ login: 'ray', taskId: 't-abc12345', branch: 'tm/ray/t-abc12345', status: 'working', at: T0 })).toMatchObject({ login: 'ray', status: 'working' })
  expect(parsePresence({ login: 'ray', taskId: 'nope', branch: null, status: 'zzz', at: T0 })).toMatchObject({ taskId: null, status: 'idle' })
  expect(parsePresence({ login: '../x', status: 'idle', at: T0 })).toBeNull()
})

it('presenceStatus: offline after 3 minutes', () => {
  const now = Date.parse(T0)
  const p = { login: 'ray', taskId: null, branch: null, status: 'working' as const, at: T0 }
  expect(presenceStatus(p, now + 60_000)).toBe('working')
  expect(presenceStatus({ ...p, status: 'idle' }, now + 179_000)).toBe('idle')
  expect(presenceStatus(p, now + 181_000)).toBe('offline')
  expect(presenceStatus({ ...p, at: 'garbage' }, now)).toBe('offline')
})

it('note file names have no colons and round-trip', () => {
  const f = noteFileName('ray', '2026-10-08T12:30:00.123Z')
  expect(f).toBe('2026-10-08T12-30-00-123Z-ray.md')
  expect(f).not.toContain(':')
  expect(parseNoteFile('t-abc12345', f, 'Did X.\n')).toEqual({ taskId: 't-abc12345', login: 'ray', at: '2026-10-08T12:30:00.123Z', text: 'Did X.', file: f })
  expect(parseNoteFile('t-abc12345', 'notes.txt', 'x')).toBeNull()
  expect(parseNoteFile('t-abc12345', '2026-10-08T12-30-00-123Z-..%2f.md', 'x')).toBeNull()
  expect(parseNoteFile('../x', f, 'x')).toBeNull()
})

const data: TeamData = {
  team: { lead: 'ray', roles: DEFAULT_ROLES, members: [{ login: 'ray', role: 'frontend', joinedAt: T0 }, { login: 'bee', role: 'backend', joinedAt: T0 }] },
  tasks: [
    goodTask as never,
    { ...goodTask, id: 't-bbb22222', title: 'Auth API', assignee: 'bee', role: 'backend', status: 'doing', files: [] } as never,
    { ...goodTask, id: 't-ccc33333', title: 'Old', assignee: 'bee', status: 'done' } as never,
    { ...goodTask, id: 't-ddd44444', title: 'Mine too', assignee: 'ray', status: 'doing' } as never
  ],
  notes: [{ taskId: 't-ccc33333', login: 'bee', at: '2026-10-07T00:00:00.000Z', text: 'Schema is in db/schema.sql', file: 'x.md' }],
  presence: []
}

it('buildPromptContext maps team data for the prompt builder', () => {
  const c = buildPromptContext(data, 'ray', 't-abc12345')
  expect(c.role).toEqual({ label: 'Front end', prompt: DEFAULT_ROLES[0].prompt })
  expect(c.task).toEqual({ title: 'Login page', brief: 'Build it', files: ['src/ui/**'] })
  expect(c.others).toEqual([{ login: 'bee', role: 'Back end', taskTitle: 'Auth API' }]) // not me, not done, not this task
  expect(c.notes).toEqual([{ taskTitle: 'Old', login: 'bee', text: 'Schema is in db/schema.sql', at: '2026-10-07T00:00:00.000Z' }])
  const p = buildSystemPrompt(c)
  expect(p).toContain('Your role: Front end')
  expect(p).toContain('- @bee (Back end) doing "Auth API"')
  expect(p).toContain('[Old] @bee: Schema is in db/schema.sql')
})

it('buildPromptContext with no task still gives role and team', () => {
  const c = buildPromptContext(data, 'ray', null)
  expect(c.task).toBeUndefined()
  expect(c.role?.label).toBe('Front end')
  expect(c.others.map((o) => o.login)).toEqual(['bee']) // only OTHER members' tasks in progress
})

it('buildPromptContext for a stranger has no role', () => {
  expect(buildPromptContext(data, 'zed', null).role).toBeUndefined()
})
