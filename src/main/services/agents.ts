import { execFile, spawn } from 'child_process'
import { existsSync, readFileSync, promises as fsp } from 'fs'
import { homedir } from 'os'
import { parseTranscript, sessionTitle, countPrompts, type PastSession, type TranscriptEntry } from '@shared/transcript'
import { join, dirname, delimiter } from 'path'
import { createHash } from 'crypto'
import { app } from 'electron'
import type { AgentInfo, AgentMode } from '@shared/types'
import { parseClaudeLine, type AgentEvent } from '@shared/agent'
import { handle, emit } from '../ipc'
import { state } from '../state'
import { log } from '../log'
import { writeJsonAtomic } from '../util'

interface Known { id: string; label: string; bin: string; kind: 'claude' | 'basic' }
const KNOWN: Known[] = [
  { id: 'claude', label: 'Claude Code', bin: 'claude', kind: 'claude' },
  { id: 'codex', label: 'Codex CLI', bin: 'codex', kind: 'basic' },
  { id: 'gemini', label: 'Gemini CLI', bin: 'gemini', kind: 'basic' },
  { id: 'aider', label: 'Aider', bin: 'aider', kind: 'basic' },
  { id: 'opencode', label: 'opencode', bin: 'opencode', kind: 'basic' }
]

export const defaultExts = (): string[] => (process.platform === 'win32' ? ['.exe', '.cmd', '.bat', '.com'] : [''])

export function findOnPath(name: string, pathEnv: string, exts: string[]): string | null {
  for (const dir of pathEnv.split(delimiter).filter(Boolean)) {
    for (const e of exts) {
      const f = join(dir, name + e)
      if (existsSync(f)) return f
    }
  }
  return null
}

// Node cannot start .cmd/.bat files without a shell, and a shell would parse the prompt text.
// npm's launcher scripts only forward to a real program, so run that program directly.
export function resolveCommand(file: string): { cmd: string; prefix: string[] } {
  if (!/\.(cmd|bat)$/i.test(file)) return { cmd: file, prefix: [] }
  const txt = readFileSync(file, 'utf8')
  const dir = dirname(file)
  const js = /"%dp0%\\([^"]+?\.(?:c|m)?js)"/i.exec(txt) // checked first: JS shims also mention node.exe
  if (js) return { cmd: 'node', prefix: [join(dir, js[1])] }
  const exe = /"%dp0%\\([^"]+?\.exe)"/i.exec(txt)
  if (exe) return { cmd: join(dir, exe[1]), prefix: [] }
  throw new Error(`Cannot run ${file}: unsupported launcher script`)
}

function versionOf(cmd: string, prefix: string[]): Promise<string | null> {
  return new Promise((res) => {
    execFile(cmd, [...prefix, '--version'], { timeout: 5000, windowsHide: true, encoding: 'utf8' }, (err, out) => {
      if (err) return res(null)
      const first = out.trim().split(/\r?\n/)[0] ?? ''
      res(/(\d+\.\d+[\w.-]*)/.exec(first)?.[1] ?? (first.slice(0, 40) || null))
    })
  })
}

export async function detectAgents(pathEnv = process.env.PATH ?? '', exts = defaultExts()): Promise<AgentInfo[]> {
  const found = await Promise.all(KNOWN.map(async (k): Promise<AgentInfo | null> => {
    const file = findOnPath(k.bin, pathEnv, exts)
    if (!file) return null
    try {
      const { cmd, prefix } = resolveCommand(file)
      const version = await versionOf(cmd, prefix)
      return version ? { id: k.id, label: k.label, bin: file, version, kind: k.kind } : null
    } catch (e) {
      log('agent detect failed', k.id, e)
      return null
    }
  }))
  return found.filter((a): a is AgentInfo => a !== null)
}

export function claudeArgs(o: { system: string; mode: AgentMode; sessionId?: string | null }): string[] {
  return [
    '-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-mode', o.mode,
    ...(o.system ? ['--append-system-prompt', o.system] : []),
    ...(o.sessionId ? ['--resume', o.sessionId] : [])
  ]
}

// ponytail: best-effort one-shot invocations from the CLIs' docs; no sessions, no tool rows.
// Upgrade path: a per-agent adapter with a real parser once one of them is used daily.
export function basicArgs(id: string, prompt: string): string[] | null {
  switch (id) {
    case 'codex': return ['exec', prompt]
    case 'gemini': return ['-p', prompt]
    case 'aider': return ['--message', prompt, '--yes']
    case 'opencode': return ['run', prompt]
    default: return null
  }
}

const lastLines = (s: string): string => s.trim().split(/\r?\n/).filter(Boolean).slice(-3).join('\n')

export interface StreamSpec { cmd: string; args: string[]; cwd: string; input?: string; parse: 'claude' | 'text' }

// Spawns the agent, turns its output into AgentEvents, guarantees exactly one terminal event
// (a 'result', or 'stopped' after stop()) and exactly one onExit call.
export function streamProcess(spec: StreamSpec, onEvent: (e: AgentEvent) => void, onExit: (code: number | null) => void): { stop(): void } {
  const child = spawn(spec.cmd, spec.args, {
    cwd: spec.cwd, windowsHide: true, env: process.env, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe']
  })
  let buf = '', all = '', err = ''
  let sawResult = false, done = false, stopped = false

  const feed = (l: string): void => {
    for (const ev of parseClaudeLine(l)) {
      if (ev.t === 'result') sawResult = true
      onEvent(ev)
    }
  }
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (d: string) => {
    if (spec.parse === 'text') { all += d; onEvent({ t: 'delta', text: d }); return }
    buf += d
    for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) { feed(buf.slice(0, i)); buf = buf.slice(i + 1) }
  })
  child.stderr.on('data', (d: string) => { err = (err + d).slice(-8000) })

  const fail = (code: number | null): AgentEvent => ({
    t: 'result', ok: false, text: '', sessionId: null, inTokens: 0, outTokens: 0, costUsd: null, denials: [],
    errors: [lastLines(err) || `Agent exited with code ${code}`]
  })
  const finish = (code: number | null): void => {
    if (done) return
    done = true
    if (spec.parse === 'claude' && buf.trim()) feed(buf)
    if (stopped) onEvent({ t: 'stopped' })
    else if (spec.parse === 'text') {
      if (all.trim()) onEvent({ t: 'text', text: all.trim() })
      onEvent(code === 0
        ? { t: 'result', ok: true, text: all.trim(), sessionId: null, inTokens: 0, outTokens: 0, costUsd: null, errors: [], denials: [] }
        : fail(code))
    } else if (!sawResult) onEvent(fail(code))
    onExit(code)
  }
  child.on('error', (e) => { err += `\n${e.message}`; finish(null) })
  child.on('close', (code) => finish(code))
  child.stdin.on('error', () => {}) // EPIPE if the program exits before reading
  child.stdin.end(spec.input ?? '')

  return {
    stop() {
      stopped = true
      if (!child.pid) return
      if (process.platform === 'win32') execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {})
      else { try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill() } }
    }
  }
}

let detected: AgentInfo[] | null = null
const runs = new Map<number, { stop(): void }>()

const sessionFile = (): string =>
  join(app.getPath('userData'), 'sessions', createHash('sha1').update(state.root ?? '').digest('hex').slice(0, 12) + '.json')
const readSessionMap = (): Record<string, string> => {
  try { return JSON.parse(readFileSync(sessionFile(), 'utf8')) as Record<string, string> } catch { return {} }
}

// Claude Code stores a project's conversations under <config>/projects/<project path with every non-alphanumeric as "-">.
const claudeProjectDir = (root: string): string =>
  join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'projects', root.replace(/[^A-Za-z0-9]/g, '-'))

const READ_CAP = 2_000_000 // characters per session file used for the list (title and count)

export async function listSessions(root: string): Promise<PastSession[]> {
  const dir = claudeProjectDir(root)
  let names: string[]
  try { names = (await fsp.readdir(dir)).filter((f) => /^[\w-]{8,64}\.jsonl$/.test(f)) } catch { return [] }
  const stamped = await Promise.all(names.map(async (f) => ({ f, m: (await fsp.stat(join(dir, f))).mtimeMs })))
  const out: PastSession[] = []
  for (const { f, m } of stamped.sort((a, b) => b.m - a.m).slice(0, 30)) {
    const text = (await fsp.readFile(join(dir, f), 'utf8')).slice(0, READ_CAP)
    const title = sessionTitle(text)
    if (title) out.push({ id: f.slice(0, -6), title, at: new Date(m).toISOString(), messages: countPrompts(text) }) // no prompt = hook-only noise
  }
  return out
}

export async function loadTranscript(root: string, id: string): Promise<TranscriptEntry[]> {
  if (!/^[\w-]{8,64}$/.test(id)) throw new Error('Bad session id') // becomes a file name
  return parseTranscript(await fsp.readFile(join(claudeProjectDir(root), id + '.jsonl'), 'utf8'))
}

export function registerAgents(): void {
  handle('agent.sessions', async () => (state.root ? listSessions(state.root) : []))
  handle('agent.transcript', async (id) => {
    if (!state.root) throw new Error('No project open')
    return loadTranscript(state.root, id)
  })
  handle('agent.detect', async () => (detected = await detectAgents()))
  handle('agent.run', async (o) => {
    if (!state.root) throw new Error('No project open')
    const agent = (detected ??= await detectAgents()).find((a) => a.id === o.agentId)
    if (!agent) throw new Error('Agent not found — rescan in Settings → Agents')
    const { cmd, prefix } = resolveCommand(agent.bin)
    const basic = agent.kind === 'basic'
    const full = o.system ? `${o.system}\n\n---\n\n${o.prompt}` : o.prompt
    const args = basic ? basicArgs(agent.id, full) : claudeArgs({ system: o.system, mode: o.mode, sessionId: o.sessionId })
    if (!args) throw new Error(`No adapter for ${agent.id}`)
    const h = streamProcess(
      { cmd, args: [...prefix, ...args], cwd: state.root, input: basic ? '' : o.prompt, parse: basic ? 'text' : 'claude' },
      (ev) => emit('agent.event', { runId: o.runId, ev }),
      (code) => { runs.delete(o.runId); emit('agent.exit', { runId: o.runId, code }) }
    )
    runs.set(o.runId, h)
  })
  handle('agent.stop', async (id) => { runs.get(id)?.stop() })
  handle('agent.sessionGet', async (key) => readSessionMap()[key] ?? null)
  handle('agent.sessionSet', async (key, id) => {
    const m = readSessionMap()
    if (id) m[key] = id
    else delete m[key]
    writeJsonAtomic(sessionFile(), m)
  })
}
