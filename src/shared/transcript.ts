import { parseClaudeLine, type AgentEvent } from './agent'

// Claude Code keeps every conversation as <config>/projects/<project folder>/<session id>.jsonl.
export interface PastSession { id: string; title: string; at: string; messages: number }
export type TranscriptEntry = { kind: 'user'; text: string } | { kind: 'event'; ev: AgentEvent }

const KEEP = 400
type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})

// Text of a real prompt typed by the user; null for tool results, hooks and slash-command wrappers.
function promptText(content: unknown): string | null {
  const raw = typeof content === 'string' ? content
    : Array.isArray(content) && !content.some((b) => obj(b).type === 'tool_result')
      ? content.filter((b) => obj(b).type === 'text' && typeof obj(b).text === 'string').map((b) => obj(b).text as string).join('\n')
      : ''
  const t = raw.trim()
  return t && !/^<(command-|local-command|system-reminder|ide_)|^Caveat:/.test(t) ? t : null
}

function eachLine(text: string, fn: (o: Obj, line: string) => void): void {
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    let o: Obj
    try { o = obj(JSON.parse(line)) } catch { continue }
    if (o.isSidechain === true) continue
    fn(o, line)
  }
}

export function parseTranscript(text: string): TranscriptEntry[] {
  const out: TranscriptEntry[] = []
  eachLine(text, (o, line) => {
    if (o.type === 'user') {
      const p = promptText(obj(o.message).content)
      if (p) { out.push({ kind: 'user', text: p }); return }
    }
    if (o.type === 'user' || o.type === 'assistant') for (const ev of parseClaudeLine(line)) out.push({ kind: 'event', ev })
  })
  return out.length > KEEP ? out.slice(-KEEP) : out
}

export function sessionTitle(text: string): string {
  let title = ''
  eachLine(text, (o) => {
    if (title || o.type !== 'user') return
    title = promptText(obj(o.message).content)?.replace(/\s+/g, ' ').slice(0, 80) ?? ''
  })
  return title
}

export function countPrompts(text: string): number {
  let n = 0
  eachLine(text, (o) => { if (o.type === 'user' && promptText(obj(o.message).content)) n++ })
  return n
}
