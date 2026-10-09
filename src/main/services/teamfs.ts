import { promises as fsp } from 'fs'
import { join } from 'path'
import {
  parseTask, parseTeam, parsePresence, parseNoteFile, isTaskId, isLogin, noteFileName,
  type Task, type Team, type Note, type Presence, type TeamData
} from '@shared/team'
import { isSkillName, isSafeRelPath, parseSkill, renderSkill, type Skill } from '@shared/skills'

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

// Removes the task file, its notes and its screenshots. Missing files are fine (a teammate may have deleted it first).
export async function deleteTask(dir: string, id: string): Promise<void> {
  if (!isTaskId(id)) throw new Error('Invalid task')
  await fsp.rm(join(dir, TM_DIR, 'tasks', `${id}.json`), { force: true })
  await fsp.rm(join(dir, TM_DIR, 'notes', id), { recursive: true, force: true })
  await fsp.rm(join(dir, TM_DIR, 'attachments', id), { recursive: true, force: true })
}

// Screenshots pasted into a task. Files come from teammates too, so names and size are checked on every read and write.
export const IMG_MAX_BYTES = 4 * 1024 * 1024
export const IMG_MAX_PER_TASK = 10
const IMG_MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }
const isImageName = (f: string): boolean => /^[\w-]{1,40}\.(png|jpg|webp|gif)$/.test(f)
export const attachDir = (dir: string, id: string): string => join(dir, TM_DIR, 'attachments', id)

export async function listImages(dir: string, id: string): Promise<string[]> {
  if (!isTaskId(id)) return []
  return (await names(attachDir(dir, id))).filter(isImageName).sort()
}

export async function addImage(dir: string, id: string, b64: string, ext: string, now = Date.now()): Promise<string> {
  if (!isTaskId(id)) throw new Error('Invalid task')
  if (!Object.hasOwn(IMG_MIME, ext)) throw new Error('Only png, jpg, webp and gif images')
  const bytes = Buffer.from(b64, 'base64')
  if (!bytes.length) throw new Error('Empty image')
  if (bytes.length > IMG_MAX_BYTES) throw new Error('Image is over 4 MB')
  if ((await listImages(dir, id)).length >= IMG_MAX_PER_TASK) throw new Error('A task keeps at most 10 screenshots')
  const file = `${now}.${ext}`
  await fsp.mkdir(attachDir(dir, id), { recursive: true })
  await fsp.writeFile(join(attachDir(dir, id), file), bytes)
  return file
}

export async function readImage(dir: string, id: string, file: string): Promise<string> {
  if (!isTaskId(id) || !isImageName(file)) throw new Error('Invalid image')
  const p = join(attachDir(dir, id), file)
  if ((await fsp.stat(p)).size > IMG_MAX_BYTES) throw new Error('Image is over 4 MB')
  const bytes = await fsp.readFile(p)
  return `data:${IMG_MIME[file.split('.')[1]]};base64,${bytes.toString('base64')}`
}

export async function removeImage(dir: string, id: string, file: string): Promise<void> {
  if (!isTaskId(id) || !isImageName(file)) throw new Error('Invalid image')
  await fsp.rm(join(attachDir(dir, id), file), { force: true })
}

// .taskmaster/plugin is a Claude Code plugin ("team"): skills/<name>/SKILL.md, loaded with --plugin-dir.
export const pluginDir = (dir: string): string => join(dir, TM_DIR, 'plugin')

export async function listSkills(dir: string): Promise<Skill[]> {
  const base = join(pluginDir(dir), 'skills')
  const out: Skill[] = []
  for (const name of await names(base)) {
    let text = ''
    try { text = await fsp.readFile(join(base, name, 'SKILL.md'), 'utf8') } catch { continue }
    const s = parseSkill(name, text)
    if (!s) continue
    try { s.source = (await fsp.readFile(join(base, name, '.source'), 'utf8')).trim().slice(0, 300) || undefined } catch { /* not imported */ }
    out.push(s)
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export async function writeSkill(dir: string, skill: Skill): Promise<void> {
  if (!isSkillName(skill.name)) throw new Error('Invalid skill name')
  if (!skill.body.trim()) throw new Error('Empty skill')
  await put(dir, ['plugin', '.claude-plugin', 'plugin.json'], json({ name: 'team', description: 'Skills shared by this team through Taskmaster', version: '1.0.0' }))
  await put(dir, ['plugin', 'skills', skill.name, 'SKILL.md'], renderSkill(skill))
}

// A skill imported from GitHub keeps its whole folder (scripts, references); .source remembers where it came from.
export async function writeSkillFiles(dir: string, name: string, files: { rel: string; bytes: Buffer }[], source: string): Promise<void> {
  if (!isSkillName(name)) throw new Error('Invalid skill name')
  if (!files.some((x) => x.rel === 'SKILL.md')) throw new Error('No SKILL.md in the skill folder')
  if (files.some((x) => !isSafeRelPath(x.rel))) throw new Error('Unsafe file path in the skill folder')
  const root = join(pluginDir(dir), 'skills', name)
  await fsp.rm(root, { recursive: true, force: true })
  for (const x of files) {
    const p = join(root, ...x.rel.split('/'))
    await fsp.mkdir(join(p, '..'), { recursive: true })
    await fsp.writeFile(p, x.bytes)
  }
  await fsp.writeFile(join(root, '.source'), `${source.slice(0, 300)}\n`)
  await put(dir, ['plugin', '.claude-plugin', 'plugin.json'], json({ name: 'team', description: 'Skills shared by this team through Taskmaster', version: '1.0.0' }))
}

export async function deleteSkill(dir: string, name: string): Promise<void> {
  if (!isSkillName(name)) throw new Error('Invalid skill name')
  await fsp.rm(join(pluginDir(dir), 'skills', name), { recursive: true, force: true })
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
