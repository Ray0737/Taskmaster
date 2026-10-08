import { promises as fsp } from 'fs'
import { join } from 'path'
import {
  parseTask, parseTeam, parsePresence, parseNoteFile, isTaskId, isLogin, noteFileName,
  type Task, type Team, type Note, type Presence, type TeamData
} from '@shared/team'

export const TM_DIR = '.taskmaster'
const NOTE_MAX = 5000
const NOTES_KEPT = 200

const json = (o: unknown): string => JSON.stringify(o, null, 2) + '\n'
const readJson = async (f: string): Promise<unknown> => { try { return JSON.parse(await fsp.readFile(f, 'utf8')) } catch { return undefined } }
const names = async (d: string): Promise<string[]> => { try { return await fsp.readdir(d) } catch { return [] } }
const put = async (dir: string, rel: string[], body: string, flag = 'w'): Promise<void> => {
  const f = join(dir, TM_DIR, ...rel)
  await fsp.mkdir(join(f, '..'), { recursive: true })
  await fsp.writeFile(f, body, { flag })
}

// Everything a teammate wrote is untrusted: file names must match the ids inside, bad files are skipped.
export async function readAll(dir: string): Promise<TeamData | null> {
  const base = join(dir, TM_DIR)
  const team = parseTeam(await readJson(join(base, 'team.json')))
  if (!team) return null

  const tasks: Task[] = []
  for (const f of await names(join(base, 'tasks'))) {
    const stem = f.replace(/\.json$/, '')
    if (stem === f || !isTaskId(stem)) continue
    const t = parseTask(await readJson(join(base, 'tasks', f)))
    if (t && t.id === stem) tasks.push(t)
  }
  tasks.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))

  const presence: Presence[] = []
  for (const f of await names(join(base, 'presence'))) {
    const stem = f.replace(/\.json$/, '')
    if (stem === f || !isLogin(stem)) continue
    const p = parsePresence(await readJson(join(base, 'presence', f)))
    if (p && p.login === stem) presence.push(p)
  }
  presence.sort((a, b) => a.login.localeCompare(b.login))

  const notes: Note[] = []
  for (const tid of await names(join(base, 'notes'))) {
    if (!isTaskId(tid)) continue
    for (const f of await names(join(base, 'notes', tid))) {
      try {
        const n = parseNoteFile(tid, f, await fsp.readFile(join(base, 'notes', tid, f), 'utf8'))
        if (n) notes.push({ ...n, text: n.text.slice(0, NOTE_MAX) })
      } catch { /* unreadable note: skip */ }
    }
  }
  notes.sort((a, b) => b.at.localeCompare(a.at))
  return { team, tasks, notes: notes.slice(0, NOTES_KEPT), presence }
}

export async function writeTeam(dir: string, team: Team): Promise<void> {
  const t = parseTeam(team)
  if (!t) throw new Error('Invalid team')
  await put(dir, ['team.json'], json(t))
}

export async function writeTask(dir: string, task: Task): Promise<void> {
  const t = parseTask(task)
  if (!t) throw new Error('Invalid task')
  await put(dir, ['tasks', `${t.id}.json`], json(t))
}

export async function writePresence(dir: string, p: Presence): Promise<void> {
  const x = parsePresence(p)
  if (!x) throw new Error('Invalid presence')
  await put(dir, ['presence', `${x.login}.json`], json(x))
}

export async function addNote(dir: string, taskId: string, login: string, text: string, atIso = new Date().toISOString()): Promise<Note> {
  if (!isTaskId(taskId) || !isLogin(login)) throw new Error('Invalid note')
  const body = text.trim().slice(0, NOTE_MAX)
  if (!body) throw new Error('Empty note')
  const file = noteFileName(login, atIso)
  await put(dir, ['notes', taskId, file], body + '\n', 'wx') // 'wx': notes are never overwritten
  return { taskId, login, at: atIso, text: body, file }
}
