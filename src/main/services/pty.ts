import { homedir } from 'os'
import type { IPty } from '@lydell/node-pty'
import { handle, emit } from '../ipc'
import { state } from '../state'
import { log } from '../log'

type PtyModule = typeof import('@lydell/node-pty')
let mod: PtyModule | null | undefined

// Loaded lazily; if the native module fails the app still works without a terminal (spec §3).
function load(): PtyModule | null {
  if (mod === undefined) {
    try { mod = require('@lydell/node-pty') as PtyModule } catch (e) { log('pty load failed', e); mod = null }
  }
  return mod
}

const terms = new Map<number, IPty>()
let seq = 0

export function killAllPty(): void {
  for (const p of terms.values()) { try { p.kill() } catch { /* already gone */ } }
  terms.clear()
}

export function registerPty(): void {
  handle('pty.available', async () => !!load())
  handle('pty.create', async ({ cols, rows, cmd }) => {
    const m = load()
    if (!m) throw new Error('Terminal unavailable')
    const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash'
    const p = m.spawn(shell, [], {
      name: 'xterm-256color', cols: Math.max(cols, 2), rows: Math.max(rows, 1),
      cwd: state.root ?? homedir(), env: process.env as Record<string, string>
    })
    const id = ++seq
    terms.set(id, p)
    p.onData((data) => emit('pty.data', { id, data }))
    p.onExit(({ exitCode }) => { terms.delete(id); emit('pty.exit', { id, code: exitCode }) })
    if (cmd) p.write(cmd + '\r')
    return id
  })
  handle('pty.write', async (id, data) => { terms.get(id)?.write(data) })
  handle('pty.resize', async (id, cols, rows) => {
    try { terms.get(id)?.resize(Math.max(cols, 2), Math.max(rows, 1)) } catch { /* exited */ }
  })
  handle('pty.kill', async (id) => {
    try { terms.get(id)?.kill() } catch { /* exited */ }
    terms.delete(id)
  })
}
