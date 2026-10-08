import { useApp } from '../stores/app'
import { useTeam } from '../stores/team'
import { useT } from '../i18n'
import { Empty } from '../components/Empty'

// Shown in the Tasks and Team views until Taskmaster is enabled for the project.
export function EnableBox() {
  const t = useT()
  const root = useApp((s) => s.root)
  const { status, busy } = useTeam()
  if (!root) return <Empty text={t('team.needProject')} />
  if (status === 'unknown' || busy) return <Empty text={t('welcome.checking')} />
  return (
    <Empty text={t('team.enable.title')}>
      <div className="dim">{t('team.enable.text')}</div>
      <button className="btn btn-primary" onClick={() => void useTeam.getState().enable()}>{t('team.enable')}</button>
    </Empty>
  )
}
