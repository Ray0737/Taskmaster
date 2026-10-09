// Compact composer, usage icon only for Claude Code, "agent running" presence, the Notifications tab, and approve-first task proposals
// from the agent (<tm-assign>), with one real short agent turn. Needs the fixture from script 01.
// Usage: node 10-notifications-proposals.mjs <port> <fixtureDir>
import { join, dirname } from 'node:path'
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
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
const pick = async (label, option) => { await ev(`document.querySelector('button[role=combobox][aria-label="${label}"]')?.click()`); await sleep(250); return click('.dd-item', option) }
const step = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
const reopen = async () => { await send('Page.reload'); await sleep(2500); await click('.recent-row', 'demo app'); await waitFor(`!!document.querySelector('.activitybar')`); await sleep(1500) }
const tasksNow = async () => (await ev(`window.tm.invoke('team.read')`))?.tasks ?? []

await send('Runtime.enable'); await send('Page.enable'); await sleep(800)
await ev(`window.tm.invoke('settings.set',{setupDone:true,lang:'en'})`); await ev(`window.tm.invoke('recent.add', ${JSON.stringify(proj)})`)
await send('Page.reload'); await sleep(2500)
await click('.recent-row', 'demo app'); await waitFor(`!!document.querySelector('.activitybar')`); await sleep(1500)

// a second team member to propose work for
const team0 = (await ev(`window.tm.invoke('team.read')`)).team
if (!team0.members.some((m) => m.login === 'tmbot-b')) await ev(`window.tm.invoke('team.saveTeam', ${JSON.stringify({ ...team0, members: [...team0.members, { login: 'tmbot-b', role: 'frontend', joinedAt: new Date().toISOString() }] })})`)
await reopen()

// ---- compact composer and usage icon
const tools = await ev(`(()=>{const t=document.querySelector('.composer-tools');const dds=[...t.querySelectorAll('.dd')];return {n:dds.length,labels:dds.map(d=>d.querySelector('.dd-label')?.innerText??null),fits:t.scrollWidth<=t.clientWidth+1}})()`)
step('agent, model and mode pickers are icon-only', tools.labels[0] === null && tools.labels[1] === null && tools.labels[2] === null, JSON.stringify(tools.labels))
step('the composer toolbar fits on one line', tools.fits)
step('Claude Code selected: the usage icon shows', !!(await ev(`!!document.querySelector('.pane-limits .tb-limit .codicon-graph') && !!document.querySelector('.tb-right .tb-limit')`)))
const agentOpts = await ev(`(async()=>{document.querySelector('button[role=combobox][aria-label="Agent"]').click();await new Promise(r=>setTimeout(r,250));const o=[...document.querySelectorAll('.dd-item')].map(x=>x.innerText.trim());document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));document.querySelector('.dd-list')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return o})()`)
const other = agentOpts.find((o) => !/claude/i.test(o))?.split(' ')[0] // first word: the label has parentheses, which a regex would read as a group
if (other) {
  await pick('Agent', other); await sleep(500)
  step(`another agent (${other}) selected: no usage icon, no model or mode picker`, !(await ev(`!!document.querySelector('.tb-limit')`)) && !(await ev(`!!document.querySelector('button[aria-label="Model"]')`)))
  await pick('Agent', 'Claude'); await sleep(500)
  step('back on Claude Code: the usage icon returns', !!(await ev(`!!document.querySelector('.tb-limit')`)))
} else { console.log('SKIP  no second agent installed; usage hiding not exercised') }

// ---- teammate presence in the Team view (a presence file written as if by tmbot-b)
let wt = null
const wtRoot = join(profile, 'worktrees')
for (const d of existsSync(wtRoot) ? readdirSync(wtRoot) : []) if (existsSync(join(wtRoot, d, '.taskmaster', 'team.json'))) wt = join(wtRoot, d)
const login = (await tasksNow())[0]
mkdirSync(join(wt, '.taskmaster', 'presence'), { recursive: true })
writeFileSync(join(wt, '.taskmaster', 'presence', 'tmbot-b.json'), JSON.stringify({ login: 'tmbot-b', taskId: login.id, branch: 'tm/tmbot-b/' + login.id, status: 'working', running: true, at: new Date().toISOString() }))
await reopen(); await click('.ab-item', 'team'); await sleep(800)
const rowText = await ev(`[...document.querySelectorAll('.row')].find(r=>/tmbot-b/.test(r.innerText))?.innerText||''`)
step("Team view shows a teammate's running agent and branch", /agent running on/.test(rowText) && /tm\/tmbot-b\//.test(rowText), rowText.split('\n').join(' | ').slice(0, 130))

// ---- our own presence flips to running during an agent turn
await pick('Mode', 'Read-only'); await sleep(300)
await typeInto('.agent-input textarea', 'Reply with exactly the numbers 1 to 30, one per line, and nothing else.')
await click('.agent-input button', 'Send')
let sawRunning = false
for (let i = 0; i < 60 && !sawRunning; i++) { await sleep(300); const me = ((await ev(`window.tm.invoke('team.read')`))?.presence ?? []).find((p) => p.login !== 'tmbot-b'); sawRunning = me?.running === true }
step('our presence shows the agent running during a turn', sawRunning)
await waitFor(`!document.querySelector('.send-btn.stop')`, 90000)
let ended = false
for (let i = 0; i < 40 && !ended; i++) { await sleep(500); const me = ((await ev(`window.tm.invoke('team.read')`))?.presence ?? []).find((p) => p.login !== 'tmbot-b'); ended = me?.running === false }
step('and goes back to not running afterwards', ended)

// ---- agent proposals
const before = (await tasksNow()).length
await typeInto('.agent-input textarea', 'Reply with exactly this text and nothing else: <tm-assign login="tmbot-b" title="E2E proposed task">Do the proposed thing.</tm-assign> <tm-assign login="ghost-user" title="E2E ghost task">Nobody.</tm-assign>')
await click('.agent-input button', 'Send')
step('a notification badge appears for the proposals', !!(await waitFor(`!!document.querySelector('.ab-item[aria-label="Notifications"] .badge')`, 120000)))
step('nothing was created before approval', (await tasksNow()).length === before)
await click('.ab-item', 'Notifications'); await sleep(600)
step('the Notifications tab lists both proposals', !!(await waitFor(`document.querySelectorAll('.notice-card').length===2`, 5000)))
// approve the one for the real member
await ev(`[...document.querySelectorAll('.notice-card')].find(c=>/E2E proposed task/.test(c.innerText))?.querySelector('.btn-primary')?.click()`); await sleep(2000)
let ts = await tasksNow()
const made = ts.find((x) => x.title === 'E2E proposed task')
step('approving creates the task assigned to the teammate', made?.assignee === 'tmbot-b' && made?.status === 'todo' && made?.createdBy !== 'tmbot-b', JSON.stringify({ a: made?.assignee, r: made?.role }))
step('the approved card shows as assigned', !!(await ev(`[...document.querySelectorAll('.notice-card')].some(c=>/E2E proposed task/.test(c.innerText)&&/Assigned/.test(c.innerText))`)))
// approving one for someone who is not on the team is refused
await ev(`[...document.querySelectorAll('.notice-card')].find(c=>/E2E ghost task/.test(c.innerText))?.querySelector('.btn-primary')?.click()`); await sleep(1200)
step('a proposal for a non-member is refused with a message', !!(await ev(`[...document.querySelectorAll('.toast')].some(x=>/not on this team/.test(x.innerText))`)) && !(await tasksNow()).some((x) => x.title === 'E2E ghost task'))
await ev(`[...document.querySelectorAll('.notice-card')].find(c=>/E2E ghost task/.test(c.innerText))?.querySelector('.btn:not(.btn-primary)')?.click()`); await sleep(500)
step('dismiss closes a proposal', !!(await ev(`[...document.querySelectorAll('.notice-card')].some(c=>/E2E ghost task/.test(c.innerText)&&/Dismissed/.test(c.innerText))`)))
// clean up
if (made) await ev(`window.tm.invoke('team.deleteTask', ${JSON.stringify(made.id)})`)
step('no script errors', errors.length === 0, errors[0] ?? '')
ws.close()
