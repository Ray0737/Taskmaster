import { useEffect, useState, type ReactNode } from 'react'
import { call } from '../ipc'
import { useApp } from '../stores/app'
import { useGit } from '../stores/git'
import { useSetup } from '../stores/setup'
import { registerCommand } from '../commands'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { Dropdown } from '../components/Dropdown'
import { setupRows } from './registry'

export function SetupRow({ ok, title, children }: { ok: boolean | null; title: string; children: ReactNode }) {
  const icon = ok === null ? 'circle-large-outline' : ok ? 'check' : 'error'
  return (
    <section className="setup-row">
      <Icon name={icon} className={ok ? 'ok' : ok === false ? 'danger' : 'dim'} />
      <div className="setup-body">
        <div className="setup-title">{title}</div>
        {children}
      </div>
    </section>
  )
}

function GitRow() {
  const t = useT()
  const { git, checking } = useSetup()
  return (
    <SetupRow ok={git === undefined ? null : !!git} title={t('welcome.git')}>
      {git === undefined || checking ? <span className="dim">{t('welcome.checking')}</span>
        : git ? <span>{t('welcome.git.ok', { version: git })}</span>
          : (
            <>
              <span className="danger">{t('welcome.git.missing')}</span>
              <div className="setup-actions">
                <button className="btn btn-primary" onClick={() => void call('shell.openExternal', 'https://git-scm.com/download/win')}>{t('welcome.git.download')}</button>
                <button className="btn" onClick={() => void useSetup.getState().check()}>{t('welcome.recheck')}</button>
              </div>
            </>
          )}
    </SetupRow>
  )
}

function IdentityRow() {
  const t = useT()
  const { git, identity, saveIdentity } = useSetup()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  useEffect(() => { setName(identity?.name ?? ''); setEmail(identity?.email ?? '') }, [identity])
  const ok = !!identity?.name && !!identity?.email
  if (!git) return <SetupRow ok={null} title={t('welcome.identity')}><span className="dim">—</span></SetupRow>
  return (
    <SetupRow ok={identity === null ? null : ok} title={t('welcome.identity')}>
      {ok ? <span>{t('welcome.identity.ok', { name: identity!.name, email: identity!.email })}</span> : (
        <>
          <div className="setup-form">
            <input className="input" placeholder={t('welcome.identity.name')} aria-label={t('welcome.identity.name')} value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" placeholder={t('welcome.identity.email')} aria-label={t('welcome.identity.email')} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="setup-actions">
            <button className="btn btn-primary" disabled={!name.trim() || !email.includes('@')} onClick={() => void saveIdentity({ name, email })}>{t('welcome.identity.save')}</button>
          </div>
        </>
      )}
    </SetupRow>
  )
}

function GithubRow() {
  const t = useT()
  const git = useSetup((s) => s.git)
  const connecting = useSetup((s) => s.connecting)
  const account = useGit((s) => s.account)
  if (!git) return <SetupRow ok={null} title={t('welcome.github')}><span className="dim">—</span></SetupRow>
  return (
    <SetupRow ok={account ? true : null} title={t('welcome.github')}>
      {account ? <span>{t('welcome.github.ok', { login: account.login })}</span> : (
        <>
          <span>{connecting ? t('welcome.github.connecting') : t('welcome.github.none')}</span>
          <span className="dim small">{t('welcome.github.hint')}</span>
          <div className="setup-actions">
            <button className="btn btn-primary" disabled={connecting} onClick={() => void useSetup.getState().connect()}>{t('welcome.github.connect')}</button>
          </div>
        </>
      )}
    </SetupRow>
  )
}

export function Welcome() {
  const t = useT()
  const lang = useApp((s) => s.settings!.lang)
  const set = useApp((s) => s.set)
  const { checking, git, identity } = useSetup() // whole store: re-renders when checks change so Continue enables
  const pass = !!git && !!identity?.name && !!identity?.email
  useEffect(() => { void useSetup.getState().check() }, [])
  return (
    <div className="welcome">
      <div className="welcome-col">
        <div className="welcome-top">
          <Dropdown variant="pill" icon="globe" ariaLabel={t('settings.language')} value={lang}
            options={[{ value: 'en', label: 'English' }, { value: 'th', label: 'ไทย' }]} onChange={(v) => void set({ lang: v as 'en' | 'th' })} />
        </div>
        <h1 className="welcome-title">{t('welcome.title')}</h1>
        <div className="dim">{t('welcome.subtitle')}</div>
        <GitRow />
        <IdentityRow />
        <GithubRow />
        {setupRows.map((R, i) => <R key={i} />)}
        <div className="welcome-actions">
          <button className="btn" disabled={checking} onClick={() => void useSetup.getState().check()}><Icon name="refresh" />{t('welcome.recheck')}</button>
          <button className="btn btn-primary" disabled={checking || !pass}
            onClick={async () => { await set({ setupDone: true }); useSetup.setState({ open: false }) }}>{t('welcome.continue')}<Icon name="arrow-right" /></button>
        </div>
      </div>
    </div>
  )
}

registerCommand({ id: 'setup.check', title: 'cmd.setupCheck', run: () => useSetup.setState({ open: true }) })
