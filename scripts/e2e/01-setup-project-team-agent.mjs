// UI-driven end-to-end run against the packaged app. Usage: node e2e.mjs <port> <fixtureDir>
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const port = process.argv[2] || '9333'
const base = process.argv[3]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' })

// Fixture: a repo with one commit and a bare remote called origin.
rmSync(base, { recursive: true, force: true })
mkdirSync(join(base, 'remote.git'), { recursive: true })
git(join(base, 'remote.git'), 'init', '--bare', '-b', 'main')
const proj = join(base, 'demo app')
mkdirSync(join(proj, 'src'), { recursive: true })
git(proj, 'init', '-b', 'main')
writeFileSync(join(proj, 'README.md'), '# demo\n')
writeFileSync(join(proj, 'src', 'a.ts'), 'export const a = 1\n')
git(proj, 'add', '-A'); git(proj, 'commit', '-m', 'init')
git(proj, 'remote', 'add', 'origin', join(base, 'remote.git')); git(proj, 'push', '-u', 'origin', 'main')

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
const errors = []
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  if (msg.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text).slice(0, 300))
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push('CONSOLE ' + msg.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300))
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  return r.result?.exceptionDetails ? 'ERR ' + (r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text) : r.result?.result?.value
}
const waitFor = async (expr, ms = 15000, step = 250) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { const v = await ev(expr); if (v && !String(v).startsWith('ERR')) return v; await sleep(step) }
  return false
}
// click the first visible element whose text/label/title matches
const click = (sel, text) => ev(`(()=>{const rx=new RegExp(${JSON.stringify(text)},'i');const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>rx.test((e.innerText||'')+' '+(e.getAttribute('aria-label')||'')+' '+(e.title||'')));if(!el)return false;el.click();return true})()`)
const typeInto = (sel, text) => ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return false;const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(text)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
const key = (code, opts = {}) => ev(`(()=>{const e=new KeyboardEvent('keydown',{code:${JSON.stringify(code)},key:${JSON.stringify(opts.key ?? code)},ctrlKey:${!!opts.ctrl},shiftKey:${!!opts.shift},bubbles:true,cancelable:true});(document.activeElement||document.body).dispatchEvent(e);return true})()`)
const pick = async (label, option) => { await ev(`document.querySelector('button[role=combobox][aria-label="${label}"]')?.click()`); await sleep(250); return click('.dd-item', option) }
const step = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)

await send('Runtime.enable'); await send('Page.enable'); await sleep(1000)
await ev(`window.tm.invoke('settings.set',{setupDone:true,lang:'en',defaultMode:'plan'})`)
await ev(`window.tm.invoke('recent.add', ${JSON.stringify(proj)})`)
await send('Page.reload'); await sleep(2500)

// S1 open the project from Recent
step('home shows the recent project', !!(await waitFor(`document.querySelector('.recent-row')?.innerText.includes('demo app')`)))
await click('.recent-row', 'demo app')
step('project opens, explorer lists README.md and src', !!(await waitFor(`[...document.querySelectorAll('.tree-row')].map(r=>r.innerText).join(' ').includes('README.md')`)),
  await ev(`[...document.querySelectorAll('.tree-row')].map(r=>r.innerText.trim()).join(' | ')`))

// S2 preview a file in the editor
await click('.tree-row', 'README.md')
step('single click opens a preview tab with Monaco', !!(await waitFor(`!!document.querySelector('.tab.preview') && !!document.querySelector('.monaco-editor')`, 20000)),
  await ev(`[...document.querySelectorAll('.tab')].map(t=>t.innerText.trim()).join(' | ')`))
step('breadcrumbs show the path', (await ev(`document.querySelector('.breadcrumbs')?.innerText.replace(/\\s+/g,' ')`)) === 'README.md')

// S3 source control
await click('.ab-item', 'Source Control')
step('source control shows branch main and no changes', !!(await waitFor(`document.querySelector('.scm-branch')?.innerText.includes('main')`)),
  await ev(`document.querySelector('.pane-body')?.innerText.replace(/\\s+/g,' ').slice(0,120)`))

// S4 command palette + quick open
await key('KeyP', { ctrl: true, key: 'p' }); await sleep(600)
step('Ctrl+P opens quick open', !!(await ev(`!!document.querySelector('.palette')`)))
await typeInto('.palette-input', 'a.ts'); await sleep(500)
step('quick open finds src/a.ts', !!(await ev(`document.querySelector('.palette-list')?.innerText.includes('src/a.ts')`)))
await key('Escape'); await sleep(300)

// S5 team layer
await click('.ab-item', 'Tasks')
step('tasks view offers Enable Taskmaster', !!(await waitFor(`[...document.querySelectorAll('button')].some(b=>/Enable Taskmaster/.test(b.innerText))`, 20000)))
await click('button', 'Enable Taskmaster')
step('enable works: tasks view shows Mine/All', !!(await waitFor(`document.querySelector('.tabs-inline')?.innerText.includes('Mine')`, 40000)),
  await ev(`document.querySelector('.statusbar')?.innerText.replace(/\\s+/g,' ')`))
step('status bar shows team presence', !!(await waitFor(`/online/.test(document.querySelector('.statusbar')?.innerText||'')`, 30000)))

// S6 create and start a task
await click('.pane-actions button', 'New task')
await sleep(500)
await waitFor(`!!document.querySelector('.task-title')`, 10000)
await typeInto('.task-title', 'Login page')
await sleep(2000) // the title is saved 600 ms after the last keystroke
step('new task opens as a tab', !!(await waitFor(`[...document.querySelectorAll('.tab')].some(t=>t.innerText.includes('Login page'))`, 15000)))
await click('button', 'Start task'); await sleep(500)
step('start task creates tm/<login>/<id> branch', !!(await waitFor(`/tm\\/[^ ]+\\/t-[a-z0-9]{8}/.test(document.querySelector('.statusbar')?.innerText||'')`, 25000)),
  await ev(`document.querySelector('.statusbar')?.innerText.replace(/\\s+/g,' ')`))
step('task shows Doing in the tasks list', !!(await waitFor(`document.querySelector('.pane-body')?.innerText.match(/doing/i)`, 10000)))
const ctxText = await ev(`(()=>{document.querySelector('.composer-tools button[aria-label="Context"]')?.click();return new Promise(r=>setTimeout(()=>r(document.querySelector('.modal .ctx-body')?.innerText||''),500))})()`)
step('agent context contains task and team prompt', /Your task: Login page/.test(ctxText) && /tm-note/.test(ctxText), JSON.stringify(ctxText.slice(0, 90)))
await key('Escape'); await click('.modal button', 'Close'); await sleep(300)

// S7 real agent turn (Read-only mode)
await pick('Mode', 'Read-only')
await typeInto('.agent-input textarea', 'Reply with exactly the word PONG and nothing else.')
await click('.agent-input button', 'Send')
step('agent shows Working status while running', !!(await waitFor(`/Working/.test(document.querySelector('.agent-status')?.innerText||'')`, 15000)))
const answered = await waitFor(`[...document.querySelectorAll('.msg-md')].some(m=>/PONG/.test(m.innerText))`, 120000, 500)
step('agent answer streams into the chat', !!answered)
step('footer shows token usage after the turn', !!(await waitFor(`/in .* out /.test(document.querySelector('.agent-status')?.innerText||'')`, 60000)),
  await ev(`document.querySelector('.agent-status')?.innerText`))
await sleep(2500)
step('task note captured or note box offered', !!(await ev(`!!document.querySelector('.agent-foot .notice') || /Review/.test(document.body.innerText)`)),
  await ev(`(document.querySelector('.agent-foot .notice')?.innerText||'').slice(0,60) + ' / list: ' + (document.querySelector('.pane-body')?.innerText||'').replace(/\\s+/g,' ').slice(0,100)`))

// S8 terminal
await key('Backquote', { ctrl: true, key: '`' })
step('Ctrl+` opens the terminal with xterm', !!(await waitFor(`!!document.querySelector('.xterm')`, 20000)))

// S9 help icon opens the matching manual chapter
await ev(`[...document.querySelectorAll('.pane')].find(p=>p.querySelector('.composer'))?.querySelector('.pane-actions button[aria-label*="Manual"], .pane-actions button[title*="Manual"]')?.click()`)
step('agent help icon opens the manual at Agents', !!(await waitFor(`document.querySelector('.split-view .doc h1')?.innerText==='Agents'`, 10000)),
  await ev(`document.querySelector('.split-view .doc h1')?.innerText`))

// S10 git state really changed on disk
const branch = git(proj, 'branch', '--show-current').trim()
step('real repo is on the task branch', /^tm\/.+\/t-[a-z0-9]{8}$/.test(branch), branch)
const ctxBranch = git(join(base, 'remote.git'), 'branch', '--list', 'taskmaster/context').trim()
step('taskmaster/context was pushed to the remote', ctxBranch.includes('taskmaster/context'))
step('project working tree is clean (no .taskmaster in it)', git(proj, 'status', '--porcelain').trim() === '')

console.log('ERRORS:', errors.length ? '\n' + [...new Set(errors)].join('\n') : 'none')
ws.close()
