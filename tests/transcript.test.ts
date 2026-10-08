import { it, expect } from 'vitest'
import { parseTranscript, sessionTitle, countPrompts } from '../src/shared/transcript'

const J = (o: unknown) => JSON.stringify(o)
const lines = [
  J({ type: 'queue-operation', operation: 'enqueue' }),
  J({ type: 'attachment', attachment: { type: 'hook_success' } }),
  J({ type: 'user', isSidechain: false, message: { role: 'user', content: 'Add a login page' } }),
  J({ type: 'assistant', isSidechain: false, message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'hmm' }] } }),
  J({ type: 'assistant', isSidechain: false, message: { role: 'assistant', content: [{ type: 'text', text: 'Looking at the project.' }] } }),
  J({ type: 'assistant', isSidechain: false, message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: 'C:\\p\\a.ts' } }] } }),
  J({ type: 'user', isSidechain: false, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'file body' }] } }),
  J({ type: 'user', isSidechain: true, message: { role: 'user', content: 'sub agent prompt' } }),
  J({ type: 'user', isSidechain: false, message: { role: 'user', content: '<command-name>/clear</command-name>' } }),
  J({ type: 'user', isSidechain: false, message: { role: 'user', content: [{ type: 'text', text: 'Now add tests' }] } }),
  'not json', ''
].join('\n')

it('turns a transcript into user messages and agent events, skipping noise', () => {
  const t = parseTranscript(lines)
  expect(t.map((e) => (e.kind === 'user' ? `user:${e.text}` : `ev:${e.ev.t}`))).toEqual(['user:Add a login page', 'ev:text', 'ev:tool', 'ev:toolResult', 'user:Now add tests'])
})

it('sessionTitle is the first real prompt, trimmed to 80 characters', () => {
  expect(sessionTitle(lines)).toBe('Add a login page')
  expect(sessionTitle(J({ type: 'user', message: { role: 'user', content: 'x'.repeat(200) } })).length).toBe(80)
  expect(sessionTitle('')).toBe('')
})

it('countPrompts counts only real user prompts', () => {
  expect(countPrompts(lines)).toBe(2)
})

it('keeps only the newest 400 entries', () => {
  const many = Array.from({ length: 500 }, (_, i) => J({ type: 'user', message: { role: 'user', content: `m${i}` } })).join('\n')
  const t = parseTranscript(many)
  expect(t).toHaveLength(400)
  expect(t[399]).toEqual({ kind: 'user', text: 'm499' })
})
