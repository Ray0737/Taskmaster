import { useEffect } from 'react'
import { useGit } from '../stores/git'
import { useSetup } from '../stores/setup'
import { registerCommand, runCommand } from '../commands'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { statusLeft, statusRight, activityBottom } from './registry'
import { openBranchMenu, syncNow, useSync } from './SourceControl'

function BranchItem() {
  const t = useT()
  const st = useGit((s) => s.status)
  if (!st) return null
  const name = st.branch ?? t('status.detached')
  return (
    <button className="sb-item" title={t('status.branch', { name })} onClick={(e) => void openBranchMenu(e.currentTarget)}>
      <Icon name="source-control" /><span className="ellipsis" style={{ maxWidth: 200 }}>{name}</span>
    </button>
  )
}

function SyncItem() {
  const t = useT()
  const st = useGit((s) => s.status)
  const busy = useSync((s) => s.busy)
  if (!st) return null
  return (
    <button className="sb-item" disabled={busy} title={t('status.sync', { ahead: st.ahead, behind: st.behind })} onClick={() => void syncNow()}>
      <Icon name="sync" />{busy ? '…' : `↑${st.ahead} ↓${st.behind}`}
    </button>
  )
}

function AccountItem() {
  const t = useT()
  const account = useGit((s) => s.account)
  const checked = useGit((s) => s.accountChecked)
  if (!checked) return null
  return account
    ? <button className="sb-item" title={t('status.account', { login: account.login })} onClick={() => runCommand('settings.open')}><Icon name="github" />@{account.login}</button>
    : <button className="sb-item" title={t('cmd.connectGithub')} onClick={() => runCommand('github.connect')}><Icon name="plug" />{t('status.offline')}</button>
}

function AccountButton() {
  const t = useT()
  const account = useGit((s) => s.account)
  useEffect(() => { if (!useGit.getState().accountChecked) void useGit.getState().loadAccount() }, [])
  const label = account ? `@${account.login}` : t('cmd.settings')
  return (
    <button className="ab-item" title={label} aria-label={label} onClick={() => runCommand('settings.open')}>
      {account ? <img className="avatar" src={account.avatarUrl} alt="" /> : <Icon name="account" />}
    </button>
  )
}

statusLeft.push(BranchItem, SyncItem)
statusRight.push(AccountItem)
activityBottom.push(AccountButton)

registerCommand({ id: 'github.connect', title: 'cmd.connectGithub', run: () => useSetup.getState().connect() })
