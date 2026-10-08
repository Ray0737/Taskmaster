import { useEffect, useState } from 'react'
import { useApp } from '../stores/app'
import { useTeam } from '../stores/team'
import { useT } from '../i18n'
import { Empty } from '../components/Empty'
import { editorBanners } from './registry'

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

const dismissed = new Set<string>() // projects where the user chose "Not now" in this session

// Spec §12.3: shown above the editor when this project has no Taskmaster context yet.
export function EnableBanner() {
  const t = useT()
  const root = useApp((s) => s.root)
  const { status, busy } = useTeam()
  const [, bump] = useState(0)
  useEffect(() => { bump((n) => n + 1) }, [root])
  if (!root || status !== 'off' || busy || dismissed.has(root)) return null
  return (
    <div className="editor-bar">
      <span className="flex1">{t('team.enable.title')}</span>
      <button className="btn btn-primary" onClick={() => void useTeam.getState().enable()}>{t('team.enable')}</button>
      <button className="btn" onClick={() => { dismissed.add(root); bump((n) => n + 1) }}>{t('note.dismiss')}</button>
    </div>
  )
}

editorBanners.push(EnableBanner)
