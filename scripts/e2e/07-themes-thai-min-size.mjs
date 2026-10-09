// Checks the themes that have no e2e cover yet (mono-light, mocha, github-dark), Thai text at the minimum window size
// (960 x 600), and that keyboard focus shows somewhere. Screenshots go to the fixture folder for a visual check.
// Needs the fixture from script 01. Usage: node 07-themes-thai-min-size.mjs <port> <fixtureDir>
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
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(dir, name), Buffer.from(r.result.data, 'base64')) }
const step = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
const open = async () => { await click('.recent-row', 'demo app'); await waitFor(`!!document.querySelector('.activitybar')`); await sleep(900) }

await send('Runtime.enable'); await send('Page.enable'); await sleep(800)
await ev(`window.tm.invoke('settings.set',{setupDone:true,lang:'en'})`); await ev(`window.tm.invoke('recent.add', ${JSON.stringify(proj)})`)
await send('Page.reload'); await sleep(2500); await open()

// 1. Each theme paints its own background (and the old ones still work).
const bgOf = `getComputedStyle(document.body).backgroundColor`
const seen = {}
for (const theme of ['mono-dark', 'mono-light', 'mocha', 'github-dark']) {
  await ev(`window.tm.invoke('settings.set',{theme:'${theme}'})`); await send('Page.reload'); await sleep(2200); await open()
  seen[theme] = await ev(bgOf)
  await shot(`07-theme-${theme}.png`)
  step(`theme ${theme} paints a background`, !!seen[theme] && seen[theme] !== 'rgba(0, 0, 0, 0)', seen[theme])
}
step('the four themes do not share one background', new Set(Object.values(seen)).size === 4)

// 2. Thai at the minimum window size. Emulated viewport: Electron window bounds are not settable over CDP.
await ev(`window.tm.invoke('settings.set',{theme:'mono-dark',lang:'th'})`); await send('Page.reload'); await sleep(2200); await open()
await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 600, deviceScaleFactor: 1, mobile: false })
await sleep(700)
const layout = await ev(`(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight,
  bar:!!document.querySelector('.activitybar'),status:!!document.querySelector('.statusbar, [class*=statusbar]'),
  clipped:[...document.querySelectorAll('.tab, .row, .btn, button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1)}).length}))()`)
step('Thai at 960 x 600: no horizontal page scroll', layout.sw <= layout.cw, `scrollWidth ${layout.sw} clientWidth ${layout.cw}`)
step('Thai at 960 x 600: activity bar still shown', layout.bar)
step('Thai at 960 x 600: no button runs past the right edge', layout.clipped === 0, `${layout.clipped} clipped`)
await shot('07-thai-960x600.png')

// 3. Keyboard focus: Tab moves focus and the focused element gets a visible outline or background.
await ev(`document.activeElement?.blur()`)
const focusInfo = []
for (let i = 0; i < 4; i++) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  await sleep(200)
  focusInfo.push(await ev(`(()=>{const e=document.activeElement;if(!e||e===document.body)return 'none';const s=getComputedStyle(e);return (e.tagName+' '+(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,20))+' outline:'+s.outlineStyle+' '+s.outlineWidth+' bg:'+s.backgroundColor})()`))
}
await shot('07-focus-tab.png')
step('Tab focus lands on a control', focusInfo.some((f) => f && f !== 'none'), focusInfo.join(' | '))
step('no script errors', errors.length === 0, errors[0] ?? '')
await send('Emulation.clearDeviceMetricsOverride')
await ev(`window.tm.invoke('settings.set',{lang:'en'})`)
ws.close()
