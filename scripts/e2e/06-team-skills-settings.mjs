// Team skills dialog (add, edit, delete) and the "Use team skills in the agent" setting, persisted across reloads.
// Needs the fixture from script 01. Usage: node 06-team-skills-settings.mjs <port> <fixtureDir>
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
const click = (sel, text) => ev(`(()=>{const rx=new RegExp(${JSON.stringify(text)},'i');const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>rx.test((e.innerText||'')+' '+(e.title||'')+' '+(e.getAttribute('aria-label')||'')));if(!el)return false;el.click();return true})()`)
// React ignores plain .value writes, so use the native setter and fire input.
const type = (sel, value) => ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return false;const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); const { writeFileSync } = await import('node:fs'); writeFileSync(join(process.argv[3], name), Buffer.from(r.result.data, 'base64')) }
const step = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
const SKILL = 'e2e-check-skill'
const skillRows = `[...document.querySelectorAll('.row-tall')].map(r=>r.innerText)`
const hasSkill = (name) => `${skillRows}.some(t=>t.includes(${JSON.stringify(name)}))`

await send('Runtime.enable'); await send('Page.enable'); await sleep(800)
await ev(`window.tm.invoke('settings.set',{setupDone:true,lang:'en'})`); await ev(`window.tm.invoke('recent.add', ${JSON.stringify(proj)})`)
await send('Page.reload'); await sleep(2500)
await click('.recent-row', 'demo app'); await waitFor(`!!document.querySelector('.activitybar')`); await sleep(1000)

await click('.ab-item', 'team'); await waitFor(`[...document.querySelectorAll('.section-h')].some(e=>/skills/i.test(e.innerText))`)
await shot('06-team-skills-list.png')
step('team view shows the Skills section', !!(await ev(`[...document.querySelectorAll('.section-h')].some(e=>/skills/i.test(e.innerText))`)))

await click('button', 'Add skill'); await waitFor(`!!document.querySelector('.modal[aria-label="New skill"]')`)
step('Add skill opens the New skill dialog', !!(await ev(`!!document.querySelector('.modal[aria-label="New skill"]')`)))
step('Save is disabled while name and instructions are empty', !!(await ev(`[...document.querySelectorAll('.modal button')].find(b=>/Save skill/.test(b.innerText)).disabled`)))
await type('.modal textarea.textarea', '# E2E\nSay the code word: pineapple.'); await sleep(200)
await type('.modal input.input', 'Bad Name!'); await sleep(200)
await click('.modal button', 'Save skill'); await sleep(400)
step('invalid name shows the name error', !!(await waitFor(`/lowercase letters, numbers and dashes only/.test(document.querySelector('.modal .danger')?.innerText||'')`, 3000)))
await type('.modal input.input', SKILL)
await ev(`(()=>{const el=document.querySelectorAll('.modal input.input')[1];const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');d.set.call(el,'E2E check skill');el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
await click('.modal button', 'Save skill'); await waitFor(`!document.querySelector('.modal[aria-label="New skill"]')`, 8000)
step('saved skill shows in the list', !!(await waitFor(hasSkill(SKILL), 8000)))

await click('.row-tall', SKILL); await waitFor(`!!document.querySelector('.modal[aria-label="Edit skill"]')`)
step('clicking the skill opens Edit skill with the name locked', !!(await ev(`(()=>{const i=document.querySelector('.modal input.input');return i&&i.disabled&&i.value==='${SKILL}'})()`)))
await shot('06-team-skill-edit.png')
await click('.modal button', 'Delete skill'); await sleep(500)
// The confirm dialog is a second modal on top, so its Delete button is the last one in the DOM.
await ev(`[...document.querySelectorAll('button')].filter(b=>/Delete skill/.test(b.innerText)).pop().click()`)
await waitFor(`!document.querySelector('.modal[aria-label="Edit skill"]')`, 8000)
step('deleted skill is gone from the list', !!(await waitFor(`!(${hasSkill(SKILL)})`, 8000)))

await click('.ab-item', 'settings'); await sleep(600); await click('.row', 'Agents'); await waitFor(`[...document.querySelectorAll('label')].some(l=>/team skills in the agent/i.test(l.innerText))`, 8000)
const box = `[...document.querySelectorAll('label')].find(l=>/team skills in the agent/i.test(l.innerText)).querySelector('input')`
const before = await ev(`${box}.checked`)
await ev(`${box}.click()`); await sleep(800)
const after = await ev(`${box}.checked`)
step('the setting toggles on', after === true && before === false, `before ${before}, after ${after}`)
await send('Page.reload'); await sleep(2500)
await click('.recent-row', 'demo app'); await waitFor(`!!document.querySelector('.activitybar')`); await sleep(800)
await click('.ab-item', 'settings'); await sleep(600); await click('.row', 'Agents'); await waitFor(`[...document.querySelectorAll('label')].some(l=>/team skills in the agent/i.test(l.innerText))`, 8000)
step('the setting survives a reload', (await ev(`${box}.checked`)) === true)
await ev(`${box}.click()`); await sleep(500)
step('the setting turns back off', (await ev(`${box}.checked`)) === false)
step('no script errors', errors.length === 0, errors[0] ?? '')
ws.close()
