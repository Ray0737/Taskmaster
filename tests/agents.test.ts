import { it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { AgentEvent } from '../src/shared/agent'
import { findOnPath, resolveCommand, detectAgents, claudeArgs, basicArgs, streamProcess } from '../src/main/services/agents'

const tmp = () => mkdtempSync(join(tmpdir(), 'tm-agent-'))
const J = (o: unknown) => JSON.stringify(o)

// Real shim text written by npm for Claude Code (verified 2026-10-08).
const CLAUDE_SHIM = '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n\r\n"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*\r\n'
// Typical npm shim for a JavaScript CLI.
const NODE_SHIM = '@ECHO off\r\nSETLOCAL\r\nCALL :find_dp0\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n)\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n'

it('findOnPath honors extension order and misses cleanly', () => {
  const d = tmp()
  writeFileSync(join(d, 'tool.cmd'), '')
  writeFileSync(join(d, 'tool.exe'), '')
  expect(findOnPath('tool', d, ['.exe', '.cmd'])).toBe(join(d, 'tool.exe'))
  expect(findOnPath('tool', d, ['.cmd'])).toBe(join(d, 'tool.cmd'))
  expect(findOnPath('nope', d, ['.exe'])).toBeNull()
  expect(findOnPath('tool', '', ['.exe'])).toBeNull()
})

it('resolveCommand unwraps npm shims to the real program', () => {
  const d = tmp()
  writeFileSync(join(d, 'claude.cmd'), CLAUDE_SHIM)
  writeFileSync(join(d, 'codex.cmd'), NODE_SHIM)
  writeFileSync(join(d, 'weird.cmd'), '@echo hello\r\n')
  expect(resolveCommand(join(d, 'claude.cmd'))).toEqual({ cmd: join(d, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'), prefix: [] })
  expect(resolveCommand(join(d, 'codex.cmd'))).toEqual({ cmd: 'node', prefix: [join(d, 'node_modules', '@openai', 'codex', 'bin', 'codex.js')] })
  expect(resolveCommand('C:\\tools\\agent.exe')).toEqual({ cmd: 'C:\\tools\\agent.exe', prefix: [] })
  expect(() => resolveCommand(join(d, 'weird.cmd'))).toThrow('unsupported')
})

it('detectAgents finds a CLI through a shim and reads its version', async () => {
  const d = tmp()
  writeFileSync(join(d, 'codex.js'), 'console.log("codex-cli 9.9.9 (fake)")')
  writeFileSync(join(d, 'codex.cmd'), '@ECHO off\r\n"%_prog%"  "%dp0%\\codex.js" %*\r\n')
  const found = await detectAgents(d, ['.cmd'])
  expect(found).toHaveLength(1)
  expect(found[0]).toMatchObject({ id: 'codex', label: 'Codex CLI', version: '9.9.9', kind: 'basic', bin: join(d, 'codex.cmd') })
  expect(await detectAgents(tmp(), ['.cmd'])).toEqual([])
})

it('claudeArgs builds the exact flag list', () => {
  expect(claudeArgs({ system: '', mode: 'plan' })).toEqual(['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-mode', 'plan'])
  expect(claudeArgs({ system: 'SYS', mode: 'acceptEdits', sessionId: 'abc' })).toEqual(
    ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-mode', 'acceptEdits', '--append-system-prompt', 'SYS', '--resume', 'abc'])
})

it('basicArgs passes the prompt as one argument', () => {
  expect(basicArgs('codex', 'do it')).toEqual(['exec', 'do it'])
  expect(basicArgs('gemini', 'do it')).toEqual(['-p', 'do it'])
  expect(basicArgs('aider', 'do it')).toEqual(['--message', 'do it', '--yes'])
  expect(basicArgs('opencode', 'do it')).toEqual(['run', 'do it'])
  expect(basicArgs('claude', 'x')).toBeNull()
})

const script = (body: string): string => { const f = join(tmp(), 'fake.js'); writeFileSync(f, body); return f }
const run = (spec: Parameters<typeof streamProcess>[0]) =>
  new Promise<{ events: AgentEvent[]; code: number | null; stop: () => void }>((res) => {
    const events: AgentEvent[] = []
    const h = streamProcess(spec, (e) => events.push(e), (code) => res({ events, code, stop: h.stop }))
  })

it('streamProcess: lines split across chunks with CRLF arrive once, in order', async () => {
  const lines = [
    J({ type: 'system', subtype: 'init', session_id: 'S1' }),
    J({ type: 'stream_event', parent_tool_use_id: null, event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } } }),
    J({ type: 'assistant', parent_tool_use_id: null, message: { content: [{ type: 'text', text: 'Hi there' }] } }),
    J({ type: 'result', subtype: 'success', is_error: false, result: 'Hi there', session_id: 'S1', usage: { input_tokens: 1, output_tokens: 2 } })
  ]
  const f = script(`const out=${JSON.stringify(lines.map((l) => l + '\r\n').join(''))};const m=Math.floor(out.length/2);process.stdout.write(out.slice(0,m));setTimeout(()=>process.stdout.write(out.slice(m)),80)`)
  const r = await run({ cmd: process.execPath, args: [f], cwd: tmpdir(), parse: 'claude' })
  expect(r.code).toBe(0)
  expect(r.events.map((e) => e.t)).toEqual(['init', 'delta', 'text', 'result'])
})

it('streamProcess: crash without a result line gives exactly one error result', async () => {
  const f = script('console.error("boom: something broke");process.exit(3)')
  const r = await run({ cmd: process.execPath, args: [f], cwd: tmpdir(), parse: 'claude' })
  expect(r.code).toBe(3)
  expect(r.events).toEqual([{ t: 'result', ok: false, text: '', sessionId: null, inTokens: 0, outTokens: 0, costUsd: null, errors: ['boom: something broke'], denials: [] }])
})

it('streamProcess: missing program gives one error result and exit null', async () => {
  const r = await run({ cmd: join(tmp(), 'does-not-exist.exe'), args: [], cwd: tmpdir(), parse: 'claude' })
  expect(r.code).toBeNull()
  expect(r.events).toHaveLength(1)
  expect(r.events[0]).toMatchObject({ t: 'result', ok: false })
})

const TRICKY = 'ทดสอบ "quotes" & %PATH% \'single\' ^ | < >\nsecond line'

it('streamProcess: stdin text reaches the agent byte for byte', async () => {
  const f = script(`let d='';process.stdin.setEncoding('utf8').on('data',c=>d+=c).on('end',()=>console.log(JSON.stringify({type:'assistant',parent_tool_use_id:null,message:{content:[{type:'text',text:d}]}})))`)
  const r = await run({ cmd: process.execPath, args: [f], cwd: tmpdir(), input: TRICKY, parse: 'claude' })
  expect(r.events.find((e) => e.t === 'text')).toEqual({ t: 'text', text: TRICKY })
})

it('streamProcess: argument text reaches a basic agent byte for byte', async () => {
  const f = script('process.stdout.write(process.argv[2])')
  const r = await run({ cmd: process.execPath, args: [f, TRICKY], cwd: tmpdir(), parse: 'text' })
  expect(r.events.find((e) => e.t === 'text')).toEqual({ t: 'text', text: TRICKY })
  expect(r.events.find((e) => e.t === 'result')).toMatchObject({ ok: true })
})

it('streamProcess: stop kills the whole process tree', async () => {
  const f = script(`const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)']);console.log('GC '+c.pid);setInterval(()=>{},1000)`)
  const events: AgentEvent[] = []
  let gc = 0
  const done = new Promise<void>((res) => {
    const h = streamProcess({ cmd: process.execPath, args: [f], cwd: tmpdir(), parse: 'text' },
      (e) => {
        events.push(e)
        if (e.t === 'delta') { const m = /GC (\d+)/.exec(e.text); if (m && !gc) { gc = Number(m[1]); h.stop() } }
      }, () => res())
  })
  await done
  const alive = () => { try { process.kill(gc, 0); return true } catch { return false } }
  for (let i = 0; i < 30 && alive(); i++) await new Promise((r) => setTimeout(r, 100))
  expect(alive()).toBe(false)
  expect(events.some((e) => e.t === 'stopped')).toBe(true)
  expect(events.some((e) => e.t === 'result')).toBe(false)
})
