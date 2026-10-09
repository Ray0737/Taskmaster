// Claude dark theme, rounded panels, language modes (py, c, cs, tsx, ino), Run File, and the chat's human icon and cooking indicator
// (one short real agent turn). Needs the fixture from script 01. Usage: node 12-theme-run-languages-chat.mjs <port> <fixtureDir>
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
const port = process.argv[2]
const dir = process.argv[3]
const proj = join(dir, 'demo app')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pending = new Map(); const errors = []
ws.addEventListener('message', (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  if (msg.method === 'Runtime.exceptionThrown') errors.push((msg.params.exceptionDetails.exception?.description ?? '').slice(0, 200)) })
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.result?.exceptionDetails ? 'ERR ' + r.result.exceptionDetails.exception?.description : r.result?.result?.value }
const waitFor = async (e, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await ev(e); if (v && !String(v).startsWith('ERR')) return v; await sleep(250) } return false }
const click = (sel, text) => ev(`(()=>{const rx=new RegExp(${JSON.stringify(text)},'i');const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>rx.test((e.innerText||'')+' '+(e.title||'')+' '+(e.getAttribute('aria-label')||'')));if(!el)return false;el.click();return true})()`)
const typeInto = (sel, text) => ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return false;const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(text)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(dir, name), Buffer.from(r.result.data, 'base64')) }
const step = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
const openByName = async (name) => { await click('.tree-row', name); await sleep(900); await ev(`(()=>{const el=[...document.querySelectorAll('.tree-row')].find(e=>e.innerText.trim()===${JSON.stringify(name)});el?.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))})()`); await sleep(900) }
// Plain text has one token colour; a recognised language has several (keywords, strings, ...).
const tokenColours = () => ev(`new Set([...document.querySelectorAll('.monaco-editor .view-lines span[class*=mtk]')].flatMap((x)=>[...x.classList].filter((c)=>/^mtk[0-9]+$/.test(c)))).size`)

// sample files in the project
const files = { 'hello.mjs': "console.log('TM_RUN_OK ' + 6 * 7)\n", 'sketch.ino': 'void setup() {}\nvoid loop() {}\n', 'tool.py': 'print("hi")\n', 'prog.c': '#include <stdio.h>\nint main(void) { return 0; }\n', 'App.cs': 'Console.WriteLine("hi");\n', 'View.tsx': 'export const V = () => <div>hi</div>\n' }
for (const [n, t] of Object.entries(files)) writeFileSync(join(proj, n), t)

await send('Runtime.enable'); await send('Page.enable'); await sleep(800)
await ev(`window.tm.invoke('settings.set',{setupDone:true,lang:'en',theme:'claude-dark'})`); await ev(`window.tm.invoke('recent.add', ${JSON.stringify(proj)})`)
await send('Page.reload'); await sleep(2500)
await click('.recent-row', 'demo app'); await waitFor(`!!document.querySelector('.activitybar')`); await sleep(1500)
await click('.ab-item', 'explorer'); await waitFor(`[...document.querySelectorAll('.tree-row')].some(r=>r.innerText.includes('hello.mjs'))`)

// ---- theme and panels
const look = await ev(`(()=>({bg:getComputedStyle(document.body).backgroundColor,theme:document.documentElement.dataset.theme,pane:getComputedStyle(document.querySelector('.pane')).borderRadius,rail:getComputedStyle(document.querySelector('.activitybar')).borderRadius,editor:getComputedStyle(document.querySelector('.editor-area')).borderRadius}))()`)
step('Claude Dark is applied (warm charcoal background)', look.theme === 'claude-dark' && look.bg === 'rgb(38, 38, 36)', JSON.stringify(look))
step('panels and the activity bar are rounded', look.pane === '10px' && look.rail === '10px' && look.editor === '10px')
await shot('12-claude-dark.png')

// ---- language modes
for (const name of ['tool.py', 'prog.c', 'App.cs', 'View.tsx', 'sketch.ino', 'hello.mjs']) {
  await openByName(name)
  await sleep(600)
  const n = await tokenColours()
  step(`${name} is syntax highlighted`, n >= 2, `${n} token colours`)
}
await openByName('sketch.ino')
step('an Arduino sketch has no Run button (planned)', !(await ev(`!!document.querySelector('.crumb-run')`)))
await openByName('hello.mjs')

// ---- Run File
step('a runnable file shows the Run button', !!(await waitFor(`!!document.querySelector('.crumb-run')`, 4000)))
await click('.crumb-run', 'Run file')
step('Run File prints the program output in the terminal', !!(await waitFor(`/TM_RUN_OK 42/.test(document.querySelector('.xterm-rows')?.innerText||'')`, 30000)), (await ev(`(document.querySelector('.xterm-rows')?.innerText||'').split('\\n').filter(Boolean).slice(-3).join(' | ')`)))

// ---- chat: human icon, cooking indicator
await typeInto('.agent-input textarea', 'Reply with exactly the numbers 1 to 25, one per line.')
await click('.agent-input button', 'Send')
step('the chat shows a human icon on the message you sent', !!(await waitFor(`!!document.querySelector('.msg-user .codicon-account')`, 8000)))
step('while the agent works, a cooking indicator with the terminal icon shows', !!(await waitFor(`!!document.querySelector('.msg-cooking .codicon-terminal') && /Cooking|Brewing|Thinking|Simmering|Plating/.test(document.querySelector('.msg-cooking')?.innerText||'')`, 20000)))
await shot('12-chat.png')
await waitFor(`!document.querySelector('.send-btn.stop')`, 90000); await sleep(500)
step('and it goes away when the answer is done', !(await ev(`!!document.querySelector('.msg-cooking')`)))
step('no script errors', errors.length === 0, errors[0] ?? '')
await ev(`window.tm.invoke('settings.set',{theme:'mono-dark'})`)
ws.close()
