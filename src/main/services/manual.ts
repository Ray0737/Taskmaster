import { app } from 'electron'
import { promises as fsp } from 'fs'
import { join } from 'path'
import type { ManualChapter } from '@shared/types'
import { handle } from '../ipc'

export const manualDir = (): string =>
  app.isPackaged ? join(process.resourcesPath, 'manual') : join(app.getAppPath(), 'resources', 'manual')

export const safeChapterFile = (f: string): boolean => /^[\w-]+\.md$/.test(f)

export function parseChapter(file: string, md: string): ManualChapter {
  const lines = md.split(/\r?\n/)
  const title = lines.find((l) => l.startsWith('# '))?.slice(2).trim() ?? file.replace(/\.md$/, '')
  const headings = lines.filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim())
  return { file, title, headings }
}

export function registerManual(): void {
  handle('manual.list', async (lang) => {
    const dir = join(manualDir(), lang === 'th' ? 'th' : 'en')
    const files = (await fsp.readdir(dir)).filter(safeChapterFile).sort()
    return Promise.all(files.map(async (f) => parseChapter(f, await fsp.readFile(join(dir, f), 'utf8'))))
  })
  handle('manual.read', async (lang, file) => {
    if (!safeChapterFile(file)) throw new Error('Bad chapter name')
    return fsp.readFile(join(manualDir(), lang === 'th' ? 'th' : 'en', file), 'utf8')
  })
}
