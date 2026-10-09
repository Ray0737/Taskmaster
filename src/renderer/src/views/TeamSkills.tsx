import { useEffect, useState } from 'react'
import { isSkillName, SKILL_BODY_MAX, SKILL_DESC_MAX, type Skill } from '@shared/skills'
import { call, on, errMsg } from '../ipc'
import { confirmDialog, toast } from '../stores/ui'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { Field } from '../components/Field'

function SkillDialog({ skill, onClose }: { skill: Skill | null; onClose: () => void }) {
  const t = useT()
  const editing = !!skill
  const imported = !!skill?.source // imported from GitHub: the folder has more than SKILL.md, so it is not edited here
  const [name, setName] = useState(skill?.name ?? '')
  const [desc, setDesc] = useState(skill?.description ?? '')
  const [body, setBody] = useState(skill?.body ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!isSkillName(name)) { setErr(t('team.skills.invalid')); return }
    setBusy(true); setErr('')
    try { await call('team.saveSkill', { name, description: desc, body }); onClose() } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!(await confirmDialog({ title: t('team.skills.deleteTitle'), text: t('team.skills.deleteText', { name }), danger: true, confirmLabel: t('team.skills.delete') }))) return
    try { await call('team.deleteSkill', name); onClose() } catch (e) { toast(errMsg(e), 'error') }
  }

  return (
    <div className="modal-back" onMouseDown={() => !busy && onClose()}>
      <div className="modal modal-lg" role="dialog" aria-modal="true" aria-label={t(editing ? 'team.skills.edit' : 'team.skills.new')}
        onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape' && !busy) onClose() }}>
        <div className="dialog-head">
          <Icon name="extensions" className="dialog-icon" />
          <div>
            <div className="modal-title">{t(editing ? 'team.skills.edit' : 'team.skills.new')}</div>
            <div className="dim small">{t('team.skills.sub')}</div>
            {imported && <div className="dim small ellipsis" title={skill!.source}>{t('team.skills.importedFrom', { url: skill!.source! })}</div>}
          </div>
        </div>
        <Field label={t('team.skills.name')} hint={t('team.skills.name.hint')}>
          <input autoFocus={!editing} className="input" value={name} disabled={editing} spellCheck={false} maxLength={40}
            onChange={(e) => setName(e.target.value.toLowerCase())} />
        </Field>
        <Field label={t('team.skills.desc')}>
          <input className="input" value={desc} readOnly={imported} maxLength={SKILL_DESC_MAX} placeholder={t('team.skills.desc.placeholder')} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <Field label={t('team.skills.body')}>
          <textarea autoFocus={editing} className="textarea" rows={10} readOnly={imported} maxLength={SKILL_BODY_MAX} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {err && <div className="danger" role="alert">{err}</div>}
        <div className="modal-actions">
          {editing && <button className="btn btn-delete" style={{ marginRight: 'auto' }} disabled={busy} onClick={() => void remove()}><Icon name="trash" />{t('team.skills.delete')}</button>}
          <button className="btn" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
          {!imported && <button className="btn btn-primary" disabled={busy || !name || !body.trim()} onClick={() => void save()}>{t('team.skills.save')}</button>}
        </div>
      </div>
    </div>
  )
}

interface Scanned { name: string; dir: string; description: string; files: number; scripts: number; tooBig: boolean; exists: boolean }

function ImportDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [url, setUrl] = useState('')
  const [found, setFound] = useState<Scanned[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [pick, setPick] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const scan = async () => {
    setBusy(true); setErr(''); setFound(null)
    try {
      const r = await call('team.scanSkills', url.trim())
      setFound(r.skills); setTruncated(r.truncated)
      setPick(r.skills.filter((x) => !x.exists && !x.tooBig).map((x) => x.dir)) // existing skills are not replaced unless ticked
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  const run = async () => {
    setBusy(true); setErr('')
    try {
      const names = await call('team.importSkills', url.trim(), pick)
      toast(t('team.skills.imported', { n: names.length }))
      onClose()
    } catch (e) { setErr(errMsg(e)); setBusy(false) }
  }
  const chosen = (found ?? []).filter((x) => pick.includes(x.dir))
  const scripts = chosen.reduce((n, x) => n + x.scripts, 0)

  return (
    <div className="modal-back" onMouseDown={() => !busy && onClose()}>
      <div className="modal modal-lg" role="dialog" aria-modal="true" aria-label={t('team.skills.import')}
        onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape' && !busy) onClose() }}>
        <div className="dialog-head">
          <Icon name="cloud-download" className="dialog-icon" />
          <div>
            <div className="modal-title">{t('team.skills.import')}</div>
            <div className="dim small">{t('team.skills.import.sub')}</div>
          </div>
        </div>
        <Field label={t('team.skills.import.url')} hint={t('team.skills.import.hint')}>
          <input autoFocus className="input" value={url} spellCheck={false} placeholder="https://github.com/owner/repo" onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && url.trim() && !busy) void scan() }} />
        </Field>
        <div><button className="btn btn-soft" disabled={busy || !url.trim()} onClick={() => void scan()}><Icon name="search" />{t('team.skills.import.find')}</button></div>
        {found && found.length === 0 && <div className="dim">{t('team.skills.import.none')}</div>}
        {found && found.map((x) => (
          <label key={x.dir || x.name} className="row row-tall" style={{ opacity: x.tooBig ? 0.5 : 1 }}>
            <input type="checkbox" className="check" disabled={x.tooBig || busy} checked={pick.includes(x.dir)}
              onChange={(e) => setPick(e.target.checked ? [...pick, x.dir] : pick.filter((d) => d !== x.dir))} />
            <span className="session-text">
              <span className="ellipsis">{x.name} <span className="dim small">{t('team.skills.import.files', { n: x.files })}</span></span>
              <span className="dim small ellipsis" title={x.description}>{x.tooBig ? t('team.skills.import.tooBig') : x.description || '/team:' + x.name}</span>
            </span>
            {x.exists && <span className="tag">{t('team.skills.import.replaces')}</span>}
            {x.scripts > 0 && <span className="tag danger">{t('team.skills.import.scriptsTag', { n: x.scripts })}</span>}
          </label>
        ))}
        {truncated && <div className="dim small">{t('team.skills.import.truncated')}</div>}
        {found && found.length > 0 && <div className={scripts ? 'danger small' : 'dim small'}>{t('team.skills.import.trust')}{scripts ? ' ' + t('team.skills.import.scripts', { n: scripts }) : ''}</div>}
        {err && <div className="danger" role="alert">{err}</div>}
        <div className="modal-actions">
          <button className="btn" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={busy || chosen.length === 0} onClick={() => void run()}>{t('team.skills.import.go', { n: chosen.length })}</button>
        </div>
      </div>
    </div>
  )
}

export function TeamSkills() {
  const t = useT()
  const [skills, setSkills] = useState<Skill[]>([])
  const [dlg, setDlg] = useState<{ skill: Skill | null } | null>(null)
  const [imp, setImp] = useState(false)
  const load = () => { void call('team.skills').then(setSkills).catch(() => setSkills([])) }
  useEffect(() => { load(); return on('team.changed', load) }, [])
  return (
    <>
      <div className="section-h section-plain">
        <span className="ellipsis">{t('team.skills')}</span><span className="badge">{skills.length}</span>
        <button className="icon-btn" style={{ marginLeft: 'auto' }} title={t('team.skills.import')} aria-label={t('team.skills.import')} onClick={() => setImp(true)}><Icon name="cloud-download" /></button>
        <button className="icon-btn" title={t('team.skills.add')} aria-label={t('team.skills.add')} onClick={() => setDlg({ skill: null })}><Icon name="add" /></button>
      </div>
      {skills.length === 0 && <div className="dim small" style={{ padding: '0 12px 8px' }}>{t('team.skills.empty')}</div>}
      {skills.map((s) => (
        <button key={s.name} className="row row-tall" title={s.description} onClick={() => setDlg({ skill: s })}>
          <Icon name="extensions" />
          <span className="session-text">
            <span className="ellipsis">{s.name}</span>
            <span className="dim small ellipsis">{s.description || '/team:' + s.name}</span>
          </span>
        </button>
      ))}
      {imp && <ImportDialog onClose={() => { setImp(false); load() }} />}
      {dlg && <SkillDialog skill={dlg.skill} onClose={() => { setDlg(null); load() }} />}
    </>
  )
}
