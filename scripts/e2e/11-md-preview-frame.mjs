// Markdown preview from the Explorer right-click menu, the usage icon matching its neighbours, and the window frame going away when maximized.
// Needs the fixture from script 01. Usage: node 11-md-preview-frame.mjs <port> <fixtureDir>
import { join } from 'node:path'
const port = process.argv[2]
const proj = join(process.argv[3], 'demo app')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const target = targets.find((t) => t.type === 'page')
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pending = new Map(); const errors = []
ws.addEventListener('message', (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  if (msg.method === 'Runtime.exceptionThrown') errors.push((msg.params.exceptionDetails.exception?.description ?? '').slice(0, 200)) })
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.result?.exceptionDetails ? 'ERR ' + r.result.exceptionDetails.exception?.description : r.result?.result?.value }
const waitFor = async (e, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await ev(e); if (v && !String(v).startsWith('ERR')) return v; await sleep(250) } return false }
const click = (sel, text) => ev(`(()=>{const rx=new RegExp(${JSON.stringify(text)},'i');const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>rx.test((e.innerText||'')+' '+(e.title||'')+' '+(e.getAttribute('aria-label')||'')));if(!el)return false;el.click();return true})()`)
const rightClick = (name) => ev(`(()=>{const el=[...document.querySelectorAll('.tree-row')].find(e=>e.innerText.trim().endsWith(${JSON.stringify(name)}));if(!el)return false;const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+20,clientY:r.top+8}));return true})()`)
const menuItems = () => ev(`[...document.querySelectorAll('.menu-item')].map(x=>x.innerText.replace(/\\s+/g,' ').trim())`)
const step = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)

await send('Runtime.enable'); await send('Page.enable'); await sleep(800)
await ev(`window.tm.invoke('settings.set',{setupDone:true,lang:'en'})`); await ev(`window.tm.invoke('recent.add', ${JSON.stringify(proj)})`)
await send('Page.reload'); await sleep(2500)
await click('.recent-row', 'demo app'); await waitFor(`!!document.querySelector('.activitybar')`); await sleep(1500)
await click('.ab-item', 'explorer'); await waitFor(`[...document.querySelectorAll('.tree-row')].some(r=>r.innerText.includes('README.md'))`)

// ---- Markdown preview
await rightClick('README.md'); await sleep(400)
const items = await menuItems()
step('right-click on a .md file offers Open Preview', items.includes('Open Preview'), items.join(' | '))
await click('.menu-item', 'Open Preview'); await sleep(800)
step('a preview tab opens', !!(await waitFor(`[...document.querySelectorAll('.tab')].some(t=>/Preview: README.md/.test(t.innerText))`, 5000)))
step('it shows the rendered Markdown (a heading, not "# ")', !!(await waitFor(`!!document.querySelector('.doc h1') && !/^#/.test(document.querySelector('.doc').innerText.trim())`, 5000)), await ev(`document.querySelector('.doc')?.innerText?.slice(0,40)`))
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape' }); await ev(`document.body.click()`)
await rightClick('new.txt'); await sleep(400)
step('a non-Markdown file has no Open Preview', !(await menuItems()).includes('Open Preview'))
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape' }); await ev(`document.body.click()`)

// ---- usage icon matches the buttons next to it
const look = await ev(`(()=>{const a=[...document.querySelectorAll('.pane-actions .icon-btn')];const u=a.find(x=>x.classList.contains('tb-limit'));const o=a.find(x=>!x.classList.contains('tb-limit'));if(!u||!o)return null;const cu=getComputedStyle(u),co=getComputedStyle(o);return {inActions:true,sameColor:cu.color===co.color,sameHeight:cu.height===co.height,bg:cu.backgroundColor===co.backgroundColor}})()`)
step('the usage icon sits with history, help and new chat in the same style', !!look?.inActions && look.sameColor && look.sameHeight && look.bg, JSON.stringify(look))

// ---- the frame goes away when the window fills the screen
const frame = (await ev(`(()=>({max:document.documentElement.hasAttribute('data-max'),pad:getComputedStyle(document.getElementById('root')).paddingLeft,rad:getComputedStyle(document.querySelector('.app')).borderTopLeftRadius}))()`))
const win = await send('Browser.getWindowForTarget', { targetId: target.id })
if (win.result?.windowId) {
  await send('Browser.setWindowBounds', { windowId: win.result.windowId, bounds: { windowState: 'normal' } }); await sleep(600)
  const normal = await ev(`(()=>({max:document.documentElement.hasAttribute('data-max'),pad:getComputedStyle(document.getElementById('root')).paddingLeft}))()`)
  await send('Browser.setWindowBounds', { windowId: win.result.windowId, bounds: { windowState: 'maximized' } }); await sleep(900)
  const maxed = await ev(`(()=>({max:document.documentElement.hasAttribute('data-max'),pad:getComputedStyle(document.getElementById('root')).paddingLeft,rad:getComputedStyle(document.querySelector('.app')).borderTopLeftRadius}))()`)
  step('a normal window keeps the frame', normal.pad === '8px' && !normal.max, JSON.stringify(normal))
  step('a maximized window has no frame and no corner curve', maxed.max && maxed.pad === '0px' && maxed.rad === '0px', JSON.stringify(maxed))
  await send('Browser.setWindowBounds', { windowId: win.result.windowId, bounds: { windowState: 'normal' } })
} else console.log('SKIP  window state is not settable here; current state: ' + JSON.stringify(frame))
step('no script errors', errors.length === 0, errors[0] ?? '')
ws.close()
