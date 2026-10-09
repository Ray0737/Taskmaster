// Screenshot upload button and drag and drop, Find in Files (open at the match), and Format Document / format on save.
// Needs the fixture from script 01. Usage: node 13-upload-search-format.mjs <port> <fixtureDir>
import { join } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
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
const key = (code, opts = {}) => ev(`(()=>{const e=new KeyboardEvent('keydown',{code:${JSON.stringify(code)},key:${JSON.stringify(opts.key ?? code)},ctrlKey:${!!opts.ctrl},shiftKey:${!!opts.shift},altKey:${!!opts.alt},bubbles:true,cancelable:true});(document.activeElement||document.body).dispatchEvent(e);return true})()`)
const step = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
const openByName = async (name) => { await click('.tree-row', name); await sleep(900); await ev(`(()=>{const el=[...document.querySelectorAll('.tree-row')].find(e=>e.innerText.trim()===${JSON.stringify(name)});el?.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))})()`); await sleep(900) }
const tasksNow = async () => (await ev(`window.tm.invoke('team.read')`))?.tasks ?? []

function redPng() {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]) }
  const W = 32, row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: W }, () => Buffer.from([255, 0, 0])))])
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: W }, () => row)))), chunk('IEND', Buffer.alloc(0))])
}
const png = redPng()
const pngPath = join(dir, 'upload-red.png')
writeFileSync(pngPath, png)

// sample files
mkdirSync(join(proj, 'src'), { recursive: true })
writeFileSync(join(proj, 'src', 'needle.ts'), 'export const a = 1\nexport const NEEDLE_TM = 42\nexport const b = 2\n')
writeFileSync(join(proj, 'data.json'), '{"a":1,"b":[1,2,3],"c":{"d":2}}\n')
writeFileSync(join(proj, 'save.json'), '{"x":1,"y":{"z":[1,2]}}\n')

await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable'); await sleep(800)
await ev(`window.tm.invoke('settings.set',{setupDone:true,lang:'en',theme:'mono-dark',formatOnSave:false})`); await ev(`window.tm.invoke('recent.add', ${JSON.stringify(proj)})`)
await send('Page.reload'); await sleep(2500)
await click('.recent-row', 'demo app'); await waitFor(`!!document.querySelector('.activitybar')`); await sleep(1500)

// ---- screenshot upload and drop
const task = (await tasksNow()).find((x) => x.title.startsWith('Login page'))
for (const f of (await ev(`window.tm.invoke('team.images', ${JSON.stringify(task.id)})`)) ?? []) await ev(`window.tm.invoke('team.removeImage', ${JSON.stringify(task.id)}, ${JSON.stringify(f)})`)
await click('.ab-item', 'tasks'); await sleep(500); await click('.tabs-inline .btn', 'All'); await sleep(400)
await click('.row[role="button"]', 'Login page'); await waitFor(`!!document.querySelector('.task-page')`, 6000); await sleep(600)
step('the Screenshots section has an Upload image button', !!(await ev(`[...document.querySelectorAll('.task-page button')].some(b=>/Upload image/.test(b.innerText))`)))
const doc = await send('DOM.getDocument'); const inp = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '.task-page input[type=file]' })
await send('DOM.setFileInputFiles', { nodeId: inp.result.nodeId, files: [pngPath] })
step('choosing a file adds a thumbnail and stores it for the team', !!(await waitFor(`document.querySelectorAll('.task-shot img').length===1`, 8000)) && (await ev(`window.tm.invoke('team.images', ${JSON.stringify(task.id)})`)).length === 1)
await ev(`(()=>{const b=atob(${JSON.stringify(png.toString('base64'))});const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);const dt=new DataTransfer();dt.items.add(new File([u],'dropped.png',{type:'image/png'}));document.querySelector('.task-page').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));return true})()`)
step('dropping an image on the page adds another', !!(await waitFor(`document.querySelectorAll('.task-shot img').length===2`, 8000)))
for (const f of (await ev(`window.tm.invoke('team.images', ${JSON.stringify(task.id)})`)) ?? []) await ev(`window.tm.invoke('team.removeImage', ${JSON.stringify(task.id)}, ${JSON.stringify(f)})`)

// ---- find in files
await click('.ab-item', 'Search'); await waitFor(`!!document.querySelector('.search-input')`)
step('the Search view opens', !!(await ev(`!!document.querySelector('.search-input')`)))
await typeInto('.search-input', 'NEEDLE_TM');
step('typing finds the match with its line', !!(await waitFor(`!!document.querySelector('.search-hit') && /needle\\.ts/.test(document.querySelector('.search-file')?.innerText||'')`, 8000)), await ev(`document.querySelector('.search-hit')?.innerText?.replace(/\\s+/g,' ')`))
step('a summary line counts the results', !!(await ev(`/1 results in 1 files|results in/.test(document.querySelector('.search-msg')?.innerText||'')`)))
await click('.search-hit', 'NEEDLE_TM'); await waitFor(`!!document.querySelector('.tab.active, .tab[aria-selected=true]') || true`, 2000); await sleep(1500)
step('clicking a hit opens the file with the match selected', !!(await waitFor(`[...document.querySelectorAll('.tab')].some(t=>/needle\\.ts/.test(t.innerText)) && !!document.querySelector('.monaco-editor .selected-text')`, 8000)))
await ev(`document.querySelector('.search-box button[aria-label="Regular expression"]')?.click()`); await typeInto('.search-input', '(')
step('an invalid regular expression shows a clear error, not a crash', !!(await waitFor(`/Invalid search/.test(document.querySelector('.search-msg')?.innerText||'')`, 6000)))
await ev(`document.querySelector('.search-box button[aria-label="Regular expression"]')?.click()`)
await typeInto('.search-input', 'zzzz_not_there_zzzz')
step('no match says so', !!(await waitFor(`/No results/.test(document.querySelector('.search-view')?.innerText||'')`, 6000)))

// ---- format document and format on save
await click('.ab-item', 'explorer'); await waitFor(`[...document.querySelectorAll('.tree-row')].some(r=>r.innerText.trim()==='data.json')`, 6000)
await openByName('data.json')
const editorText = () => ev(`document.querySelector('.monaco-editor .view-lines')?.innerText||''`)
const linesBefore = (await editorText()).split('\n').filter((l) => l.trim()).length
const textBefore = await editorText()
await key('KeyP', { ctrl: true, shift: true, key: 'P' }); await waitFor(`!!document.querySelector('.palette-input')`, 4000)
await typeInto('.palette-input', '>Format Document'); await sleep(400)
await ev(`document.querySelector('.palette-input')?.dispatchEvent(new KeyboardEvent('keydown',{code:'Enter',key:'Enter',bubbles:true,cancelable:true}))`); await sleep(1500)
const linesAfter = (await editorText()).split('\n').filter((l) => l.trim()).length
await ev(`document.querySelector('.monaco-editor textarea')?.focus()`); await key('KeyS', { ctrl: true, key: 's' }); await sleep(1200)
const diskFmt = await ev(`window.tm.invoke('fs.read', ${JSON.stringify(join(proj, 'data.json'))}).then(c=>c.text)`)
step('Format Document spreads a one-line JSON file over many lines', (linesAfter > linesBefore && linesAfter >= 6) || String(diskFmt).split('\n').length >= 6, `disk=${JSON.stringify(String(diskFmt).slice(0, 30))} ${linesBefore} -> ${linesAfter} lines; before=${JSON.stringify(textBefore.slice(0, 40))} after=${JSON.stringify((await editorText()).slice(0, 40))}; tabs: ${await ev(`[...document.querySelectorAll('.tab')].map(t=>t.innerText.trim()+(t.classList.contains('active')?'*':'')).join(' | ')`)}; toasts: ${await ev(`[...document.querySelectorAll('.toast')].map(t=>t.innerText).join(' | ')`)}; palette: ${await ev(`!!document.querySelector('.palette-input')`)}`)
// the setting goes through the Settings page, so the app's own state knows about it
await click('.ab-item', 'settings'); await sleep(700); await click('.split-nav .row', 'Editor'); await sleep(500)
await ev(`[...document.querySelectorAll('label')].find(l=>/Format on save/.test(l.innerText))?.querySelector('input')?.click()`); await sleep(800)
step('Settings has a Format on save checkbox that turns on', !!(await ev(`[...document.querySelectorAll('label')].find(l=>/Format on save/.test(l.innerText))?.querySelector('input')?.checked`)))
await click('.tab', 'save.json'); await sleep(500)
await openByName('save.json')
await ev(`document.querySelector('.monaco-editor textarea')?.focus()`)
await send('Input.insertText', { text: ' ' }); await sleep(300)
await key('KeyS', { ctrl: true, key: 's' }); await sleep(1500)
const disk = await ev(`window.tm.invoke('fs.read', ${JSON.stringify(join(proj, 'save.json'))}).then(c=>c.text)`)
step('with Format on save, saving rewrites the file formatted', typeof disk === 'string' && disk.split('\n').length >= 6, JSON.stringify(String(disk).slice(0, 60)))
await click('.split-nav .row', 'Editor'); await ev(`[...document.querySelectorAll('label')].find(l=>/Format on save/.test(l.innerText))?.querySelector('input')?.click()`); await sleep(500)
step('no script errors', errors.length === 0, errors[0] ?? '')
ws.close()
