import { useApp } from '../stores/app'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { sidebarViews } from './registry'

export function Sidebar() {
  const t = useT()
  const view = useApp((s) => s.view)
  const v = sidebarViews.find((x) => x.id === view) ?? sidebarViews[0]
  if (!v) return <div className="pane" />
  return (
    <div className="pane">
      <div className="pane-title">
        <span className="ellipsis"><Icon name={v.icon} /> {t(v.title)}</span>
        {v.Actions && <div className="pane-actions"><v.Actions /></div>}
      </div>
      <div className="pane-body scroll"><v.Comp /></div>
    </div>
  )
}
