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
          </div>
        </div>
        <Field label={t('team.skills.name')} hint={t('team.skills.name.hint')}>
          <input autoFocus={!editing} className="input" value={name} disabled={editing} spellCheck={false} maxLength={40}
            onChange={(e) => setName(e.target.value.toLowerCase())} />
        </Field>
        <Field label={t('team.skills.desc')}>
          <input className="input" value={desc} maxLength={SKILL_DESC_MAX} placeholder={t('team.skills.desc.placeholder')} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <Field label={t('team.skills.body')}>
          <textarea autoFocus={editing} className="textarea" rows={10} maxLength={SKILL_BODY_MAX} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {err && <div className="danger" role="alert">{err}</div>}
        <div className="modal-actions">
          {editing && <button className="btn btn-delete" style={{ marginRight: 'auto' }} disabled={busy} onClick={() => void remove()}><Icon name="trash" />{t('team.skills.delete')}</button>}
          <button className="btn" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={busy || !name || !body.trim()} onClick={() => void save()}>{t('team.skills.save')}</button>
        </div>
      </div>
    </div>
  )
}

export function TeamSkills() {
  const t = useT()
  const [skills, setSkills] = useState<Skill[]>([])
  const [dlg, setDlg] = useState<{ skill: Skill | null } | null>(null)
  const load = () => { void call('team.skills').then(setSkills).catch(() => setSkills([])) }
  useEffect(() => { load(); return on('team.changed', load) }, [])
  return (
    <>
      <div className="section-h section-plain">
        <span className="ellipsis">{t('team.skills')}</span><span className="badge">{skills.length}</span>
        <button className="icon-btn" style={{ marginLeft: 'auto' }} title={t('team.skills.add')} aria-label={t('team.skills.add')} onClick={() => setDlg({ skill: null })}><Icon name="add" /></button>
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
      {dlg && <SkillDialog skill={dlg.skill} onClose={() => { setDlg(null); load() }} />}
    </>
  )
}
