import { useEffect, useState } from 'react'
import { useAgent } from '../stores/agent'
import { useTeam } from '../stores/team'
import { useT } from '../i18n'
import { Dropdown } from '../components/Dropdown'
import { agentHeaderExtras, agentFooterExtras } from './registry'

// Header: which task the agent works on ("No task" = plain chat with team context only).
export function TaskSelect() {
  const t = useT()
  const { status, data, me, activeTaskId } = useTeam()
  const running = useAgent((s) => s.runId !== null)
  if (status !== 'enabled' || !data) return null
  const list = data.tasks.filter((x) => (x.assignee === me && x.status !== 'done') || x.id === activeTaskId)
  return (
    <Dropdown variant="pill" icon="checklist" compact iconOnly={!activeTaskId} style={{ maxWidth: 130 }} ariaLabel={t('task.select')} disabled={running} value={activeTaskId ?? ''}
      options={[{ value: '', label: t('task.none') }, ...list.map((x) => ({ value: x.id, label: x.title }))]}
      onChange={(v) => useTeam.getState().setActiveTask(v || null)} />
  )
}

// Footer: shown when the agent finished a task turn without a <tm-note>.
export function NoteBox() {
  const t = useT()
  const pending = useTeam((s) => s.pendingNote)
  const [text, setText] = useState('')
  useEffect(() => setText(pending?.text ?? ''), [pending])
  if (!pending) return null
  return (
    <div className="notice" style={{ flexDirection: 'column' }}>
      <div>{t('note.pending')}</div>
      <textarea className="textarea" rows={4} aria-label={t('note.save')} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="setup-actions">
        <button className="btn btn-primary" disabled={!text.trim()} onClick={() => void useTeam.getState().saveNote(pending.taskId, text)}>{t('note.save')}</button>
        <button className="btn" onClick={() => useTeam.getState().dismissNote()}>{t('note.dismiss')}</button>
      </div>
    </div>
  )
}

agentHeaderExtras.push(TaskSelect)
agentFooterExtras.push(NoteBox)
