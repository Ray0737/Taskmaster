import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { isLogin, presenceStatus, type Member, type Role } from '@shared/team'
import { call, errMsg } from '../ipc'
import { useApp } from '../stores/app'
import { useGit } from '../stores/git'
import { useTeam, roleName } from '../stores/team'
import { toast } from '../stores/ui'
import { registerCommand, runCommand } from '../commands'
import { showPanel } from '../layout'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { Field } from '../components/Field'
import { Dropdown } from '../components/Dropdown'
import { sidebarViews } from './registry'
import { EnableBox } from './TeamBanner'
import { HelpIcon } from './HelpIcon'
import { useNow } from './useNow'
import { TeamSkills } from './TeamSkills'

export const useTeamUi = create<{ addOpen: boolean }>(() => ({ addOpen: false }))
const openAdd = (): void => useTeamUi.setState({ addOpen: true })

function AddMember() {
  const t = useT()
  const { data } = useTeam()
  const account = useGit((s) => s.account)
  const [login, setLogin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [collabs, setCollabs] = useState<{ login: string; avatarUrl: string }[] | null>(null)
  const close = () => useTeamUi.setState({ addOpen: false })
  useEffect(() => { if (account) call('auth.collaborators').then(setCollabs).catch(() => setCollabs([])) }, [account])
  if (!data) return null
  const pickable = (collabs ?? []).filter((c) => !data.team.members.some((m) => m.login === c.login))

  const add = async () => {
    const l = login.trim().replace(/^@/, '')
    if (!isLogin(l)) { setErr(t('team.add.invalid')); return }
    if (data.team.members.some((m) => m.login.toLowerCase() === l.toLowerCase())) { setErr(t('team.add.exists', { login: l })); return }
    setBusy(true); setErr('')
    try {
      if (account) { // invite on GitHub unless they already have access
        if (collabs?.some((c) => c.login.toLowerCase() === l.toLowerCase())) toast(t('team.add.already', { login: l }))
        else {
          try { toast(t((await call('auth.invite', l)) === 'invited' ? 'team.add.invited' : 'team.add.already', { login: l })) }
          catch (e) { toast(t('team.add.failed', { login: l, error: errMsg(e) }), 'error') }
        }
      }
      await useTeam.getState().saveTeam({ ...data.team, members: [...data.team.members, { login: l, role: 'custom', joinedAt: new Date().toISOString() }] })
      close()
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <div className="modal-back" onMouseDown={() => !busy && close()}>
      <div className="modal" style={{ width: 460 }} role="dialog" aria-modal="true" aria-label={t('team.add')}
        onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape' && !busy) close() }}>
        <div className="dialog-head">
          <Icon name="person-add" className="dialog-icon" />
          <div>
            <div className="modal-title">{t('team.add')}</div>
            <div className="dim small">{t('team.add.sub')}</div>
          </div>
        </div>
        <Field label={t('team.add.login')}>
          <input autoFocus className="input" value={login} placeholder={t('team.add.placeholder')} spellCheck={false}
            onChange={(e) => setLogin(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !busy) void add() }} />
        </Field>
        {account && <div className="field-hint dim"><Icon name="mail" /> {t('team.add.willInvite')}</div>}
        {account && collabs && (pickable.length > 0 ? (
          <>
            <div className="field-label">{t('team.add.pick')}</div>
            <div className="repo-list scroll">
              {pickable.map((c) => (
                <button key={c.login} className={`row row-tall${login === c.login ? ' sel' : ''}`} onClick={() => setLogin(c.login)}>
                  <img className="avatar" src={c.avatarUrl} alt="" /><span className="ellipsis">@{c.login}</span>
                </button>
              ))}
            </div>
          </>
        ) : <div className="field-hint dim">{t('team.add.noCollabs')}</div>)}
        {!account && <div className="field-hint dim">{t('team.add.manual')}</div>}
        {err && <div className="danger" role="alert">{err}</div>}
        <div className="modal-actions">
          <button className="btn" disabled={busy} onClick={close}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={busy || !login.trim()} onClick={() => void add()}>{t('team.add.go')}</button>
        </div>
      </div>
    </div>
  )
}

function MemberRow({ m }: { m: Member }) {
  const t = useT()
  const now = useNow()
  const { data, me } = useTeam()
  if (!data) return null
  const lead = data.team.lead === m.login
  const canEdit = me === data.team.lead
  const p = data.presence.find((x) => x.login === m.login)
  const st = p ? presenceStatus(p, now) : 'offline'
  const task = p?.taskId ? data.tasks.find((x) => x.id === p.taskId) : undefined
  const text = st === 'offline' ? t('team.presence.offline')
    : st === 'idle' ? t('team.presence.idle')
      : p?.running ? (task ? t('team.presence.running', { task: task.title }) : t('team.presence.runningNoTask'))
        : task ? t('team.presence.working', { task: task.title }) : t('team.presence.workingNoTask')
  const role = data.team.roles.find((r) => r.id === m.role)
  return (
    <div className="row" style={{ height: 'auto', minHeight: 44, padding: '4px 8px', cursor: 'default' }}>
      <span className="avatar-letter" style={{ opacity: st === 'offline' ? 0.5 : 1 }}>{m.login[0].toUpperCase()}</span>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span className="ellipsis">@{m.login}{lead ? ` · ${t('team.lead')}` : ''}{m.login === me ? ` · ${t('team.you')}` : ''}</span>
        <span className={`small ellipsis ${st === 'working' ? 'ok' : 'dim'}`} title={text}>{p?.running && st === 'working' && <Icon name="loading" className="codicon-modifier-spin" />} {text}</span>
        {st === 'working' && p?.branch && <span className="dim small mono ellipsis" title={p.branch}><Icon name="git-branch" /> {p.branch}</span>}
      </span>
      {canEdit
        ? (
          <Dropdown variant="pill" className="team-role-select" style={{ maxWidth: 130 }} ariaLabel={`${m.login} — ${t('task.role')}`} value={m.role}
            options={data.team.roles.map((r) => ({ value: r.id, label: roleName(t, r) }))}
            onChange={(v) => void useTeam.getState().saveTeam({ ...data.team, members: data.team.members.map((x) => (x.login === m.login ? { ...x, role: v } : x)) })} />
        )
        : <span className="tag ellipsis" style={{ maxWidth: 110 }}>{roleName(t, role)}</span>}
    </div>
  )
}

function RoleEditor({ role }: { role: Role }) {
  const t = useT()
  const { data, me } = useTeam()
  const [text, setText] = useState(role.prompt)
  useEffect(() => setText(role.prompt), [role.prompt])
  if (!data) return null
  const canEdit = me === data.team.lead
  const commit = () => {
    if (!canEdit || text === role.prompt) return
    void useTeam.getState().saveTeam({ ...data.team, roles: data.team.roles.map((r) => (r.id === role.id ? { ...r, prompt: text.slice(0, 2000) } : r)) })
  }
  return (
    <div style={{ padding: '4px 8px' }}>
      <div className="small dim">{roleName(t, role)}</div>
      <textarea className="textarea" rows={2} readOnly={!canEdit} value={text} placeholder={t('team.role.prompt')}
        aria-label={`${roleName(t, role)} — ${t('team.role.prompt')}`} onChange={(e) => setText(e.target.value)} onBlur={commit} />
    </div>
  )
}

function NewRole() {
  const t = useT()
  const { data, me } = useTeam()
  const [name, setName] = useState('')
  if (!data || me !== data.team.lead) return null
  const add = () => {
    const label = name.trim().slice(0, 60)
    if (!label) return
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'role'
    let id = base
    for (let n = 2; data.team.roles.some((r) => r.id === id); n++) id = `${base}-${n}`
    void useTeam.getState().saveTeam({ ...data.team, roles: [...data.team.roles, { id, label, prompt: '' }] })
    setName('')
  }
  return (
    <div style={{ display: 'flex', gap: 6, padding: 8 }}>
      <input className="input" placeholder={t('team.role.name')} aria-label={t('team.role.name')} value={name}
        onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} />
      <button className="btn btn-primary" disabled={!name.trim()} onClick={add}>{t('team.role.new')}</button>
    </div>
  )
}

export function Team() {
  const t = useT()
  const { status, data } = useTeam()
  const addOpen = useTeamUi((s) => s.addOpen)
  if (status !== 'enabled' || !data) return <EnableBox />
  const fresh = data.team.members.length <= 1 && data.tasks.length === 0
  return (
    <div style={{ paddingBottom: 16 }}>
      {fresh && (
        <div className="notice" style={{ flexDirection: 'column', margin: 8 }}>
          <div className="setup-title">{t('team.onboarding.title')}</div>
          <button className="btn" onClick={openAdd}>{t('team.onboarding.1')}</button>
          <button className="btn" onClick={() => document.querySelector<HTMLElement>('.team-role-select')?.focus()}>{t('team.onboarding.2')}</button>
          <button className="btn" onClick={() => runCommand('task.new')}>{t('team.onboarding.3')}</button>
        </div>
      )}
      <div className="section-h section-plain">
        <span className="ellipsis">{t('team.members')}</span><span className="badge">{data.team.members.length}</span>
      </div>
      {data.team.members.map((m) => <MemberRow key={m.login} m={m} />)}
      <div className="section-h section-plain"><span className="ellipsis">{t('team.roles')}</span></div>
      {data.team.roles.map((r) => <RoleEditor key={r.id} role={r} />)}
      <NewRole />
      <TeamSkills />
      {addOpen && <AddMember />}
    </div>
  )
}

function TeamActions() {
  const t = useT()
  const enabled = useTeam((s) => s.status === 'enabled')
  return (
    <>
      <HelpIcon chapter="04-team-and-roles.md" />
      {enabled && <button className="icon-btn" title={t('team.add')} aria-label={t('team.add')} onClick={openAdd}><Icon name="person-add" /></button>}
    </>
  )
}

sidebarViews.push({ id: 'team', title: 'view.team', icon: 'organization', Comp: Team, Actions: TeamActions })

registerCommand(
  { id: 'view.team', title: 'cmd.team', run: () => { useApp.getState().setView('team'); showPanel('side') } },
  { id: 'team.sync', title: 'cmd.syncTeam', run: () => call('team.syncNow') }
)
