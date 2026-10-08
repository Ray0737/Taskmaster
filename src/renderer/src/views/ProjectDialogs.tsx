import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { RepoInfo } from '@shared/types'
import { dirname } from '@shared/paths'
import { call, on, errMsg } from '../ipc'
import { useGit } from '../stores/git'
import { toast } from '../stores/ui'
import { useT, tr } from '../i18n'
import { Field } from '../components/Field'
import { Icon } from '../components/Icon'
import { useProjectDialog, openProject } from '../projects'

const close = () => useProjectDialog.setState({ kind: null })

// Folder picker: read-only box + Browse. Starts at the folder that holds the most recent project.
function Location({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const t = useT()
  useEffect(() => {
    if (value) return
    void call('recent.list').then((l) => { if (l[0]) onChange(dirname(l[0].path)) }).catch(() => {})
  }, [])
  return (
    <Field label={label}>
      <div className="field-inline">
        <input className="input" readOnly value={value} title={value} />
        <button className="btn" onClick={async () => { const p = await call('dialog.openFolder'); if (p) onChange(p) }}>{t('new.browse')}</button>
      </div>
    </Field>
  )
}

function Shell({ title, busy, children, actions }: { title: string; busy: boolean; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="modal-back" onMouseDown={() => !busy && close()}>
      <div className="modal" style={{ width: 520 }} role="dialog" aria-modal="true" aria-label={title}
        onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape' && !busy) close() }}>
        <div className="modal-title">{title}</div>
        <div className="form-grid">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  )
}

function NewProject() {
  const t = useT()
  const account = useGit((s) => s.account)
  const [name, setName] = useState('')
  const [parent, setParent] = useState('')
  const [github, setGithub] = useState(false)
  const [priv, setPriv] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const create = async () => {
    setBusy(true); setErr('')
    try {
      const r = await call('project.create', parent, name.trim(), github ? (priv ? 'private' : 'public') : false)
      if (r.warning) toast(tr('new.warning', { error: r.warning }), 'error')
      close()
      await openProject(r.path)
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <Shell title={t('new.title')} busy={busy} actions={
      <>
        <button className="btn" disabled={busy} onClick={close}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={busy || !name.trim() || !parent} onClick={() => void create()}>{busy ? t('new.creating') : t('new.create')}</button>
      </>}>
      <Field label={t('new.name')}>
        <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && parent && !busy) void create() }} />
      </Field>
      <Location value={parent} onChange={setParent} label={t('new.parent')} />
      <label className="field-inline" style={{ opacity: account ? 1 : 0.6 }}>
        <input type="checkbox" className="check" disabled={!account} checked={github} onChange={(e) => setGithub(e.target.checked)} />
        {t('new.github')}
      </label>
      {!account && <div className="field-hint dim">{t('new.github.needsAccount')}</div>}
      {github && (
        <label className="field-inline">
          <input type="checkbox" className="check" checked={priv} onChange={(e) => setPriv(e.target.checked)} />
          {t('new.github.private')}
        </label>
      )}
      {err && <div className="danger" role="alert" style={{ overflowWrap: 'anywhere' }}>{err}</div>}
    </Shell>
  )
}

const deriveName = (url: string): string => url.trim().replace(/[\\/]+$/, '').replace(/\.git$/, '').split(/[\\/:]/).pop() ?? ''

function Clone() {
  const t = useT()
  const account = useGit((s) => s.account)
  const [tab, setTab] = useState<'github' | 'url'>(account ? 'github' : 'url')
  const [repos, setRepos] = useState<RepoInfo[] | null>(null)
  const [q, setQ] = useState('')
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [parent, setParent] = useState('')
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (tab !== 'github' || !account || repos) return
    call('auth.repos').then(setRepos).catch((e) => { setRepos([]); setErr(errMsg(e)) })
  }, [tab, account])
  useEffect(() => on('git.progress', (p) => setPct(p.percent)), [])

  const shown = useMemo(() => (repos ?? []).filter((r) => r.fullName.toLowerCase().includes(q.toLowerCase())), [repos, q])
  const go = async () => {
    setBusy(true); setErr(''); setPct(0)
    try {
      const path = await call('git.clone', url.trim(), parent, name.trim())
      close()
      await openProject(path)
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <Shell title={t('clone.title')} busy={busy} actions={
      <>
        <button className="btn" onClick={() => { if (busy) void call('git.cloneCancel'); else close() }}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={busy || !url.trim() || !name.trim() || !parent} onClick={() => void go()}>{t('clone.go')}</button>
      </>}>
      <div className="tabs-inline">
        <button className={`btn${tab === 'github' ? ' on' : ''}`} onClick={() => setTab('github')}>{t('clone.tab.github')}</button>
        <button className={`btn${tab === 'url' ? ' on' : ''}`} onClick={() => setTab('url')}>{t('clone.tab.url')}</button>
      </div>
      {tab === 'github' ? (
        !account ? <div className="dim">{t('clone.needsAccount')}</div> : (
          <>
            <input autoFocus className="input" placeholder={t('clone.search')} aria-label={t('clone.search')} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="repo-list scroll" role="listbox" aria-label={t('clone.title')}>
              {repos === null ? <div className="empty-row dim">{t('clone.loading')}</div>
                : shown.length === 0 ? <div className="empty-row dim">{t('clone.none')}</div>
                  : shown.map((r) => (
                    <button key={r.fullName} role="option" aria-selected={url === r.cloneUrl} className={`row${url === r.cloneUrl ? ' sel' : ''}`} title={r.fullName}
                      style={{ height: 'auto', minHeight: 28 }}
                      onClick={() => { setUrl(r.cloneUrl); setName(r.name) }}>
                      <Icon name={r.private ? 'lock' : 'repo'} />
                      <span className="ellipsis flex1">{r.fullName}</span>
                      {r.private && <span className="tag">{t('clone.private')}</span>}
                      <span className="dim small">{new Date(r.updatedAt).toLocaleDateString()}</span>
                    </button>
                  ))}
            </div>
          </>
        )
      ) : (
        <Field label={t('clone.url')}>
          <input autoFocus className="input" placeholder="https://github.com/owner/repo.git" value={url}
            onChange={(e) => { setUrl(e.target.value); setName(deriveName(e.target.value)) }} />
        </Field>
      )}
      <Field label={t('clone.name')}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Location value={parent} onChange={setParent} label={t('clone.parent')} />
      {busy && (
        <>
          <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%` }} /></div>
          <div className="dim small">{t('clone.progress', { percent: pct })}</div>
        </>
      )}
      {err && <div className="danger" role="alert" style={{ overflowWrap: 'anywhere' }}>{err}</div>}
    </Shell>
  )
}

export function ProjectDialogs() {
  const kind = useProjectDialog((s) => s.kind)
  if (kind === 'new') return <NewProject />
  if (kind === 'clone') return <Clone />
  return null
}
