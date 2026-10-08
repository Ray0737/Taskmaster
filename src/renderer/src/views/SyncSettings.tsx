import { call, errMsg } from '../ipc'
import { useApp } from '../stores/app'
import { toast } from '../stores/ui'
import { useT } from '../i18n'
import { Field } from '../components/Field'
import { Dropdown } from '../components/Dropdown'
import { Group } from '../components/Group'
import { Icon } from '../components/Icon'
import { settingsSections } from './registry'

function SyncSection() {
  const t = useT()
  const s = useApp((x) => x.settings!)
  const set = useApp((x) => x.set)
  return (
    <Group icon="sync" title={t('settings.group.sync')} desc={t('settings.group.sync.desc')}>
      <Field label={t('settings.sync.interval')}>
        <Dropdown ariaLabel={t('settings.sync.interval')} value={String(s.fetchInterval)}
          options={[15, 30, 60].map((n) => ({ value: String(n), label: t('settings.sync.seconds', { n }) }))}
          onChange={(v) => void set({ fetchInterval: Number(v) as 15 | 30 | 60 })} />
      </Field>
      <label className="field-inline">
        <input type="checkbox" className="check" checked={s.syncPaused}
          onChange={async (e) => { await set({ syncPaused: e.target.checked }); if (!e.target.checked) void call('team.syncNow').catch((err) => toast(errMsg(err), 'error')) }} />
        {t('settings.sync.pause')}
      </label>
      <div><button className="btn" onClick={() => void call('team.syncNow').catch((e) => toast(errMsg(e), 'error'))}><Icon name="sync" />{t('sync.now')}</button></div>
    </Group>
  )
}

settingsSections.push({ id: 'sync', title: 'settings.sync', Comp: SyncSection })
