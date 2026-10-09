// Task list multi-select (Ctrl/Shift click, bulk assign, status, delete) and screenshots pasted into a task,
// including that the agent can read the screenshot (one short real agent turn, a few cents).
// Needs the fixture from script 01. Usage: node 08-multi-select-screenshots.mjs <port> <fixtureDir>
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
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
const modClick = (title, mod) => ev(`(()=>{const el=[...document.querySelectorAll('.row[role="button"]')].find(e=>e.title===${JSON.stringify(title)});if(!el)return false;el.dispatchEvent(new MouseEvent('click',{bubbles:true,${mod}:true}));return true})()`)
const typeInto = (sel, text) => ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return false;const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(text)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
const pick = async (label, option) => { await ev(`document.querySelector('button[role=combobox][aria-label="${label}"]')?.click()`); await sleep(250); return click('.dd-item', option) }
const step = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
const tasksNow = async () => (await ev(`window.tm.invoke('team.read')`))?.tasks ?? []

// A solid red 48 x 48 PNG, so the agent has something clear to describe.
function redPng() {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]) }
  const W = 48, row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: W }, () => Buffer.from([255, 0, 0])))])
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: W }, () => row)))), chunk('IEND', Buffer.alloc(0))]).toString('base64')
}
const PNG = redPng()
const pasteShot = () => ev(`(()=>{const b=atob(${JSON.stringify(PNG)});const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);const dt=new DataTransfer();dt.items.add(new File([u],'shot.png',{type:'image/png'}));document.querySelector('.task-page').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));return true})()`)

await send('Runtime.enable'); await send('Page.enable'); await sleep(800)
await ev(`window.tm.invoke('settings.set',{setupDone:true,lang:'en'})`); await ev(`window.tm.invoke('recent.add', ${JSON.stringify(proj)})`)
await send('Page.reload'); await sleep(2500)
await click('.recent-row', 'demo app'); await waitFor(`!!document.querySelector('.activitybar')`); await sleep(1500)

// ---- multi-select
const now = new Date().toISOString(); const me = (await tasksNow())[0]?.createdBy ?? 'Ray0737'
// Rows sort by createdAt, so give A, B, C rising times to keep them in that order on screen.
const mk = (title, i) => ({ id: 't-' + Math.random().toString(36).slice(2, 10).padEnd(8, '0'), title, brief: '', role: 'custom', assignee: null, status: 'todo', files: [], branch: null, createdBy: me, createdAt: new Date(Date.now() + i * 1000).toISOString(), updatedAt: now })
const made = ['E2E multi A', 'E2E multi B', 'E2E multi C', 'E2E multi D'].map(mk)
for (const t of made) await ev(`window.tm.invoke('team.saveTask', ${JSON.stringify(t)})`)
await send('Page.reload'); await sleep(2500)
await click('.recent-row', 'demo app'); await waitFor(`!!document.querySelector('.activitybar')`); await sleep(1200)
await click('.ab-item', 'tasks'); await sleep(500); await click('.tabs-inline .btn', 'All'); await sleep(500)
step('tasks list shows the new tasks', !!(await waitFor(`[...document.querySelectorAll('.row[role="button"]')].some(e=>e.title==='E2E multi C')`, 8000)))
await modClick('E2E multi A', 'ctrlKey'); await modClick('E2E multi B', 'ctrlKey'); await sleep(300)
step('Ctrl+click selects two tasks and shows the bulk bar', !!(await waitFor(`/2 selected/.test(document.querySelector('.bulk-bar')?.innerText||'')`, 3000)))
const count = async () => /(\d+) selected/.exec(await ev(`document.querySelector('.bulk-bar')?.innerText||''`))?.[1] ?? '0'
await click('.bulk-bar .icon-btn', 'Clear'); await sleep(200)
step('Clear selection hides the bar', !(await ev(`!!document.querySelector('.bulk-bar')`)))
await modClick('E2E multi A', 'ctrlKey'); await modClick('E2E multi C', 'shiftKey'); await sleep(300)
step('Shift+click selects the range from the last click (A to C = 3)', (await count()) === '3', (await count()) + ' selected')
await modClick('E2E multi B', 'ctrlKey'); await sleep(300)
step('Ctrl+click toggles one off (2 left)', (await count()) === '2', (await count()) + ' selected')
await click('.bulk-bar .icon-btn', 'Clear'); await modClick('E2E multi A', 'ctrlKey'); await modClick('E2E multi B', 'ctrlKey'); await sleep(300)
step('A and B are selected', (await count()) === '2')
await click('.bulk-bar button', 'Assign to me'); await sleep(1500)
let ts = await tasksNow()
step('Assign to me assigns both and not C', made.slice(0, 2).every((m) => ts.find((x) => x.id === m.id)?.assignee === me) && !ts.find((x) => x.id === made[2].id)?.assignee)
step('selection survives the bulk action', (await count()) === '2')
await pick('Set status', 'Review'); await sleep(1500)
ts = await tasksNow()
step('Set status moves both to review', made.slice(0, 2).every((m) => ts.find((x) => x.id === m.id)?.status === 'review'))
step('selection still there after the status change', (await count()) === '2')
await click('.bulk-bar button', 'Delete'); await sleep(500)
await ev(`[...document.querySelectorAll('button')].filter(b=>/^\\s*Delete\\s*$/.test(b.innerText)&&b.closest('.modal')).pop()?.click()`); await sleep(2000)
ts = await tasksNow()
step('bulk delete removes the selected tasks only', !made.slice(0, 2).some((m) => ts.find((x) => x.id === m.id)))
await click('.tabs-inline .btn', 'All'); await sleep(300)
await click('.bulk-bar .icon-btn', 'Clear'); await sleep(200)
await modClick('E2E multi C', 'ctrlKey'); await sleep(300)
await click('.bulk-bar button', 'Delete'); await sleep(500)
await ev(`[...document.querySelectorAll('button')].filter(b=>/^\\s*Delete\\s*$/.test(b.innerText)&&b.closest('.modal')).pop()?.click()`); await sleep(2000)
step('last test task cleaned up', !(await tasksNow()).some((x) => x.id === made[2].id))
// one click finishes every selected task
await click('.bulk-bar .icon-btn', 'Clear'); await modClick('E2E multi D', 'ctrlKey'); await sleep(300)
await click('.bulk-bar button', 'Mark done'); await sleep(1500)
step('Mark done finishes the selected task', (await tasksNow()).find((x) => x.id === made[3].id)?.status === 'done')
await ev(`window.tm.invoke('team.deleteTask', ${JSON.stringify(made[3].id)})`)

// ---- screenshots on a task
const login = (await tasksNow()).find((x) => x.title.startsWith('Login page'))
step('fixture task "Login page" exists', !!login)
for (const f of (await ev(`window.tm.invoke('team.images', ${JSON.stringify(login.id)})`)) ?? []) await ev(`window.tm.invoke('team.removeImage', ${JSON.stringify(login.id)}, ${JSON.stringify(f)})`) // rerunnable
await click('.row[role="button"]', 'Login page'); await waitFor(`!!document.querySelector('.task-page')`, 6000); await sleep(600)
step('task page has a Screenshots section', !!(await ev(`/Screenshots/.test(document.querySelector('.task-page')?.innerText||'')`)))
await pasteShot(); await waitFor(`!!document.querySelector('.task-shot img')`, 8000)
step('pasting an image adds a thumbnail', !!(await ev(`!!document.querySelector('.task-shot img')`)))
step('the screenshot is stored for the team', (await ev(`window.tm.invoke('team.images', ${JSON.stringify(login.id)})`))?.length === 1)
await ev(`document.querySelector('.task-shot img').click()`); await sleep(300)
step('clicking a thumbnail zooms it', !!(await ev(`!!document.querySelector('.shot-zoom')`)))
await ev(`document.querySelector('.modal-back')?.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`); await sleep(300)
step('clicking outside closes the zoom', !(await ev(`!!document.querySelector('.shot-zoom')`)))
await click('.task-shot .icon-btn', 'Remove'); await sleep(800)
step('remove deletes the screenshot', (await ev(`window.tm.invoke('team.images', ${JSON.stringify(login.id)})`))?.length === 0)
await ev(`document.querySelector('.task-page').focus()`); await pasteShot(); await waitFor(`!!document.querySelector('.task-shot img')`, 8000)

// ---- the agent can see it
await pick('Task', 'Login page'); await sleep(500)
await pick('Mode', 'Read-only'); await sleep(300)
// paste an image straight into the chat box: saved on the task, its path typed into the message
const before = (await ev(`window.tm.invoke('team.images', ${JSON.stringify(login.id)})`)).length
await ev(`(()=>{const b=atob(${JSON.stringify(PNG)});const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);const dt=new DataTransfer();dt.items.add(new File([u],'shot.png',{type:'image/png'}));document.querySelector('.agent-input textarea').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));return true})()`)
step('pasting into the chat inserts the screenshot path', !!(await waitFor(`/attachments.*\\.png/.test(document.querySelector('.agent-input textarea')?.value||'')`, 8000)), await ev(`document.querySelector('.agent-input textarea')?.value`))
step('the chat paste is also stored on the task', (await ev(`window.tm.invoke('team.images', ${JSON.stringify(login.id)})`)).length === before + 1)
await click('.task-shot .shot-copy', 'Copy path')
step('Copy path on a screenshot confirms with a toast', !!(await waitFor(`[...document.querySelectorAll('.toast')].some(x=>/Path copied/.test(x.innerText))`, 4000)))
await ev(`document.querySelector('.agent-input textarea')?.focus()`)
await typeInto('.agent-input textarea', 'Open the screenshot attached to this task and reply with just the main color of the image, one word.')
await click('.agent-input button', 'Send')
const saw = await waitFor(`[...document.querySelectorAll('.msg-md')].some(m=>/red/i.test(m.innerText))`, 150000)
step('the agent opened the screenshot and saw it is red', !!saw)
step('no script errors', errors.length === 0, errors[0] ?? '')
ws.close()
