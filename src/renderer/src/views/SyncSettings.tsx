import { call, errMsg } from '../ipc'
import { useApp } from '../stores/app'
import { toast } from '../stores/ui'
import { useT } from '../i18n'
import { Field } from '../components/Field'
import { settingsSections } from './registry'

function SyncSection() {
  const t = useT()
  const s = useApp((x) => x.settings!)
  const set = useApp((x) => x.set)
  return (
    <>
      <Field label={t('settings.sync.interval')}>
        <select className="select" value={s.fetchInterval} onChange={(e) => void set({ fetchInterval: Number(e.target.value) as 15 | 30 | 60 })}>
          {[15, 30, 60].map((n) => <option key={n} value={n}>{t('settings.sync.seconds', { n })}</option>)}
        </select>
      </Field>
      <label className="field-inline" style={{ marginBottom: 16 }}>
        <input type="checkbox" className="check" checked={s.syncPaused}
          onChange={async (e) => { await set({ syncPaused: e.target.checked }); if (!e.target.checked) void call('team.syncNow').catch((err) => toast(errMsg(err), 'error')) }} />
        {t('settings.sync.pause')}
      </label>
      <div><button className="btn" onClick={() => void call('team.syncNow').catch((e) => toast(errMsg(e), 'error'))}>{t('sync.now')}</button></div>
    </>
  )
}

settingsSections.push({ id: 'sync', title: 'settings.sync', Comp: SyncSection })
