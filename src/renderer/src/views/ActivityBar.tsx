import { useApp } from '../stores/app'
import { useT } from '../i18n'
import { togglePanel, showPanel } from '../layout'
import { runCommand } from '../commands'
import { Icon } from '../components/Icon'
import { sidebarViews, activityBottom } from './registry'

export function ActivityBar() {
  const t = useT()
  const view = useApp((s) => s.view)
  const sideOpen = useApp((s) => s.open.side)
  const setView = useApp((s) => s.setView)
  return (
    <nav className="activitybar" aria-label="Views">
      <div>
        {sidebarViews.map((v) => (
          <button key={v.id} className={`ab-item${view === v.id && sideOpen ? ' active' : ''}`} title={t(v.title)} aria-label={t(v.title)}
            onClick={() => {
              if (view === v.id) togglePanel('side')
              else { setView(v.id); showPanel('side') }
            }}>
            <Icon name={v.icon} />
            {v.Badge && <v.Badge />}
          </button>
        ))}
      </div>
      <div>
        {activityBottom.map((C, i) => <C key={i} />)}
        <button className="ab-item" title={t('cmd.settings')} aria-label={t('cmd.settings')} onClick={() => runCommand('settings.open')}>
          <Icon name="settings-gear" />
        </button>
      </div>
    </nav>
  )
}
