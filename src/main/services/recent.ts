import { app } from 'electron'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import type { RecentProject } from '@shared/types'
import { basename } from '@shared/paths'
import { handle } from '../ipc'
import { exists, writeJsonAtomic } from '../util'

const key = (p: string): string => (process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p))

export function pushRecent(list: RecentProject[], path: string, now = new Date().toISOString()): RecentProject[] {
  const rest = list.filter((r) => key(r.path) !== key(path))
  return [{ path, name: basename(path), lastOpened: now }, ...rest].slice(0, 20)
}

export function registerRecent(): void {
  const file = join(app.getPath('userData'), 'recent.json')
  const read = (): RecentProject[] => {
    try {
      const v = JSON.parse(readFileSync(file, 'utf8'))
      return Array.isArray(v) ? v.filter((r) => r && typeof r.path === 'string') : []
    } catch { return [] }
  }
  handle('recent.list', async () => {
    const all = read()
    const flags = await Promise.all(all.map((r) => exists(r.path)))
    return all.filter((_, i) => flags[i])
  })
  handle('recent.add', async (p) => writeJsonAtomic(file, pushRecent(read(), p)))
  handle('recent.remove', async (p) => {
    const next = read().filter((r) => key(r.path) !== key(p))
    writeJsonAtomic(file, next)
    return next
  })
}
