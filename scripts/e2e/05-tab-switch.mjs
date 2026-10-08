// Regression: opening or switching to another file must show that file's code (it used to keep the old file's text).
// Needs the fixture from script 01. Usage: node 05-tab-switch.mjs <port> <fixtureDir>
import { join } from 'node:path'
const port = process.argv[2]
const proj = join(process.argv[3], 'demo app')
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
const click = (sel, text) => ev(`(()=>{const rx=new RegExp(${JSON.stringify(text)},'i');const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>rx.test((e.innerText||'')+' '+(e.title||'')));if(!el)return false;el.click();return true})()`)
const dbl = (sel, text) => ev(`(()=>{const rx=new RegExp(${JSON.stringify(text)},'i');const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>rx.test(e.innerText||''));if(!el)return false;el.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));return true})()`)
const code = () => ev(`(document.querySelector('.monaco-editor .view-lines')?.innerText||'').replace(/\\s+/g,' ').trim()`)
// Monaco writes spaces as non-breaking spaces, so compare after normalizing whitespace.
const visible = `(document.querySelector('.monaco-editor .view-lines')?.innerText||'').replace(/\\s+/g,' ')`
const showsReadme = async () => !!(await waitFor(`/# demo/.test(${visible})`, 6000))
const showsA = async () => !!(await waitFor(`/export const a/.test(${visible})`, 6000))
const step = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)

await send('Runtime.enable'); await send('Page.enable'); await sleep(800)
await ev(`window.tm.invoke('settings.set',{setupDone:true,lang:'en'})`); await ev(`window.tm.invoke('recent.add', ${JSON.stringify(proj)})`)
await send('Page.reload'); await sleep(2500)
await click('.recent-row', 'demo app'); await waitFor(`[...document.querySelectorAll('.tree-row')].some(r=>r.innerText.includes('README.md'))`); await sleep(1500)
await click('.tree-row', 'README.md'); await sleep(1200); await dbl('.tree-row', 'README.md'); await sleep(400)
step('first file shows its code', await showsReadme(), await code())
await click('.tree-row', '^src'); await sleep(700)
await click('.tree-row', 'a\\.ts'); await sleep(1200); await dbl('.tree-row', 'a\\.ts'); await sleep(400)
step('opening a second file shows the second file, not the first', await showsA(), await code())
await click('.tab', 'README'); step('switching back to the first tab shows the first file', await showsReadme(), await code())
await click('.tab', 'a\\.ts'); step('switching to the second tab shows the second file', await showsA(), await code())
await click('.tree-row', 'README.md'); step('clicking a file in the explorer switches the code', await showsReadme(), await code())
step('no script errors', errors.length === 0, errors[0] ?? '')
ws.close()
