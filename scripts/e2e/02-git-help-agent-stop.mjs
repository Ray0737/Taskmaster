// Second UI run: help icons, git letters, stage/commit, Stop, session memory, Full warning. Usage: node e2e2.mjs <port> <fixtureDir>
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

const port = process.argv[2] || '9333'
const base = process.argv[3]
const proj = join(base, 'demo app')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' })

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
const waitFor = async (expr, ms = 15000, step = 250) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { const v = await ev(expr); if (v && !String(v).startsWith('ERR')) return v; await sleep(step) }
  return false
}
const click = (sel, text) => ev(`(()=>{const rx=new RegExp(${JSON.stringify(text)},'i');const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>rx.test((e.innerText||'')+' '+(e.getAttribute('aria-label')||'')+' '+(e.title||'')));if(!el)return false;el.click();return true})()`)
const typeInto = (sel, text) => ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return false;const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(text)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
const key = (code, opts = {}) => ev(`(()=>{const e=new KeyboardEvent('keydown',{code:${JSON.stringify(code)},key:${JSON.stringify(opts.key ?? code)},ctrlKey:${!!opts.ctrl},shiftKey:${!!opts.shift},bubbles:true,cancelable:true});(opts=>{})();(document.querySelector(${JSON.stringify(opts.target ?? 'body')})||document.body).dispatchEvent(e);return true})()`)
const setSelect = (labelRx, value) => ev(`(()=>{const s=[...document.querySelectorAll('select')].find(x=>new RegExp(${JSON.stringify(labelRx)},'i').test(x.getAttribute('aria-label')||''));if(!s)return false;Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(value)});s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
const step = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
const agentPane = `[...document.querySelectorAll('.pane')].find(p=>p.querySelector('.agent-head'))`
const sidePane = `[...document.querySelectorAll('.pane')].find(p=>p.querySelector('.pane-title') && !p.querySelector('.agent-head') && !p.querySelector('.panel-tabs'))`

await send('Runtime.enable'); await send('Page.enable'); await sleep(1000)
await ev(`window.tm.invoke('recent.add', ${JSON.stringify(proj)})`)
await send('Page.reload'); await sleep(2500)
await click('.recent-row', 'demo app')
await waitFor(`[...document.querySelectorAll('.tree-row')].some(r=>r.innerText.includes('README.md'))`)
await sleep(3000) // team attach

// Tasks list (case-insensitive) and help icons
await click('.ab-item', 'Tasks'); await sleep(800)
step('tasks list has the task under Doing (case-insensitive)', !!(await ev(`/doing/i.test(document.querySelector('.pane-body')?.innerText||'') && /Login page/.test(document.querySelector('.pane-body')?.innerText||'')`)),
  await ev(`(document.querySelector('.pane-body')?.innerText||'').replace(/\\s+/g,' ').slice(0,80)`))
await ev(`(${sidePane}).querySelector('.pane-actions button[aria-label*="Manual"]').click()`)
step('Tasks help icon opens chapter Tasks', !!(await waitFor(`document.querySelector('.split-view .doc h1')?.innerText==='Tasks'`, 8000)))
await click('.ab-item', 'Team'); await sleep(800)
await ev(`(${sidePane}).querySelector('.pane-actions button[aria-label*="Manual"]').click()`)
step('Team help icon opens chapter Team and roles', !!(await waitFor(`document.querySelector('.split-view .doc h1')?.innerText==='Team and roles'`, 8000)))
await ev(`(${agentPane}).querySelector('.pane-title .pane-actions button[aria-label*="Manual"]').click()`)
step('Agent help icon opens chapter Agents', !!(await waitFor(`document.querySelector('.split-view .doc h1')?.innerText==='Agents'`, 8000)))
step('team view lists you as lead', !!(await ev(`/lead/.test(document.body.innerText)`)))
await click('.ab-item', 'Explorer'); await sleep(500)

// git letters and stage/commit through the UI
writeFileSync(join(proj, 'README.md'), '# demo\nchanged\n')
writeFileSync(join(proj, 'new.txt'), 'hello\n')
await sleep(2500)
step('explorer shows M for README.md and U for new.txt', !!(await waitFor(`(()=>{const t=[...document.querySelectorAll('.tree-row')].map(r=>r.innerText.replace(/\\s+/g,' ').trim());return t.some(x=>/README\\.md M/.test(x)) && t.some(x=>/new\\.txt U/.test(x))})()`, 12000)),
  await ev(`[...document.querySelectorAll('.tree-row')].map(r=>r.innerText.replace(/\\s+/g,' ').trim()).join(' | ')`))
await click('.ab-item', 'Source Control'); await sleep(800)
step('source control lists both changes', !!(await ev(`/README\\.md/.test(document.querySelector('.pane-body').innerText) && /new\\.txt/.test(document.querySelector('.pane-body').innerText)`)))
await click('button', 'Stage All'); await sleep(1200)
step('stage all moves them to Staged Changes', !!(await ev(`/Staged Changes/i.test(document.querySelector('.pane-body').innerText)`)))
await typeInto('.scm-commit textarea', 'e2e commit\n\nsecond line')
await key('Enter', { ctrl: true, key: 'Enter', target: '.scm-commit textarea' }); await sleep(2500)
const subj = git(proj, 'log', '-1', '--format=%B').trim()
step('Ctrl+Enter commits with the exact multi-line message', subj === 'e2e commit\n\nsecond line', JSON.stringify(subj))
step('working tree is clean after commit', git(proj, 'status', '--porcelain').trim() === '')

// agent: Full warning, memory, Stop
await setSelect('Mode', 'bypassPermissions'); await sleep(300)
step('Full mode shows the red warning', !!(await ev(`/any command/.test((${agentPane}).innerText)`)))
await setSelect('Mode', 'plan'); await sleep(200)
await typeInto('.agent-input textarea', 'Remember the code word BANANA. Reply only OK.')
await click('.agent-input button', 'Send')
await waitFor(`[...document.querySelectorAll('.msg-md')].some(m=>/OK/.test(m.innerText))`, 120000, 500)
await waitFor(`/in .* out /.test(document.querySelector('.agent-status')?.innerText||'')`, 60000)
await ev(`(()=>{const b=[...document.querySelectorAll('.notice button')].find(x=>/Dismiss/i.test(x.innerText));b?.click()})()`)
await typeInto('.agent-input textarea', 'What code word did I ask you to remember? Reply with only that word.')
await click('.agent-input button', 'Send')
step('session memory: agent remembers the word', !!(await waitFor(`[...document.querySelectorAll('.msg-md')].some(m=>/BANANA/.test(m.innerText))`, 120000, 500)))
await waitFor(`/in .* out /.test(document.querySelector('.agent-status')?.innerText||'')`, 60000)

await typeInto('.agent-input textarea', 'Write a 600 word essay about trains. Do not use tools.')
await click('.agent-input button', 'Send')
await waitFor(`/Working/.test(document.querySelector('.agent-status')?.innerText||'')`, 15000)
await sleep(2500)
const before = (await ev(`(()=>{return 1})()`), execFileSync('powershell', ['-NoProfile', '-Command', "@(Get-Process claude -ErrorAction SilentlyContinue).Count"], { encoding: 'utf8' }).trim())
await click('.agent-input button', 'Stop')
step('Stop shows a Stopped notice and re-enables Send', !!(await waitFor(`/Stopped/.test((${agentPane}).innerText) && [...document.querySelectorAll('.agent-input button')].some(b=>/Send/.test(b.innerText))`, 15000)))
await sleep(2500)
const after = execFileSync('powershell', ['-NoProfile', '-Command', "@(Get-Process claude -ErrorAction SilentlyContinue).Count"], { encoding: 'utf8' }).trim()
step('no claude process left running after Stop', after === '0', `before stop: ${before}, after: ${after}`)

console.log('ERRORS:', errors.length ? '\n' + [...new Set(errors)].join('\n') : 'none')
ws.close()
