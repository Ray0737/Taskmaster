export type AgentEvent =
  | { t: 'init'; sessionId: string; model?: string }
  | { t: 'delta'; text: string } // live text, to be replaced by the next 'text'
  | { t: 'text'; text: string } // a completed assistant text block
  | { t: 'tool'; id: string; name: string; input: Record<string, unknown> }
  | { t: 'toolResult'; id: string; text: string; isError: boolean }
  | { t: 'result'; ok: boolean; text: string; sessionId: string | null; inTokens: number; outTokens: number; costUsd: number | null; errors: string[]; denials: string[] }
  | { t: 'limit'; kind: string; status: string; utilization: number | null; resetsAt: number | null } // plan usage window, from rate_limit_event
  | { t: 'stopped' } // user pressed Stop; no result follows (parseClaudeLine never returns it)

// Model ids for --model. Short aliases (opus/sonnet/haiku) resolve to older models on the installed CLI, so full ids are used. '' keeps the CLI default.
export const CLAUDE_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] as const
export const CLAUDE_MODEL_LABEL: Record<(typeof CLAUDE_MODELS)[number], string> = { 'claude-opus-5-5': 'Opus 5.5', 'claude-sonnet-5-5': 'Sonnet 5.5', 'claude-haiku-5-5': 'Haiku 5.5' }

const MAX_LINES = 200
const MAX_CHARS = 20000

// Strips <system-reminder> blocks, caps size.
export function cleanToolText(s: string): string {
  let t = s.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim()
  const lines = t.split(/\r?\n/)
  if (lines.length > MAX_LINES) t = lines.slice(0, MAX_LINES).join('\n') + '\n…'
  if (t.length > MAX_CHARS) t = t.slice(0, MAX_CHARS) + '…'
  return t
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})

// One NDJSON line of `claude -p --output-format stream-json` -> zero or more UI events.
// Unknown line types are ignored on purpose: user hooks and new CLI versions add many.
export function parseClaudeLine(line: string): AgentEvent[] {
  const s = line.trim()
  if (!s) return []
  let o: Obj
  try { o = obj(JSON.parse(s)) } catch { return [] }
  if (o.parent_tool_use_id) return [] // sub-agent traffic
  switch (o.type) {
    case 'system':
      return o.subtype === 'init' && typeof o.session_id === 'string' ? [{ t: 'init', sessionId: o.session_id, ...(typeof o.model === 'string' ? { model: o.model } : {}) }] : []
    case 'stream_event': {
      const d = obj(obj(o.event).delta)
      return d.type === 'text_delta' && typeof d.text === 'string' && d.text ? [{ t: 'delta', text: d.text }] : []
    }
    case 'assistant': {
      const out: AgentEvent[] = []
      const blocks = obj(o.message).content
      for (const b of Array.isArray(blocks) ? blocks : []) {
        const c = obj(b)
        if (c.type === 'text' && typeof c.text === 'string' && c.text.trim()) out.push({ t: 'text', text: c.text })
        else if (c.type === 'tool_use' && typeof c.id === 'string' && typeof c.name === 'string') out.push({ t: 'tool', id: c.id, name: c.name, input: obj(c.input) })
      }
      return out
    }
    case 'user': {
      const out: AgentEvent[] = []
      const blocks = obj(o.message).content
      for (const b of Array.isArray(blocks) ? blocks : []) {
        const c = obj(b)
        if (c.type !== 'tool_result' || typeof c.tool_use_id !== 'string') continue
        const raw = typeof c.content === 'string' ? c.content
          : Array.isArray(c.content) ? c.content.map((x) => (typeof obj(x).text === 'string' ? (obj(x).text as string) : '')).filter(Boolean).join('\n') : ''
        out.push({ t: 'toolResult', id: c.tool_use_id, text: cleanToolText(raw), isError: c.is_error === true })
      }
      return out
    }
    case 'result': {
      const u = obj(o.usage)
      const denials = Array.isArray(o.permission_denials) ? o.permission_denials.map((d) => String(obj(d).tool_name ?? '')).filter(Boolean) : []
      return [{
        t: 'result',
        ok: o.is_error !== true && o.subtype === 'success',
        text: typeof o.result === 'string' ? o.result : '',
        sessionId: typeof o.session_id === 'string' ? o.session_id : null,
        inTokens: num(u.input_tokens) + num(u.cache_creation_input_tokens) + num(u.cache_read_input_tokens),
        outTokens: num(u.output_tokens),
        costUsd: typeof o.total_cost_usd === 'number' ? o.total_cost_usd : null,
        errors: Array.isArray(o.errors) ? o.errors.map(String) : [],
        denials
      }]
    }
    case 'rate_limit_event': {
      const r = obj(o.rate_limit_info)
      return typeof r.rateLimitType === 'string'
        ? [{ t: 'limit', kind: r.rateLimitType, status: String(r.status ?? ''), utilization: typeof r.utilization === 'number' ? r.utilization : null, resetsAt: typeof r.resetsAt === 'number' ? r.resetsAt : null }]
        : []
    }
    default:
      return []
  }
}

// ponytail: keyword match on CLI error text; the CLI has no stable error code for "not logged in".
export const needsLogin = (text: string): boolean => /not logged in|\/login|api key|authenticat|unauthori[sz]ed|\b401\b|oauth/i.test(text)
