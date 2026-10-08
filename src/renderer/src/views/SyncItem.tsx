import { presenceStatus } from '@shared/team'
import { call, errMsg } from '../ipc'
import { useApp } from '../stores/app'
import { useTeam } from '../stores/team'
import { confirmDialog, toast } from '../stores/ui'
import { tr, useT } from '../i18n'
import { Icon } from '../components/Icon'
import { statusLeft } from './registry'
import { useNow } from './useNow'

async function resolveConflict(error: string | null): Promise<void> {
  const ok = await confirmDialog({ title: tr('sync.conflict.title'), text: `${tr('sync.conflict.text')}${error ? `\n\n${error}` : ''}`, danger: true, confirmLabel: tr('sync.reset') })
  if (ok) await call('team.resetToRemote').catch((e) => toast(errMsg(e), 'error'))
}

function SyncItem() {
  const t = useT()
  const now = useNow()
  const { status, data, sync } = useTeam()
  const paused = useApp((s) => s.settings!.syncPaused)
  if (status !== 'enabled' || !data) return null
  const online = data.presence.filter((p) => presenceStatus(p, now) !== 'offline').length
  const key = paused ? 'paused' : sync.state
  const icon = paused ? 'debug-pause' : sync.state === 'syncing' ? 'sync' : sync.state === 'offline' ? 'debug-disconnect' : sync.state === 'conflict' ? 'warning' : 'organization'
  const title = `${t(`sync.${key}`)}${sync.error ? ` — ${sync.error}` : ''}`
  return (
    <button className="sb-item" title={title} aria-label={title}
      onClick={() => { if (sync.state === 'conflict') void resolveConflict(sync.error); else void call('team.syncNow').catch((e) => toast(errMsg(e), 'error')) }}>
      <Icon name={icon} className={sync.state === 'conflict' ? 'danger' : ''} />
      <span className={sync.state === 'conflict' ? 'danger' : ''}>{sync.state === 'conflict' ? t('sync.conflict') : t('sync.online', { n: online })}</span>
    </button>
  )
}

statusLeft.push(SyncItem)
