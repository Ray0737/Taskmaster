import { it, expect } from 'vitest'
import { parseClaudeLine } from '../src/shared/agent'

// Real lines from `claude -p --output-format stream-json` (Claude Code 2.1.121, 2026-10-08), trimmed to the fields read.
const ASSISTANT = '{"type":"assistant","parent_tool_use_id":null,"message":{"role":"assistant","content":[{"type":"text","text":"PONG"}]}}'
const RESULT = '{"type":"result","subtype":"success","is_error":false,"result":"PONG","session_id":"8004e395-7858-4e08-9b76-44c265a511b8","total_cost_usd":0.101661,"usage":{"input_tokens":2,"cache_creation_input_tokens":27084,"cache_read_input_tokens":0,"output_tokens":6},"permission_denials":[]}'

it('real CLI assistant line gives the text block', () => {
  expect(parseClaudeLine(ASSISTANT)).toEqual([{ t: 'text', text: 'PONG' }])
})

it('real CLI result line gives ok, tokens, cost and session id', () => {
  expect(parseClaudeLine(RESULT)).toEqual([{
    t: 'result', ok: true, text: 'PONG', sessionId: '8004e395-7858-4e08-9b76-44c265a511b8',
    inTokens: 27086, outTokens: 6, costUsd: 0.101661, errors: [], denials: []
  }])
})
