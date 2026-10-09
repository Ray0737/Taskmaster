import { useApp } from '../stores/app'
import { useTeam } from '../stores/team'
import { useNotices, unreadCount, type Notice } from '../stores/notices'
import { registerCommand } from '../commands'
import { showPanel } from '../layout'
import { useT } from '../i18n'
import { ago } from '../util'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Empty'
import { sidebarViews } from './registry'
import { openTask } from './Tasks'

const ICON = { assigned: 'person', note: 'comment', started: 'play-circle' } as const

function Row({ n }: { n: Notice }) {
  const t = useT()
  const lang = useApp((s) => s.settings?.lang ?? 'en')
  const data = useTeam((s) => s.data)
  const at = ago(n.at, lang)
  if (n.kind === 'proposal') {
    return (
      <div className="notice-card">
        <div className="notice-head">
          <Icon name="sparkle" />
          <span className="ellipsis flex1">{t('notices.proposal', { login: n.login })}</span>
          <span className="dim small">{at}</span>
        </div>
        <div className="notice-title">{n.title}</div>
        {n.brief && <div className="dim small notice-brief">{n.brief}</div>}
        {n.state === 'open'
          ? (
            <div className="notice-actions">
              <button className="btn btn-primary btn-small" onClick={() => void useNotices.getState().approve(n.id)}>{t('notices.approve')}</button>
              <button className="btn btn-small" onClick={() => useNotices.getState().dismiss(n.id)}>{t('notices.dismiss')}</button>
            </div>
          )
          : <span className="tag">{t(n.state === 'approved' ? 'notices.state.approved' : 'notices.state.dismissed')}</span>}
      </div>
    )
  }
  const task = data?.tasks.find((x) => x.id === n.taskId)
  const text = t(`notices.${n.kind}`, { login: n.login ?? '', task: task?.title ?? n.taskId })
  return (
    <button className={`row row-tall notice-row${n.read ? '' : ' unread'}`} title={text} disabled={!task}
      onClick={() => { useNotices.getState().markRead(n.id); if (task) openTask(task) }}>
      <Icon name={ICON[n.kind]} />
      <span className="session-text">
        <span className="ellipsis">{text}</span>
        <span className="dim small">{at}</span>
      </span>
    </button>
  )
}

export function Notifications() {
  const t = useT()
  const items = useNotices((s) => s.items)
  return (
    <div style={{ paddingBottom: 16 }}>
      {items.length === 0 && <Empty text={t('notices.empty')} />}
      {items.map((n) => <Row key={n.id} n={n} />)}
    </div>
  )
}

function NotificationsActions() {
  const t = useT()
  const items = useNotices((s) => s.items)
  return (
    <>
      <button className="icon-btn" title={t('notices.markRead')} aria-label={t('notices.markRead')} disabled={unreadCount(items) === 0} onClick={() => useNotices.getState().markAllRead()}><Icon name="check-all" /></button>
      <button className="icon-btn" title={t('notices.clear')} aria-label={t('notices.clear')} disabled={items.length === 0} onClick={() => useNotices.getState().clear()}><Icon name="clear-all" /></button>
    </>
  )
}

function NoticeBadge() {
  const n = useNotices((s) => unreadCount(s.items))
  return n > 0 ? <span className="badge">{n}</span> : null
}

sidebarViews.push({ id: 'notifications', title: 'view.notifications', icon: 'bell', Comp: Notifications, Actions: NotificationsActions, Badge: NoticeBadge })

registerCommand({ id: 'view.notifications', title: 'cmd.notifications', run: () => { useApp.getState().setView('notifications'); showPanel('side') } })
