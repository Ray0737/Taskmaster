import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { STATUSES, type Task } from '@shared/team'
import type { Tab } from '../stores/editor'
import { useTeam, roleName } from '../stores/team'
import { mergeDebounce } from '../util'
import { startTask, setTaskStatus } from '../tasks'
import { useT } from '../i18n'
import { Field } from '../components/Field'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Empty'
import { openPullRequest } from '../pr'
import { tabRenderers } from './EditorArea'

export function TaskTab({ tab }: { tab: Tab }) {
  const t = useT()
  const { data, me } = useTeam()
  const task = data?.tasks.find((x) => x.id === tab.taskId)
  const [draft, setDraft] = useState<Task | null>(task ?? null)
  const [preview, setPreview] = useState(false)
  const [glob, setGlob] = useState('')
  const [note, setNote] = useState('')
  const pending = useRef(false)
  // Edits are merged and saved 600 ms after the last keystroke; a teammate's change is shown once ours is saved.
  const save = useRef(mergeDebounce<Partial<Task>>((p) => {
    pending.current = false
    const cur = useTeam.getState().data?.tasks.find((x) => x.id === tab.taskId)
    if (cur) void useTeam.getState().saveTask({ ...cur, ...p })
  }, 600)).current
  useEffect(() => { if (task && !pending.current) setDraft(task) }, [task?.id, task?.updatedAt])

  if (!task || !draft || !data) return <Empty text={t('task.missing')} />
  const patch = (p: Partial<Task>) => { pending.current = true; setDraft({ ...draft, ...p }); save(p) }
  const notes = data.notes.filter((n) => n.taskId === task.id)
  const mineOrFree = !task.assignee || task.assignee === me
  const addGlob = () => {
    const g = glob.trim()
    if (g && !draft.files.includes(g)) patch({ files: [...draft.files, g] })
    setGlob('')
  }

  return (
    <div className="split-body scroll" style={{ height: '100%', background: 'var(--bg-0)' }}>
      <div className="doc selectable">
        <input className="input" style={{ fontSize: 18, height: 36 }} aria-label={t('task.title')} value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
        <div className="setup-actions" style={{ margin: '12px 0 16px' }}>
          {mineOrFree && task.status !== 'doing' && task.status !== 'done' && (
            <button className="btn btn-primary" onClick={() => void startTask(task.id)}><Icon name="play" />{t('task.start')}</button>
          )}
          {task.status === 'doing' && <button className="btn" onClick={() => void setTaskStatus(task.id, 'review')}>{t('task.markReview')}</button>}
          {task.status !== 'done' && <button className="btn" onClick={() => void setTaskStatus(task.id, 'done')}>{t('task.markDone')}</button>}
          {task.status === 'done' && <button className="btn" onClick={() => void setTaskStatus(task.id, 'todo')}>{t('task.reopen')}</button>}
          {task.branch && <button className="btn" onClick={() => void openPullRequest(task.branch!)}><Icon name="git-pull-request" />{t('scm.openPr')}</button>}
          {!mineOrFree && <span className="dim">{t('task.assignedTo', { login: task.assignee! })}</span>}
        </div>

        <div className="setup-form" style={{ maxWidth: 560 }}>
          <Field label={t('task.role')}>
            <select className="select" value={draft.role} onChange={(e) => patch({ role: e.target.value })}>
              {data.team.roles.map((r) => <option key={r.id} value={r.id}>{roleName(t, r)}</option>)}
            </select>
          </Field>
          <Field label={t('task.assignee')}>
            <select className="select" value={draft.assignee ?? ''} onChange={(e) => patch({ assignee: e.target.value || null })}>
              <option value="">{t('tasks.unassigned')}</option>
              {data.team.members.map((m) => <option key={m.login} value={m.login}>@{m.login}</option>)}
            </select>
          </Field>
          <Field label={t('task.status')}>
            <select className="select" value={draft.status} onChange={(e) => patch({ status: e.target.value as Task['status'] })}>
              {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
            </select>
          </Field>
          <Field label={t('task.branch')}><div className="mono ellipsis" title={task.branch ?? ''}>{task.branch ?? t('task.noBranch')}</div></Field>
        </div>

        <div className="field-label" style={{ margin: '8px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{t('task.brief')}</span>
          <span className="tabs-inline">
            <button className={`btn${!preview ? ' on' : ''}`} onClick={() => setPreview(false)}>{t('task.edit')}</button>
            <button className={`btn${preview ? ' on' : ''}`} onClick={() => setPreview(true)}>{t('task.preview')}</button>
          </span>
        </div>
        {preview
          ? <div className="msg-md" style={{ minHeight: 120 }}><ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.brief}</ReactMarkdown></div>
          : <textarea className="textarea" rows={8} aria-label={t('task.brief')} value={draft.brief} onChange={(e) => patch({ brief: e.target.value })} />}

        <div className="field-label" style={{ margin: '16px 0 4px' }}>{t('task.scope')}</div>
        <div className="field-hint" style={{ marginBottom: 6 }}>{t('task.scopeHint')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {draft.files.map((g) => (
            <span key={g} className="tag mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 22 }}>
              {g}
              <button className="icon-btn" style={{ width: 16, height: 16 }} title={t('task.scopeRemove', { glob: g })} aria-label={t('task.scopeRemove', { glob: g })}
                onClick={() => patch({ files: draft.files.filter((x) => x !== g) })}><Icon name="close" /></button>
            </span>
          ))}
        </div>
        <input className="input" style={{ maxWidth: 420 }} placeholder={t('task.scopeAdd')} aria-label={t('task.scope')} value={glob}
          onChange={(e) => setGlob(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGlob() } }} />

        <div className="field-label" style={{ margin: '24px 0 8px' }}>{t('task.notes')}</div>
        {notes.length === 0 && <div className="dim">{t('task.noNotes')}</div>}
        {notes.map((n) => (
          <div key={n.file} style={{ background: 'var(--bg-1)', padding: '8px 10px', marginBottom: 8 }}>
            <div className="dim small">@{n.login} · {new Date(n.at).toLocaleString()}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{n.text}</div>
          </div>
        ))}
        <textarea className="textarea" rows={3} placeholder={t('task.addNote')} aria-label={t('task.addNote')} value={note} onChange={(e) => setNote(e.target.value)} />
        <div style={{ marginTop: 6 }}>
          <button className="btn" disabled={!note.trim()} onClick={() => { void useTeam.getState().addNote(task.id, note); setNote('') }}>{t('task.saveNote')}</button>
        </div>
      </div>
    </div>
  )
}

tabRenderers.task = TaskTab
