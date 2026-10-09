// Import team skills from a public GitHub repo (needs internet): scan, pick, copy the whole folder, read-only editor, delete.
// Needs the fixture from script 01. Usage: node 09-import-skills.mjs <port> <fixtureDir>
import { join, dirname } from 'node:path'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
const port = process.argv[2]
const proj = join(process.argv[3], 'demo app')
const profile = join(dirname(process.argv[3]), 'profile')
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
const step = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
const NAME = 'brand-guidelines'
const URL_OK = 'https://github.com/anthropics/skills/tree/main/skills/' + NAME

await send('Runtime.enable'); await send('Page.enable'); await sleep(800)
await ev(`window.tm.invoke('settings.set',{setupDone:true,lang:'en'})`); await ev(`window.tm.invoke('recent.add', ${JSON.stringify(proj)})`)
await send('Page.reload'); await sleep(2500)
await click('.recent-row', 'demo app'); await waitFor(`!!document.querySelector('.activitybar')`); await sleep(1200)
if ((await ev(`window.tm.invoke('team.skills')`)).some((s) => s.name === NAME)) await ev(`window.tm.invoke('team.deleteSkill', ${JSON.stringify(NAME)})`)

await click('.ab-item', 'team'); await waitFor(`[...document.querySelectorAll('.section-h')].some(e=>/skills/i.test(e.innerText))`)
await click('button', 'Import from GitHub'); await waitFor(`!!document.querySelector('.modal[aria-label="Import from GitHub"]')`)
step('Import from GitHub opens its dialog', !!(await ev(`!!document.querySelector('.modal[aria-label="Import from GitHub"]')`)))
step('Import is disabled before anything is found', !!(await ev(`[...document.querySelectorAll('.modal button')].find(b=>/^Import selected [(][0-9]+[)]$/.test(b.innerText.trim()))?.disabled`)))

await typeInto('.modal input.input', 'https://example.com/a/b'); await click('.modal button', 'Find skills'); await sleep(800)
step('a non-GitHub URL is refused with a message', !!(await waitFor(`/Not a GitHub repo URL/.test(document.querySelector('.modal .danger')?.innerText||'')`, 5000)))

await typeInto('.modal input.input', URL_OK); await click('.modal button', 'Find skills')
step('scanning a skill folder lists the skill', !!(await waitFor(`[...document.querySelectorAll('.modal .row-tall')].some(r=>r.innerText.includes('${NAME}'))`, 30000)))
const rowText = await ev(`[...document.querySelectorAll('.modal .row-tall')].find(r=>r.innerText.includes('${NAME}'))?.innerText||''`)
step('the row shows a description and file count', /files/.test(rowText) && rowText.split('\n').join(' ').length > 30, rowText.split('\n').join(' | ').slice(0, 120))
step('the found skill is preselected', !!(await ev(`!![...document.querySelectorAll('.modal .row-tall')].find(r=>r.innerText.includes('${NAME}'))?.querySelector('input:checked')`)))
step('a trust warning is shown', !!(await ev(`/trust/.test(document.querySelector('.modal')?.innerText||'')`)))
await click('.modal button', 'Import selected'); await waitFor(`!document.querySelector('.modal[aria-label="Import from GitHub"]')`, 60000)
step('importing closes the dialog and lists the skill', !!(await waitFor(`[...document.querySelectorAll('.row-tall')].some(r=>r.innerText.includes('${NAME}'))`, 8000)))

const skills = await ev(`window.tm.invoke('team.skills')`)
const sk = skills.find((s) => s.name === NAME)
step('the skill remembers its GitHub source', sk?.source === URL_OK, sk?.source)
// the whole folder is on disk, not just SKILL.md
let folder = null
const wtRoot = join(profile, 'worktrees')
for (const d of existsSync(wtRoot) ? readdirSync(wtRoot) : []) { const p = join(wtRoot, d, '.taskmaster', 'plugin', 'skills', NAME); if (existsSync(p)) folder = p }
step('the skill folder was written with SKILL.md and .source', !!folder && existsSync(join(folder, 'SKILL.md')) && existsSync(join(folder, '.source')), folder ?? 'missing')
step('SKILL.md is the real file from GitHub', !!folder && /^---/.test(readFileSync(join(folder, 'SKILL.md'), 'utf8')))

await click('.row-tall', NAME); await waitFor(`!!document.querySelector('.modal[aria-label="Edit skill"]')`)
step('an imported skill opens read-only', !!(await ev(`(()=>{const m=document.querySelector('.modal[aria-label="Edit skill"]');return !!m&&m.querySelector('textarea').readOnly&&![...m.querySelectorAll('button')].some(b=>/Save skill/.test(b.innerText))&&/Imported from/.test(m.innerText)})()`)))
await click('.modal button', 'Delete skill'); await sleep(500)
await ev(`[...document.querySelectorAll('button')].filter(b=>/Delete skill/.test(b.innerText)).pop().click()`)
step('deleting removes the imported skill and its folder', !!(await waitFor(`![...document.querySelectorAll('.row-tall')].some(r=>r.innerText.includes('${NAME}'))`, 8000)) && (!folder || !existsSync(folder)))
step('no script errors', errors.length === 0, errors[0] ?? '')
ws.close()
