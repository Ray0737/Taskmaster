import type { AgentEvent } from '@shared/agent'
import { needsLogin } from '@shared/agent'
import { writtenPath, outsideScope } from '@shared/scope'

export type Item =
  | { id: number; kind: 'user'; text: string }
  | { id: number; kind: 'assistant'; text: string; live: boolean }
  | { id: number; kind: 'tool'; toolId: string; name: string; input: Record<string, unknown>; result?: { text: string; isError: boolean } }
  | { id: number; kind: 'notice'; level: 'error' | 'warn' | 'info'; key?: string; vars?: Record<string, string>; raw?: string; action?: 'login' | 'retry' }

// An Item without its id (Omit does not distribute over unions, so spell it out).
export type NewItem = Item extends infer I ? (I extends { id: number } ? Omit<I, 'id'> : never) : never

export interface ReduceCtx { root: string; scope: string[] }
export const MAX_ITEMS = 400

// Pure: folds one agent event into the transcript. Text for notices is an i18n key + vars, translated at render time.
export function reduceEvent(items: Item[], ev: AgentEvent, ctx: ReduceCtx, nextId: () => number): Item[] {
  const last = items[items.length - 1]
  const liveLast = last?.kind === 'assistant' && last.live
  let out: Item[] = items
  switch (ev.t) {
    case 'delta':
      out = liveLast
        ? [...items.slice(0, -1), { ...last, text: last.text + ev.text }]
        : [...items, { id: nextId(), kind: 'assistant', text: ev.text, live: true }]
      break
    case 'text':
      out = liveLast
        ? [...items.slice(0, -1), { ...last, text: ev.text, live: false }]
        : [...items, { id: nextId(), kind: 'assistant', text: ev.text, live: false }]
      break
    case 'tool': {
      out = [...items, { id: nextId(), kind: 'tool', toolId: ev.id, name: ev.name, input: ev.input }]
      const rel = writtenPath({ name: ev.name, input: ev.input }, ctx.root)
      if (rel && outsideScope(ctx.scope, rel)) out.push({ id: nextId(), kind: 'notice', level: 'warn', key: 'agent.outside', vars: { path: rel } })
      break
    }
    case 'toolResult':
      out = items.map((i) => (i.kind === 'tool' && i.toolId === ev.id ? { ...i, result: { text: ev.text, isError: ev.isError } } : i))
      break
    case 'result': {
      out = items.map((i) => (i.kind === 'assistant' && i.live ? { ...i, live: false } : i))
      if (!ev.ok) {
        const raw = (ev.errors.join('\n') || ev.text).trim()
        const login = needsLogin(raw)
        out = [...out, { id: nextId(), kind: 'notice', level: 'error', key: login ? 'agent.loginHelp' : raw ? undefined : 'agent.failed', raw: raw || undefined, action: login ? 'login' : 'retry' }]
      }
      if (ev.denials.length) {
        out = [...out, { id: nextId(), kind: 'notice', level: 'warn', key: 'agent.denied', vars: { tools: [...new Set(ev.denials)].join(', ') } }]
      }
      break
    }
    case 'stopped':
      out = [...items, { id: nextId(), kind: 'notice', level: 'info', key: 'agent.stopped' }]
      break
    default:
      break // 'init' is handled by the store
  }
  return out.length > MAX_ITEMS ? out.slice(-MAX_ITEMS) : out
}
