// Real GitHub run: clone a repo through the GitHub list, enable the team layer, start a task, commit, sync.
// It pushes branches `taskmaster/context` and `tm/<login>/<task id>` to that repo and DELETES them again at the end.
// Usage: node 04-github-repo.mjs <port> <workDir> <owner/repo>
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const port = process.argv[2] || '9333'
const work = process.argv[3]
const full = process.argv[4]
const name = full.split('/')[1]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] })

rmSync(work, { recursive: true, force: true })
mkdirSync(join(work, 'anchor'), { recursive: true }) // "recent" project, so the clone dialog defaults to this folder

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
const typeInto = (sel, text) => ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return false;const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(text)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
const key = (code, opts = {}) => ev(`(()=>{const e=new KeyboardEvent('keydown',{code:${JSON.stringify(code)},key:${JSON.stringify(opts.key ?? code)},ctrlKey:${!!opts.ctrl},bubbles:true,cancelable:true});(document.querySelector(${JSON.stringify(opts.target ?? 'body')})||document.body).dispatchEvent(e);return true})()`)
const step = (n, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? '  — ' + extra : ''}`)

let clone = ''
let taskBranch = ''
try {
  await send('Runtime.enable'); await send('Page.enable'); await sleep(1000)
  await ev(`window.tm.invoke('settings.set',{setupDone:true,lang:'en'})`)
  await ev(`window.tm.invoke('recent.add', ${JSON.stringify(join(work, 'anchor'))})`)
  await send('Page.reload'); await sleep(2500)

  // 1. GitHub repo list through the app
  const repos = await ev(`window.tm.invoke('auth.repos').then(l=>l.map(r=>({n:r.fullName,p:r.private})))`)
  const mine = Array.isArray(repos) ? repos.find((r) => r.n.toLowerCase() === full.toLowerCase()) : null
  step('GitHub repo list loads and contains the repo', !!mine, mine ? `private=${mine.p}` : `repos: ${Array.isArray(repos) ? repos.length : repos}`)
  if (!mine) throw new Error('repo not found in the list')

  // 2. Clone through the dialog
  await click('.home-btn', 'Clone repository'); await sleep(800)
  step('clone dialog lists the repo with a private tag', !!(await waitFor(`[...document.querySelectorAll('.repo-list .row')].some(r=>r.innerText.includes(${JSON.stringify(name)}))`, 20000)),
    await ev(`[...document.querySelectorAll('.repo-list .row')].find(r=>r.innerText.includes(${JSON.stringify(name)}))?.innerText.replace(/\\s+/g,' ')`))
  await typeInto('.modal input[aria-label="Search your repositories"]', name); await sleep(400)
  await click('.repo-list .row', name); await sleep(400)
  await click('.modal-actions button', 'Clone')
  step('clone finishes and the project opens', !!(await waitFor(`[...document.querySelectorAll('.tree-row')].length>0`, 90000, 500)),
    await ev(`[...document.querySelectorAll('.tree-row')].map(r=>r.innerText.trim()).slice(0,6).join(' | ')`))
  clone = join(work, name)
  step('clone landed in the work folder on main', git(clone, 'branch', '--show-current').trim().length > 0, git(clone, 'branch', '--show-current').trim())
  await sleep(3500)

  // 3. Enable the team layer (pushes taskmaster/context)
  await click('.ab-item', 'Tasks')
  await waitFor(`[...document.querySelectorAll('button')].some(b=>/Enable Taskmaster/.test(b.innerText))`, 20000)
  await click('button', 'Enable Taskmaster')
  step('Enable Taskmaster succeeds', !!(await waitFor(`document.querySelector('.tabs-inline')?.innerText.includes('Mine')`, 60000)))
  await sleep(4000)
  const remoteHeads = git(clone, 'ls-remote', '--heads', 'origin')
  step('taskmaster/context exists on GitHub', remoteHeads.includes('refs/heads/taskmaster/context'))
  step('working tree has no .taskmaster folder and is clean', git(clone, 'status', '--porcelain').trim() === '')

  // 4. Task, start, commit, sync
  await click('.pane-actions button', 'New task'); await sleep(500)
  await typeInto('.modal input.input', 'Private repo check')
  await key('Enter'); await sleep(1500)
  await waitFor(`[...document.querySelectorAll('.tab')].some(t=>t.innerText.includes('Private repo check'))`, 20000)
  await waitFor(`[...document.querySelectorAll('button')].some(b=>/Start task/.test(b.innerText))`, 20000)
  await click('button', 'Start task')
  await waitFor(`/tm\\/[^ ]+\\/t-[a-z0-9]{8}/.test(document.querySelector('.statusbar')?.innerText||'')`, 40000)
  taskBranch = git(clone, 'branch', '--show-current').trim()
  step('task branch created from the default branch', /^tm\/.+\/t-[a-z0-9]{8}$/.test(taskBranch), taskBranch)
  // Safety: never commit or push unless we are on the task branch. A commit on main would reach the user's real repo.
  if (!/^tm\/.+\/t-[a-z0-9]{8}$/.test(taskBranch)) throw new Error(`not on a task branch (${taskBranch}); stopping before any commit`)

  writeFileSync(join(clone, 'taskmaster-check.txt'), 'created by the Taskmaster check, safe to delete\n')
  await sleep(2500)
  await click('.ab-item', 'Source Control'); await sleep(800)
  await click('button', 'Stage All'); await sleep(1200)
  await typeInto('.scm-commit textarea', 'taskmaster check')
  await key('Enter', { ctrl: true, key: 'Enter', target: '.scm-commit textarea' }); await sleep(2500)
  step('commit made on the task branch', git(clone, 'log', '-1', '--format=%s').trim() === 'taskmaster check')
  await click('.scm-branch button', 'Sync|↑'); await sleep(500)
  step('Sync pushes the task branch to GitHub', !!(await waitFor(`/↑0 ↓0/.test(document.querySelector('.scm-branch')?.innerText||'')`, 60000)) && git(clone, 'ls-remote', '--heads', 'origin', taskBranch).includes(taskBranch))
  step('Open pull request button is offered on the task branch', !!(await ev(`[...document.querySelectorAll('button')].some(b=>/Open pull request/.test(b.innerText))`)))
  const url = await ev(`window.tm.invoke('git.remoteUrl')`)
  step('remote URL is a GitHub URL the PR helper accepts', /github\.com/i.test(String(url)), String(url))
  console.log('expected PR page:', `https://github.com/${full}/pull/new/${taskBranch}`)
  console.log('ERRORS:', errors.length ? '\n' + [...new Set(errors)].join('\n') : 'none')
} catch (e) {
  console.log('STOPPED:', e.message)
} finally {
  // Remove what this run created on GitHub, then the local clone.
  try {
    if (!clone || !existsSync(join(clone, '.git'))) { console.log('cleanup: no clone, nothing was pushed'); ws.close(); process.exit(0) }
    const heads = git(clone, 'ls-remote', '--heads', 'origin')
    const mineBranches = heads.split('\n').map((l) => l.split('\t')[1]?.replace('refs/heads/', '')).filter((b) => b && (b === 'taskmaster/context' || /^tm\/.+\/t-[a-z0-9]{8}$/.test(b)))
    if (mineBranches.length) git(clone, 'push', 'origin', '--delete', ...mineBranches)
    console.log('cleanup: deleted remote branches', JSON.stringify(mineBranches))
    console.log('remote heads now:', git(clone, 'ls-remote', '--heads', 'origin').trim().split('\n').map((l) => l.split('\t')[1]).join(', '))
  } catch (e) { console.log('cleanup problem:', e.message) }
  ws.close()
}
