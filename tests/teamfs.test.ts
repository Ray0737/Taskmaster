import { it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { DEFAULT_ROLES, type Task } from '../src/shared/team'
import { readAll, writeTeam, writeTask, writePresence, addNote, deleteTask, TM_DIR } from '../src/main/services/teamfs'

const tmp = () => mkdtempSync(join(tmpdir(), 'tm-teamfs-'))
const T0 = '2026-10-08T12:00:00.000Z'
const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id, title: 'T ' + id, brief: '', role: 'custom', assignee: null, status: 'todo', files: [], branch: null, createdBy: 'ray', createdAt: T0, updatedAt: T0, ...extra
})
const put = (dir: string, rel: string, body: string) => {
  const f = join(dir, TM_DIR, rel)
  mkdirSync(join(f, '..'), { recursive: true })
  writeFileSync(f, body)
}

it('readAll is null without a valid team.json', async () => {
  const d = tmp()
  expect(await readAll(d)).toBeNull()
  put(d, 'team.json', '{"lead":"../x"}')
  expect(await readAll(d)).toBeNull()
  put(d, 'team.json', '{truncated')
  expect(await readAll(d)).toBeNull()
})

it('round trip: team, task, presence, note', async () => {
  const d = tmp()
  await writeTeam(d, { lead: 'ray', members: [{ login: 'ray', role: 'frontend', joinedAt: T0 }], roles: DEFAULT_ROLES })
  await writeTask(d, task('t-aaaaaaaa', { title: 'Login', assignee: 'ray', status: 'doing' }))
  await writePresence(d, { login: 'ray', taskId: 't-aaaaaaaa', branch: 'tm/ray/t-aaaaaaaa', status: 'working', at: T0 })
  const n = await addNote(d, 't-aaaaaaaa', 'ray', '  Did the thing.\n', '2026-10-08T12:30:00.123Z')
  expect(n.file).toBe('2026-10-08T12-30-00-123Z-ray.md')
  const all = (await readAll(d))!
  expect(all.team.lead).toBe('ray')
  expect(all.tasks).toMatchObject([{ id: 't-aaaaaaaa', title: 'Login', status: 'doing' }])
  expect(all.presence).toMatchObject([{ login: 'ray', status: 'working' }])
  expect(all.notes).toEqual([{ taskId: 't-aaaaaaaa', login: 'ray', at: '2026-10-08T12:30:00.123Z', text: 'Did the thing.', file: n.file }])
  const raw = readFileSync(join(d, TM_DIR, 'tasks', 't-aaaaaaaa.json'), 'utf8')
  expect(raw.endsWith('}\n')).toBe(true)
  expect(raw.indexOf('"id"')).toBeLessThan(raw.indexOf('"title"')) // stable key order
})

it('skips broken, mismatched and forged records but keeps good ones', async () => {
  const d = tmp()
  await writeTeam(d, { lead: 'ray', members: [], roles: DEFAULT_ROLES })
  await writeTask(d, task('t-aaaaaaaa'))
  put(d, 'tasks/t-bbbbbbbb.json', '{"id":"t-bb')                                   // truncated
  put(d, 'tasks/t-cccccccc.json', JSON.stringify(task('t-dddddddd')))              // name != id
  put(d, 'tasks/evil.json', JSON.stringify(task('t-eeeeeeee')))                    // name is not a task id
  put(d, 'tasks/notes.txt', 'hello')
  await writePresence(d, { login: 'ray', taskId: null, branch: null, status: 'idle', at: T0 })
  put(d, 'presence/bee.json', JSON.stringify({ login: 'ray', status: 'idle', at: T0 })) // someone else's name
  put(d, 'presence/.hidden.json', JSON.stringify({ login: '.hidden', status: 'idle', at: T0 }))
  put(d, 'notes/t-aaaaaaaa/readme.md', 'not a note file name')
  put(d, 'notes/bad-dir/2026-10-08T12-00-00-000Z-ray.md', 'wrong dir name')
  put(d, 'notes/t-aaaaaaaa/2026-10-08T12-00-00-000Z-ray.md', 'good note')
  const all = (await readAll(d))!
  expect(all.tasks.map((t) => t.id)).toEqual(['t-aaaaaaaa'])
  expect(all.presence.map((p) => p.login)).toEqual(['ray'])
  expect(all.notes.map((n) => n.text)).toEqual(['good note'])
})

it('writes reject invalid input and never leave .taskmaster', async () => {
  const d = tmp()
  await expect(writeTask(d, task('../../x'))).rejects.toThrow('Invalid task')
  await expect(writeTask(d, task('t-ABC'))).rejects.toThrow('Invalid task')
  await expect(writePresence(d, { login: '../x', taskId: null, branch: null, status: 'idle', at: T0 })).rejects.toThrow('Invalid presence')
  await expect(writeTeam(d, { lead: '../x', members: [], roles: [] })).rejects.toThrow('Invalid team')
  await expect(addNote(d, 'nope', 'ray', 'x')).rejects.toThrow('Invalid note')
  await expect(addNote(d, 't-aaaaaaaa', '../x', 'x')).rejects.toThrow('Invalid note')
  await expect(addNote(d, 't-aaaaaaaa', 'ray', '   ')).rejects.toThrow('Empty note')
  expect(existsSync(join(d, '..', 'x.json'))).toBe(false)
  expect(existsSync(join(d, TM_DIR))).toBe(false)
})

it('notes are newest first and a long note is capped at 5000 characters', async () => {
  const d = tmp()
  await writeTeam(d, { lead: 'ray', members: [], roles: DEFAULT_ROLES })
  await addNote(d, 't-aaaaaaaa', 'ray', 'old', '2026-10-01T00:00:00.000Z')
  await addNote(d, 't-aaaaaaaa', 'bee', 'x'.repeat(9000), '2026-10-02T00:00:00.000Z')
  const notes = (await readAll(d))!.notes
  expect(notes.map((n) => n.login)).toEqual(['bee', 'ray'])
  expect(notes[0].text).toHaveLength(5000)
})

it('deleteTask removes the task and its notes, ignores missing ones, rejects bad ids', async () => {
  const d = tmp()
  await writeTeam(d, { lead: 'ray', members: [], roles: DEFAULT_ROLES })
  await writeTask(d, task('t-aaaaaaaa'))
  await writeTask(d, task('t-bbbbbbbb'))
  await addNote(d, 't-aaaaaaaa', 'ray', 'gone with the task')
  await deleteTask(d, 't-aaaaaaaa')
  await deleteTask(d, 't-aaaaaaaa') // already gone: fine
  const all = (await readAll(d))!
  expect(all.tasks.map((x) => x.id)).toEqual(['t-bbbbbbbb'])
  expect(all.notes).toEqual([])
  await expect(deleteTask(d, '../team')).rejects.toThrow('Invalid task')
})

it('screenshots: add, list, read, remove, limits, and delete with the task', async () => {
  const { addImage, listImages, readImage, removeImage, IMG_MAX_PER_TASK } = await import('../src/main/services/teamfs')
  const d = tmp()
  const png = Buffer.from('iVBORw0KGgo=', 'base64').toString('base64')
  const f = await addImage(d, 't-aaaaaaaa', png, 'png', 1000)
  expect(f).toBe('1000.png')
  expect(await listImages(d, 't-aaaaaaaa')).toEqual(['1000.png'])
  expect(await readImage(d, 't-aaaaaaaa', f)).toBe(`data:image/png;base64,${png}`)
  await expect(addImage(d, 't-aaaaaaaa', png, 'svg')).rejects.toThrow(/png, jpg/)
  await expect(addImage(d, 't-aaaaaaaa', png, 'constructor')).rejects.toThrow(/png, jpg/)
  await expect(addImage(d, '../x', png, 'png')).rejects.toThrow(/Invalid task/)
  await expect(readImage(d, 't-aaaaaaaa', '../tasks/x.png')).rejects.toThrow(/Invalid image/)
  await expect(addImage(d, 't-aaaaaaaa', Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64'), 'png')).rejects.toThrow(/4 MB/)
  for (let i = 1; i < IMG_MAX_PER_TASK; i++) await addImage(d, 't-aaaaaaaa', png, 'png', 2000 + i)
  await expect(addImage(d, 't-aaaaaaaa', png, 'png', 9999)).rejects.toThrow(/at most 10/)
  await removeImage(d, 't-aaaaaaaa', '1000.png')
  expect(await listImages(d, 't-aaaaaaaa')).toHaveLength(IMG_MAX_PER_TASK - 1)
  await deleteTask(d, 't-aaaaaaaa')
  expect(await listImages(d, 't-aaaaaaaa')).toEqual([])
})
