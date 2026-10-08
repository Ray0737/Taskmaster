import { useT } from '../i18n'
import { Empty } from '../components/Empty'

export function AgentPanel() {
  const t = useT()
  return (
    <div className="pane">
      <div className="pane-title"><span className="ellipsis">{t('agent.title')}</span></div>
      <Empty text={t('agent.none')} />
    </div>
  )
}
