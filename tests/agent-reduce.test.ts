import { it, expect } from 'vitest'
import { reduceEvent, MAX_ITEMS, type Item } from '../src/renderer/src/stores/agentReduce'
import type { AgentEvent } from '../src/shared/agent'

const ctx = { root: 'C:\\proj', scope: [] as string[] }
const mk = () => { let n = 0; return () => ++n }
const run = (evs: AgentEvent[], c = ctx, start: Item[] = []) => { const id = mk(); return evs.reduce((items, ev) => reduceEvent(items, ev, c, id), start) }
const result = (o: Partial<Extract<AgentEvent, { t: 'result' }>> = {}): AgentEvent =>
  ({ t: 'result', ok: true, text: '', sessionId: null, inTokens: 0, outTokens: 0, costUsd: null, errors: [], denials: [], ...o })

it('deltas build one live message; the full text replaces it; the next delta starts a new one', () => {
  let items = run([{ t: 'delta', text: 'Hel' }, { t: 'delta', text: 'lo' }])
  expect(items).toMatchObject([{ kind: 'assistant', text: 'Hello', live: true }])
  items = run([{ t: 'text', text: 'Hello world' }], ctx, items)
  expect(items).toMatchObject([{ kind: 'assistant', text: 'Hello world', live: false }])
  items = run([{ t: 'delta', text: 'X' }], ctx, items)
  expect(items).toHaveLength(2)
  expect(items[1]).toMatchObject({ text: 'X', live: true })
})

it('a text block with no deltas (basic agents) still shows', () => {
  expect(run([{ t: 'text', text: 'All done' }])).toMatchObject([{ kind: 'assistant', text: 'All done', live: false }])
})

it('tool results attach to their tool call', () => {
  const items = run([
    { t: 'tool', id: 'a', name: 'Read', input: { file_path: 'C:\\proj\\x.ts' } },
    { t: 'tool', id: 'b', name: 'Bash', input: { command: 'ls' } },
    { t: 'toolResult', id: 'a', text: 'file body', isError: false },
    { t: 'toolResult', id: 'b', text: 'nope', isError: true }
  ])
  expect(items).toMatchObject([
    { kind: 'tool', toolId: 'a', result: { text: 'file body', isError: false } },
    { kind: 'tool', toolId: 'b', result: { text: 'nope', isError: true } }
  ])
})

it('scope warning only for writes outside the task globs', () => {
  const scoped = { root: 'C:\\proj', scope: ['src/ui/**'] }
  const edit = (p: string): AgentEvent => ({ t: 'tool', id: 'e', name: 'Edit', input: { file_path: p } })
  expect(run([edit('C:\\proj\\src\\ui\\A.tsx')], scoped)).toHaveLength(1)
  const out = run([edit('C:\\proj\\src\\db\\x.ts')], scoped)
  expect(out).toHaveLength(2)
  expect(out[1]).toMatchObject({ kind: 'notice', level: 'warn', key: 'agent.outside', vars: { path: 'src/db/x.ts' } })
  expect(run([{ t: 'tool', id: 'r', name: 'Read', input: { file_path: 'C:\\proj\\src\\db\\x.ts' } }], scoped)).toHaveLength(1)
  expect(run([edit('C:\\proj\\src\\db\\x.ts')], ctx)).toHaveLength(1) // empty scope = no check
})

it('failed result: error notice with retry; login problems get the login action', () => {
  const fail = run([result({ ok: false, errors: ['Agent exited with code 3'] })])
  expect(fail[0]).toMatchObject({ kind: 'notice', level: 'error', raw: 'Agent exited with code 3', action: 'retry' })
  const login = run([result({ ok: false, errors: ['Invalid API key · Please run /login'] })])
  expect(login[0]).toMatchObject({ kind: 'notice', level: 'error', key: 'agent.loginHelp', action: 'login' })
  const empty = run([result({ ok: false })])
  expect(empty[0]).toMatchObject({ kind: 'notice', key: 'agent.failed', action: 'retry' })
})

it('successful result adds nothing but closes a live message and reports denials once per tool', () => {
  const ok = run([{ t: 'delta', text: 'x' }, result({ text: 'x' })])
  expect(ok).toMatchObject([{ kind: 'assistant', live: false }])
  const den = run([result({ denials: ['Bash', 'Edit', 'Bash'] })])
  expect(den).toHaveLength(1)
  expect(den[0]).toMatchObject({ kind: 'notice', level: 'warn', key: 'agent.denied', vars: { tools: 'Bash, Edit' } })
})

it('stopped adds an info notice', () => {
  expect(run([{ t: 'stopped' }])).toMatchObject([{ kind: 'notice', level: 'info', key: 'agent.stopped' }])
})

it('init is ignored by the transcript', () => {
  expect(run([{ t: 'init', sessionId: 's' }])).toEqual([])
})

it('keeps at most MAX_ITEMS, newest', () => {
  const evs: AgentEvent[] = Array.from({ length: MAX_ITEMS + 20 }, (_, i) => ({ t: 'tool', id: `t${i}`, name: 'Bash', input: { command: String(i) } }))
  const items = run(evs)
  expect(items).toHaveLength(MAX_ITEMS)
  expect(items[items.length - 1]).toMatchObject({ toolId: `t${MAX_ITEMS + 19}` })
})
