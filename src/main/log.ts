import { app } from 'electron'
import { appendFileSync, statSync, renameSync, mkdirSync } from 'fs'
import { join } from 'path'

export const logDir = (): string => join(app.getPath('userData'), 'logs')

// Never pass tokens or credentials to log().
export function log(...parts: unknown[]): void {
  try {
    const dir = logDir()
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'main.log')
    try { if (statSync(file).size > 5 * 1024 * 1024) renameSync(file, join(dir, 'main.1.log')) } catch { /* no file yet */ }
    const line = parts.map(p => (p instanceof Error ? p.stack : typeof p === 'string' ? p : JSON.stringify(p))).join(' ')
    appendFileSync(file, `${new Date().toISOString()} ${line}\n`)
  } catch { /* logging must never crash the app */ }
}
