import { writeFileSync, renameSync, mkdirSync, promises as fsp } from 'fs'
import { dirname } from 'path'

export function writeJsonAtomic(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file + '.tmp', JSON.stringify(data, null, 2))
  renameSync(file + '.tmp', file)
}

export async function exists(p: string): Promise<boolean> {
  try { await fsp.access(p); return true } catch { return false }
}
