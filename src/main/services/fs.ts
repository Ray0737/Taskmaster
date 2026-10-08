import { shell } from 'electron'
import { promises as fsp, statSync, watch, type FSWatcher } from 'fs'
import { resolve, sep, join, dirname } from 'path'
import type { FileEntry, FileContent } from '@shared/types'
import { handle, emit } from '../ipc'
import { state } from '../state'
import { log } from '../log'
import { exists } from '../util'

const HIDDEN = new Set(['.git', 'node_modules'])
export const IGNORED_RE = /(^|[\\/])(\.git|node_modules)([\\/]|$)/
const MAX_OPEN = 20 * 1024 * 1024
const READONLY_OVER = 5 * 1024 * 1024
const norm = (s: string): string => (process.platform === 'win32' ? s.toLowerCase() : s)

// Every renderer-supplied path goes through this. Throws if it leaves the project root.
export function inside(root: string | null, p: string): string {
  if (!root) throw new Error('No project open')
  const r = resolve(root)
  const x = resolve(r, p)
  if (norm(x) !== norm(r) && !norm(x).startsWith(norm(r + sep))) throw new Error('Path outside project')
  return x
}

export async function listDir(dir: string): Promise<FileEntry[]> {
  const ents = await fsp.readdir(dir, { withFileTypes: true })
  return ents
    .filter((e) => !HIDDEN.has(e.name))
    .map((e) => ({ name: e.name, path: join(dir, e.name), dir: e.isDirectory() }))
    .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) : a.dir ? -1 : 1))
}

export async function readFileContent(p: string): Promise<FileContent> {
  let size: number
  try { size = (await fsp.stat(p)).size } catch { return { kind: 'missing' } }
  if (size > MAX_OPEN) return { kind: 'tooBig' }
  const buf = await fsp.readFile(p)
  if (buf.subarray(0, 8000).includes(0)) return { kind: 'binary' }
  return { kind: 'text', text: buf.toString('utf8'), readonly: size > READONLY_OVER }
}

// ponytail: plain directory walk capped at 50k files. Upgrade path: `git ls-files` in a worker.
export async function walk(root: string, cap = 50000): Promise<string[]> {
  const out: string[] = []
  const stack = ['']
  while (stack.length && out.length < cap) {
    const rel = stack.pop()!
    let ents
    try { ents = await fsp.readdir(join(root, rel), { withFileTypes: true }) } catch { continue }
    for (const e of ents) {
      if (HIDDEN.has(e.name)) continue
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) stack.push(r)
      else out.push(r)
      if (out.length >= cap) break
    }
  }
  return out.sort()
}

let watcher: FSWatcher | null = null
const timers = new Map<string, NodeJS.Timeout>()

export function stopWatch(): void { watcher?.close(); watcher = null }

export function watchRoot(root: string): void {
  stopWatch()
  try {
    watcher = watch(root, { recursive: true }, (_ev, name) => {
      if (!name || IGNORED_RE.test(String(name))) return
      const abs = join(root, String(name))
      clearTimeout(timers.get(abs))
      timers.set(abs, setTimeout(() => { timers.delete(abs); emit('fs.changed', { path: abs }) }, 100))
    })
    watcher.on('error', (e) => log('watch error', e))
  } catch (e) {
    log('watch failed', e)
  }
}

export function registerFs(): void {
  handle('fs.list', async (dir) => listDir(inside(state.root, dir)))
  handle('fs.read', async (p) => readFileContent(inside(state.root, p)))
  handle('fs.write', async (p, text) => { await fsp.writeFile(inside(state.root, p), text, 'utf8') })
  handle('fs.create', async (p, dir) => {
    const x = inside(state.root, p)
    if (await exists(x)) throw new Error('Already exists')
    if (dir) await fsp.mkdir(x, { recursive: true })
    else { await fsp.mkdir(dirname(x), { recursive: true }); await fsp.writeFile(x, '', { flag: 'wx' }) }
  })
  handle('fs.rename', async (from, to) => {
    const target = inside(state.root, to)
    if (await exists(target)) throw new Error('Already exists')
    await fsp.rename(inside(state.root, from), target)
  })
  handle('fs.delete', async (p) => {
    const x = inside(state.root, p)
    if (norm(x) === norm(resolve(state.root!))) throw new Error('Cannot delete the project folder')
    await shell.trashItem(x)
  })
  handle('fs.reveal', async (p) => shell.showItemInFolder(inside(state.root, p)))
  handle('fs.listAll', async () => walk(inside(state.root, '.')))
  handle('project.open', async (p) => {
    const root = resolve(p)
    if (!statSync(root).isDirectory()) throw new Error('Not a folder')
    state.root = root
    watchRoot(root)
    return root
  })
}
