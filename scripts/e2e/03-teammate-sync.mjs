// Third UI run: teammate B edits by hand over git, damaged file, PR button, sync pause. Usage: node e2e3.mjs <port> <fixtureDir>
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs'

const port = process.argv[2] || '9333'
const base = process.argv[3]
const proj = join(base, 'demo app')
const remote = join(base, 'remote.git')
const bdir = join(base, 'b-clone')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
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
const waitFor = async (expr, ms = 15000, step = 300) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { const v = await ev(expr); if (v && !String(v).startsWith('ERR')) return v; await sleep(step) }
  return false
}
const click = (sel, text) => ev(`(()=>{const rx=new RegExp(${JSON.stringify(text)},'i');const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>rx.test((e.innerText||'')+' '+(e.getAttribute('aria-label')||'')+' '+(e.title||'')));if(!el)return false;el.click();return true})()`)
const step = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
const treeText = `(document.querySelector('.pane-body')?.innerText||'').replace(/\\s+/g,' ')`

await send('Runtime.enable'); await send('Page.enable'); await sleep(1000)
await ev(`window.tm.invoke('recent.add', ${JSON.stringify(proj)})`)
await send('Page.reload'); await sleep(2500)
await click('.recent-row', 'demo app')
await waitFor(`[...document.querySelectorAll('.tree-row')].some(r=>r.innerText.includes('README.md'))`)
await sleep(3500)
await click('.ab-item', 'Tasks'); await sleep(800)
step('app shows the task before B edits it', !!(await ev(`/Login page/.test(${treeText})`)))

// Teammate B: clone, switch to the context branch, edit the task title, push.
rmSync(bdir, { recursive: true, force: true })
git(base, 'clone', '-q', remote, bdir)
git(bdir, 'switch', '-q', 'taskmaster/context')
const tdir = join(bdir, '.taskmaster', 'tasks')
const tfile = readdirSync(tdir).find((f) => /^t-[a-z0-9]{8}\.json$/.test(f))
const task = JSON.parse(readFileSync(join(tdir, tfile), 'utf8'))
task.title = 'Login page (edited by B)'
writeFileSync(join(tdir, tfile), JSON.stringify(task, null, 2) + '\n')
git(bdir, 'commit', '-q', '-am', 'b edits')
git(bdir, 'push', '-q')
step('B edit reaches the app within the fetch interval', !!(await waitFor(`/edited by B/.test(${treeText})`, 45000, 1000)), await ev(treeText + '.slice(0,120)'))

// Hand-damage: B pushes a truncated task file. Everything else must still show.
writeFileSync(join(tdir, 't-zzzzzzzz.json'), '{')
git(bdir, 'add', '-A'); git(bdir, 'commit', '-q', '-m', 'b breaks a file'); git(bdir, 'push', '-q')
await sleep(30000)
step('damaged teammate file is skipped, good tasks still shown', !!(await ev(`/edited by B/.test(${treeText})`)))
step('app did not crash on the damaged file', errors.length === 0, errors[0] ?? '')

// PR button on a non-GitHub remote must say so instead of failing.
await click('.ab-item', 'Source Control'); await sleep(800)
const hasPr = await ev(`[...document.querySelectorAll('button')].some(b=>/Open pull request/.test(b.innerText))`)
step('Open pull request button shows on the tm/ branch', !!hasPr)
await click('button', 'Open pull request'); await sleep(1200)
step('non-GitHub remote gives the "not on GitHub" toast', !!(await ev(`/not on GitHub/i.test(document.querySelector('.toasts')?.innerText||'')`)),
  await ev(`(document.querySelector('.toasts')?.innerText||'').replace(/\\s+/g,' ').slice(0,100)`))

// Settings -> Sync pause
await ev(`window.tm.invoke('settings.set',{syncPaused:true})`)
await send('Page.reload'); await sleep(2500)
await click('.recent-row', 'demo app')
await waitFor(`[...document.querySelectorAll('.tree-row')].some(r=>r.innerText.includes('README.md'))`)
await sleep(3500)
step('status bar shows the team sync item while paused', !!(await ev(`!!document.querySelector('.statusbar .sb-item[title*="paused"]')`)),
  await ev(`[...document.querySelectorAll('.statusbar .sb-item')].map(b=>b.title).filter(Boolean).join(' | ')`))
await ev(`window.tm.invoke('settings.set',{syncPaused:false})`)

console.log('ERRORS:', errors.length ? '\n' + [...new Set(errors)].join('\n') : 'none')
ws.close()
