import { useState } from 'react'
import type { Task, TaskStatus } from '@shared/team'
import { errMsg } from '../ipc'
import { useApp } from '../stores/app'
import { useEditor } from '../stores/editor'
import { useTeam, roleName } from '../stores/team'
import { promptDialog, openMenu, toast } from '../stores/ui'
import { registerCommand } from '../commands'
import { showPanel } from '../layout'
import { startTask } from '../tasks'
import { tr, useT } from '../i18n'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Empty'
import { sidebarViews } from './registry'
import { EnableBox } from './TeamBanner'
import { HelpIcon } from './HelpIcon'

const ORDER: TaskStatus[] = ['doing', 'todo', 'review', 'done']
const ICON: Record<TaskStatus, string> = { todo: 'circle-large-outline', doing: 'play-circle', review: 'eye', done: 'pass' }

export const openTask = (t: Task): void => useEditor.getState().open({ kind: 'task', taskId: t.id, title: t.title }, true)

export async function newTaskFlow(): Promise<void> {
  const st = useTeam.getState()
  if (st.status !== 'enabled') return
  const title = await promptDialog(tr('tasks.newPrompt'))
  if (!title) return
  try { openTask(await st.createTask(title)) } catch (e) { toast(errMsg(e), 'error') }
}

function Row({ task }: { task: Task }) {
  const t = useT()
  const role = useTeam((s) => s.data?.team.roles.find((r) => r.id === task.role))
  return (
    <div className="row" role="button" tabIndex={0} title={task.title} onClick={() => openTask(task)} onKeyDown={(e) => { if (e.key === 'Enter') openTask(task) }}>
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
  if (status !== 'enabled' || !data) return <EnableBox />
  const list = data.tasks.filter((x) => (!mine || x.assignee === me) && (!role || x.role === role))
  return (
    <div style={{ paddingBottom: 16 }}>
      <div style={{ display: 'flex', gap: 6, padding: 8, alignItems: 'center' }}>
        <div className="tabs-inline">
          <button className={`btn${mine ? ' on' : ''}`} onClick={() => setMine(true)}>{t('tasks.mine')}</button>
          <button className={`btn${!mine ? ' on' : ''}`} onClick={() => setMine(false)}>{t('tasks.all')}</button>
        </div>
        <select className="select select-inline flex1" aria-label={t('task.role')} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">{t('tasks.allRoles')}</option>
          {data.team.roles.map((r) => <option key={r.id} value={r.id}>{roleName(t, r)}</option>)}
        </select>
      </div>
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
            {!shut[s] && items.map((x) => <Row key={x.id} task={x} />)}
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
