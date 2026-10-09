import { useState } from 'react'
import { STATUSES, type Task, type TaskStatus } from '@shared/team'
import { errMsg } from '../ipc'
import { useApp } from '../stores/app'
import { useEditor } from '../stores/editor'
import { useTeam, roleName } from '../stores/team'
import { openMenu, toast, confirmDialog } from '../stores/ui'
import { registerCommand } from '../commands'
import { showPanel } from '../layout'
import { startTask, setTaskStatus } from '../tasks'
import { tr, useT } from '../i18n'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Empty'
import { Dropdown } from '../components/Dropdown'
import { sidebarViews } from './registry'
import { EnableBox } from './TeamBanner'
import { HelpIcon } from './HelpIcon'

const ORDER: TaskStatus[] = ['doing', 'todo', 'review', 'done']
const ICON: Record<TaskStatus, string> = { todo: 'circle-large-outline', doing: 'play-circle', review: 'eye', done: 'pass' }

export const openTask = (t: Task): void => useEditor.getState().open({ kind: 'task', taskId: t.id, title: t.title }, true)

export async function newTaskFlow(): Promise<void> {
  const st = useTeam.getState()
  if (st.status !== 'enabled') return
  // No title prompt: the task opens straight away and its title field is focused and selected.
  try {
    const task = await st.createTask(tr('tasks.untitled'))
    useEditor.getState().open({ kind: 'task', taskId: task.id, title: task.title }, false)
  } catch (e) { toast(errMsg(e), 'error') }
}

function Row({ task, selected, onPick }: { task: Task; selected: boolean; onPick: (task: Task, how: 'open' | 'toggle' | 'range') => void }) {
  const t = useT()
  const role = useTeam((s) => s.data?.team.roles.find((r) => r.id === task.role))
  return (
    <div className={`row${selected ? ' sel' : ''}`} role="button" aria-pressed={selected} tabIndex={0} title={task.title}
      onClick={(e) => onPick(task, e.shiftKey ? 'range' : e.ctrlKey || e.metaKey ? 'toggle' : 'open')}
      onKeyDown={(e) => { if (e.key === 'Enter') onPick(task, 'open'); else if (e.key === ' ') { e.preventDefault(); onPick(task, 'toggle') } }}>
      <Icon name={ICON[task.status]} />
      <span className="ellipsis flex1">{task.title}</span>
      <span className="tag ellipsis" style={{ maxWidth: 80 }}>{roleName(t, role)}</span>
      {task.assignee
        ? <span className="avatar-letter" style={{ width: 16, height: 16, fontSize: 10 }} title={`@${task.assignee}`}>{task.assignee[0].toUpperCase()}</span>
        : <span style={{ width: 16 }} />}
    </div>
  )
}

export function Tasks() {
  const t = useT()
  const { status, data, me } = useTeam()
  const [mine, setMine] = useState(true)
  const [role, setRole] = useState('')
  const [shut, setShut] = useState<Record<TaskStatus, boolean>>({ doing: false, todo: false, review: false, done: true })
  const [sel, setSel] = useState<string[]>([]) // selected task ids (Ctrl+click toggles, Shift+click selects a range, Space toggles)
  const [anchor, setAnchor] = useState<string | null>(null)
  if (status !== 'enabled' || !data) return <EnableBox />
  const list = data.tasks.filter((x) => (!mine || x.assignee === me) && (!role || x.role === role))
  const shown = ORDER.flatMap((st) => (shut[st] ? [] : list.filter((x) => x.status === st))) // rows in display order
  const picked = sel.filter((id) => shown.some((x) => x.id === id))
  const pick = (task: Task, how: 'open' | 'toggle' | 'range') => {
    if (how === 'range' && anchor) {
      const a = shown.findIndex((x) => x.id === anchor), b = shown.findIndex((x) => x.id === task.id)
      if (a >= 0 && b >= 0) { setSel(shown.slice(Math.min(a, b), Math.max(a, b) + 1).map((x) => x.id)); return }
    }
    if (how === 'toggle' || how === 'range') { setSel(picked.includes(task.id) ? picked.filter((id) => id !== task.id) : [...picked, task.id]); setAnchor(task.id); return }
    setSel([]); setAnchor(task.id); openTask(task)
  }
  const bulk = async (fn: (task: Task) => Promise<void>) => {
    for (const id of picked) { const task = data.tasks.find((x) => x.id === id); if (task) await fn(task) }
  }
  const bulkDelete = async () => {
    const ok = await confirmDialog({ title: t('tasks.bulk.deleteTitle', { n: picked.length }), text: t('tasks.bulk.deleteText'), danger: true, confirmLabel: t('tasks.bulk.delete') })
    if (!ok) return
    try { await bulk((x) => useTeam.getState().deleteTask(x.id)); toast(t('tasks.bulk.deleted', { n: picked.length })); setSel([]) } catch (e) { toast(errMsg(e), 'error') }
  }
  return (
    <div style={{ paddingBottom: 16 }}>
      <div style={{ display: 'flex', gap: 6, padding: 8, alignItems: 'center' }}>
        <div className="tabs-inline">
          <button className={`btn${mine ? ' on' : ''}`} onClick={() => setMine(true)}><Icon name="account" />{t('tasks.mine')}</button>
          <button className={`btn${!mine ? ' on' : ''}`} onClick={() => setMine(false)}><Icon name="list-flat" />{t('tasks.all')}</button>
        </div>
        <Dropdown variant="pill" className="flex1" ariaLabel={t('task.role')} value={role}
          options={[{ value: '', label: t('tasks.allRoles') }, ...data.team.roles.map((r) => ({ value: r.id, label: roleName(t, r) }))]}
          onChange={setRole} />
      </div>
      {picked.length > 0 && (
        <div className="bulk-bar">
          <span className="dim small">{t('tasks.selected', { n: picked.length })}</span>
          <Dropdown variant="pill" ariaLabel={t('tasks.bulk.status')} value=""
            options={[{ value: '', label: t('tasks.bulk.status') }, ...STATUSES.map((st) => ({ value: st, label: t(`status.${st}`) }))]}
            onChange={(v) => { if (v) void bulk((x) => setTaskStatus(x.id, v as TaskStatus)) }} />
          <button className="btn btn-small" onClick={() => void bulk((x) => setTaskStatus(x.id, 'done'))}><Icon name="pass" />{t('tasks.bulk.done')}</button>
          {me && <button className="btn btn-small" onClick={() => void bulk((x) => useTeam.getState().saveTask({ ...x, assignee: me })).catch((e) => toast(errMsg(e), 'error'))}><Icon name="account" />{t('tasks.bulk.assignMe')}</button>}
          <button className="btn btn-small btn-delete" onClick={() => void bulkDelete()}><Icon name="trash" />{t('tasks.bulk.delete')}</button>
          <button className="icon-btn" title={t('tasks.bulk.clear')} aria-label={t('tasks.bulk.clear')} onClick={() => setSel([])}><Icon name="close" /></button>
        </div>
      )}
      {list.length === 0 && <Empty text={t(mine ? 'tasks.emptyMine' : 'tasks.empty')} />}
      {ORDER.map((s) => {
        const items = list.filter((x) => x.status === s)
        if (!items.length) return null
        return (
          <div key={s}>
            <button className="section-h" style={{ padding: '0 8px' }} aria-expanded={!shut[s]} onClick={() => setShut({ ...shut, [s]: !shut[s] })}>
              <Icon name={shut[s] ? 'chevron-right' : 'chevron-down'} />
              <span className="ellipsis">{t(`status.${s}`)}</span>
              <span className="badge">{items.length}</span>
            </button>
            {!shut[s] && items.map((x) => <Row key={x.id} task={x} selected={picked.includes(x.id)} onPick={pick} />)}
          </div>
        )
      })}
    </div>
  )
}

function TasksActions() {
  const t = useT()
  const enabled = useTeam((s) => s.status === 'enabled')
  return (
    <>
      <HelpIcon chapter="05-tasks.md" />
      {enabled && <button className="icon-btn" title={t('tasks.new')} aria-label={t('tasks.new')} onClick={() => void newTaskFlow()}><Icon name="add" /></button>}
    </>
  )
}

function TasksBadge() {
  const n = useTeam((s) => (s.data && s.me ? s.data.tasks.filter((x) => x.assignee === s.me && x.status !== 'done').length : 0))
  return n > 0 ? <span className="badge">{n}</span> : null
}

sidebarViews.push({ id: 'tasks', title: 'view.tasks', icon: 'checklist', Comp: Tasks, Actions: TasksActions, Badge: TasksBadge })

registerCommand(
  { id: 'view.tasks', title: 'cmd.tasks', run: () => { useApp.getState().setView('tasks'); showPanel('side') } },
  { id: 'task.new', title: 'cmd.newTask', run: newTaskFlow },
  {
    id: 'task.start', title: 'cmd.startTask',
    run: () => {
      const { data, me } = useTeam.getState()
      const ready = (data?.tasks ?? []).filter((x) => x.status !== 'done' && x.status !== 'doing' && (!x.assignee || x.assignee === me))
      if (!ready.length) { toast(tr('tasks.noneToStart')); return }
      openMenu(window.innerWidth / 2 - 160, 80, ready.map((x) => ({ label: x.title, run: () => void startTask(x.id) })))
    }
  }
)
