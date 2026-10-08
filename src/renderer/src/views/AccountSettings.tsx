import { useEffect, useState } from 'react'
import { useGit } from '../stores/git'
import { useSetup } from '../stores/setup'
import { useT } from '../i18n'
import { Field } from '../components/Field'
import { Group } from '../components/Group'
import { Icon } from '../components/Icon'
import { settingsSections } from './registry'

function Account() {
  const t = useT()
  const { identity, connecting } = useSetup()
  const account = useGit((s) => s.account)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  useEffect(() => { void useSetup.getState().check() }, [])
  useEffect(() => { setName(identity?.name ?? ''); setEmail(identity?.email ?? '') }, [identity])
  const changed = name !== (identity?.name ?? '') || email !== (identity?.email ?? '')
  return (
    <>
      <Group icon="account" title={t('settings.account.identity')}>
        <Field label={t('welcome.identity.name')}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('welcome.identity.email')}>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div>
          <button className="btn btn-primary" disabled={!changed || !name.trim() || !email.includes('@')}
            onClick={() => void useSetup.getState().saveIdentity({ name, email })}><Icon name="save" />{t('welcome.identity.save')}</button>
        </div>
      </Group>
      <Group icon="github" title={t('settings.account.github')}>
        <div style={{ marginBottom: 8 }}>
          {account ? t('settings.account.connected', { login: account.login }) : t('settings.account.none')}
        </div>
        <button className="btn" disabled={connecting} onClick={() => void useSetup.getState().connect()}><Icon name="refresh" />{t('settings.account.reconnect')}</button>
      </Group>
    </>
  )
}

settingsSections.push({ id: 'account', title: 'settings.account', Comp: Account })
