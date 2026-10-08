import { useT } from '../i18n'

export function BottomPanel() {
  const t = useT()
  return <div className="pane"><div className="panel-tabs"><span className="panel-tab active">{t('panel.terminal')}</span></div></div>
}
