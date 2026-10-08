import { it, expect } from 'vitest'
import { parseClaudeLine, needsLogin, cleanToolText } from '../src/shared/agent'

const J = (o: unknown) => JSON.stringify(o)
const SID = '4c12968c-8a78-4982-aded-772b8fd2b1f2'

it('ignores noise: hooks, status, rate limits, thinking, signatures, junk', () => {
  const noise = [
    J({ type: 'system', subtype: 'hook_started', hook_name: 'SessionStart:startup', session_id: SID }),
    J({ type: 'system', subtype: 'hook_response', output: 'CAVEMAN MODE ACTIVE', session_id: SID }),
    J({ type: 'system', subtype: 'status', status: 'requesting' }),
    J({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed' } }),
    J({ type: 'stream_event', event: { type: 'message_start', message: {} }, parent_tool_use_id: null }),
    J({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'hmm' } }, parent_tool_use_id: null }),
    J({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'abc' } }, parent_tool_use_id: null }),
    J({ type: 'stream_event', event: { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"a"' } }, parent_tool_use_id: null }),
    J({ type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'x', signature: 's' }] }, parent_tool_use_id: null }),
    'not json at all', '', '   ', '{"broken":'
  ]
  for (const l of noise) expect(parseClaudeLine(l), l).toEqual([])
})

it('init gives the session id', () => {
  expect(parseClaudeLine(J({ type: 'system', subtype: 'init', session_id: SID, cwd: 'C:\\p', tools: [] }))).toEqual([{ t: 'init', sessionId: SID }])
})

it('text deltas stream live', () => {
  const l = J({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Package' } }, parent_tool_use_id: null })
  expect(parseClaudeLine(l)).toEqual([{ t: 'delta', text: 'Package' }])
})

it('assistant lines give full text and tool calls', () => {
  expect(parseClaudeLine(J({ type: 'assistant', parent_tool_use_id: null, message: { content: [{ type: 'text', text: 'Done.' }] } })))
    .toEqual([{ t: 'text', text: 'Done.' }])
  expect(parseClaudeLine(J({ type: 'assistant', parent_tool_use_id: null, message: { content: [{ type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: 'C:\\p\\package.json' } }] } })))
    .toEqual([{ t: 'tool', id: 'toolu_1', name: 'Read', input: { file_path: 'C:\\p\\package.json' } }])
  expect(parseClaudeLine(J({ type: 'assistant', parent_tool_use_id: null, message: { content: [{ type: 'text', text: '' }] } }))).toEqual([])
})

it('sub-agent lines are ignored', () => {
  const sub = 'toolu_parent'
  expect(parseClaudeLine(J({ type: 'stream_event', parent_tool_use_id: sub, event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'x' } } }))).toEqual([])
  expect(parseClaudeLine(J({ type: 'assistant', parent_tool_use_id: sub, message: { content: [{ type: 'text', text: 'x' }] } }))).toEqual([])
  expect(parseClaudeLine(J({ type: 'user', parent_tool_use_id: sub, message: { content: [{ type: 'tool_result', tool_use_id: 't', content: 'x' }] } }))).toEqual([])
})

it('tool results: string and array content, reminder stripped, error flag', () => {
  const withReminder = '1\t{"name":"x"}\n\n<system-reminder>\nWhenever you read a file...\n</system-reminder>\n'
  expect(parseClaudeLine(J({ type: 'user', parent_tool_use_id: null, message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: withReminder }] } })))
    .toEqual([{ t: 'toolResult', id: 't1', text: '1\t{"name":"x"}', isError: false }])
  expect(parseClaudeLine(J({ type: 'user', parent_tool_use_id: null, message: { content: [{ type: 'tool_result', tool_use_id: 't2', is_error: true, content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }] } })))
    .toEqual([{ t: 'toolResult', id: 't2', text: 'a\nb', isError: true }])
  expect(parseClaudeLine(J({ type: 'user', parent_tool_use_id: null, message: { content: 'just a string' } }))).toEqual([])
})

it('cleanToolText caps lines and characters', () => {
  expect(cleanToolText(Array.from({ length: 300 }, (_, i) => `l${i}`).join('\n')).split('\n')).toHaveLength(201) // 200 + "…"
  expect(cleanToolText('x'.repeat(30000)).length).toBeLessThanOrEqual(20001)
})

it('result success: tokens, cost, denials', () => {
  const ev = parseClaudeLine(J({
    type: 'result', subtype: 'success', is_error: false, result: 'Package name is "x".', session_id: SID, total_cost_usd: 0.1138,
    usage: { input_tokens: 4, cache_creation_input_tokens: 27530, cache_read_input_tokens: 27278, output_tokens: 159 },
    permission_denials: [{ tool_name: 'Bash', tool_use_id: 'x', tool_input: { command: 'npm test' } }]
  }))
  expect(ev).toEqual([{ t: 'result', ok: true, text: 'Package name is "x".', sessionId: SID, inTokens: 54812, outTokens: 159, costUsd: 0.1138, errors: [], denials: ['Bash'] }])
})

it('result error carries errors[]', () => {
  const ev = parseClaudeLine(J({ type: 'result', subtype: 'error_during_execution', is_error: true, session_id: SID, errors: ['No conversation found with session ID: 0000'], usage: {}, permission_denials: [] }))
  expect(ev).toEqual([{ t: 'result', ok: false, text: '', sessionId: SID, inTokens: 0, outTokens: 0, costUsd: null, errors: ['No conversation found with session ID: 0000'], denials: [] }])
})

it('needsLogin spots auth problems', () => {
  expect(needsLogin('Invalid API key · Please run /login')).toBe(true)
  expect(needsLogin('Not logged in')).toBe(true)
  expect(needsLogin('OAuth token expired, authentication_error 401')).toBe(true)
  expect(needsLogin('Cannot read property of undefined')).toBe(false)
})
