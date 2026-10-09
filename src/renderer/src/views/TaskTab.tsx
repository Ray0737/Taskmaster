import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { STATUSES, type Task } from '@shared/team'
import { call, on, errMsg } from '../ipc'
import { useEditor, type Tab } from '../stores/editor'
import { useTeam, roleName } from '../stores/team'
import { confirmDialog, toast } from '../stores/ui'
import { mergeDebounce } from '../util'
import { startTask, setTaskStatus } from '../tasks'
import { useT } from '../i18n'
import { Field } from '../components/Field'
import { Dropdown } from '../components/Dropdown'
import { Group } from '../components/Group'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Empty'
import { openPullRequest } from '../pr'
import { clipboardImages, saveShots } from '../shots'
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
  const [shots, setShots] = useState<{ file: string; src: string }[]>([])
  const [zoom, setZoom] = useState<string | null>(null)
  const loadShots = () => {
    if (!tab.taskId) return
    void call('team.images', tab.taskId)
      .then((names) => Promise.all(names.map(async (file) => ({ file, src: await call('team.imageData', tab.taskId!, file) }))))
      .then(setShots).catch(() => setShots([]))
  }
  useEffect(() => { loadShots(); return on('team.changed', loadShots) }, [tab.taskId])
  // Edits are merged and saved 600 ms after the last keystroke; a teammate's change is shown once ours is saved.
  const save = useRef(mergeDebounce<Partial<Task>>((p) => {
    pending.current = false
    const cur = useTeam.getState().data?.tasks.find((x) => x.id === tab.taskId)
    if (cur) void useTeam.getState().saveTask({ ...cur, ...p })
  }, 600)).current
  useEffect(() => { if (task && !pending.current) setDraft(task) }, [task?.id, task?.updatedAt])
  // keep the tab label in step with the saved title (a new task starts as "New task")
  useEffect(() => {
    if (task) useEditor.setState((s) => ({ tabs: s.tabs.map((x) => (x.id === tab.id && x.title !== task.title ? { ...x, title: task.title } : x)) }))
  }, [task?.title])

  if (!task || !draft || !data) return <Empty text={t('task.missing')} />
  const patch = (p: Partial<Task>) => { pending.current = true; setDraft({ ...draft, ...p }); save(p) }
  const notes = data.notes.filter((n) => n.taskId === task.id)
  const mineOrFree = !task.assignee || task.assignee === me
  const addGlob = () => {
    const g = glob.trim()
    if (g && !draft.files.includes(g)) patch({ files: [...draft.files, g] })
    setGlob('')
  }
  // Ctrl+V anywhere on the page: image items become screenshots, plain text pastes as usual.
  const onPaste = async (e: React.ClipboardEvent) => {
    const files = clipboardImages(e.clipboardData)
    if (!files.length) return
    e.preventDefault()
    try { await saveShots(task.id, files) } catch (err) { toast(`${t('task.shotFailed')}: ${errMsg(err)}`, 'error') }
    loadShots()
  }
  const copyShotPath = (file: string) => { void call('team.imagePath', task.id, file).then((p) => navigator.clipboard.writeText(p)).then(() => toast(t('task.shotCopied'))).catch((err) => toast(errMsg(err), 'error')) }
  const removeShot = (file: string) => { void call('team.removeImage', task.id, file).then(loadShots).catch((err) => toast(errMsg(err), 'error')) }
  const remove = async () => {
    const ok = await confirmDialog({ title: t('task.delete.title'), text: t('task.delete.text', { title: task.title }), danger: true, confirmLabel: t('task.delete') })
    if (!ok) return
    try {
      await useTeam.getState().deleteTask(task.id)
      toast(t('task.deleted'))
      void useEditor.getState().close(tab.id)
    } catch (e) { toast(errMsg(e), 'error') }
  }

  return (
    <div className="split-body scroll" style={{ height: '100%', background: 'var(--bg-0)' }}>
      <div className="settings-page task-page selectable" tabIndex={-1} onPaste={(e) => void onPaste(e)}>
        <header className="task-head">
          <input className="input task-title" autoFocus={task.title === t('tasks.untitled')} onFocus={(e) => { if (task.title === t('tasks.untitled')) e.currentTarget.select() }} aria-label={t('task.title')} value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
          <div className="task-meta">
            <span className={`status-pill s-${task.status}`}>{t(`status.${task.status}`)}</span>
            {task.branch && <span className="dim small mono ellipsis" title={task.branch}><Icon name="git-branch" /> {task.branch}</span>}
            {!mineOrFree && <span className="dim small">{t('task.assignedTo', { login: task.assignee! })}</span>}
          </div>
          <div className="task-actions">
            {mineOrFree && task.status !== 'doing' && task.status !== 'done' && (
              <button className="btn btn-primary" onClick={() => void startTask(task.id)}><Icon name="play" />{t('task.start')}</button>
            )}
            {task.status === 'doing' && <button className="btn btn-primary" onClick={() => void setTaskStatus(task.id, 'review')}><Icon name="eye" />{t('task.markReview')}</button>}
            {task.status !== 'done' && <button className="btn btn-soft" onClick={() => void setTaskStatus(task.id, 'done')}><Icon name="pass" />{t('task.markDone')}</button>}
            {task.status === 'done' && <button className="btn btn-soft" onClick={() => void setTaskStatus(task.id, 'todo')}><Icon name="debug-restart" />{t('task.reopen')}</button>}
            {task.branch && <button className="btn btn-soft" onClick={() => void openPullRequest(task.branch!)}><Icon name="git-pull-request" />{t('scm.openPr')}</button>}
            <span className="task-actions-gap" />
            <button className="btn btn-delete" onClick={() => void remove()}><Icon name="trash" />{t('task.delete')}</button>
          </div>
        </header>

        <Group icon="account" title={t('task.group.details')} desc={t('task.group.details.desc')}>
          <div className="task-grid">
            <Field label={t('task.role')}>
              <Dropdown ariaLabel={t('task.role')} value={draft.role} options={data.team.roles.map((r) => ({ value: r.id, label: roleName(t, r) }))}
                onChange={(v) => patch({ role: v })} />
            </Field>
            <Field label={t('task.assignee')}>
              <Dropdown ariaLabel={t('task.assignee')} value={draft.assignee ?? ''}
                options={[{ value: '', label: t('tasks.unassigned') }, ...data.team.members.map((m) => ({ value: m.login, label: `@${m.login}` }))]}
                onChange={(v) => patch({ assignee: v || null })} />
            </Field>
            <Field label={t('task.status')}>
              <Dropdown ariaLabel={t('task.status')} value={draft.status} options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
                onChange={(v) => patch({ status: v as Task['status'] })} />
            </Field>
          </div>
        </Group>

        <Group icon="note" title={t('task.brief')} desc={t('task.group.brief.desc')}>
          <div className="tabs-inline" role="tablist">
            <button className={`btn${!preview ? ' on' : ''}`} onClick={() => setPreview(false)}>{t('task.edit')}</button>
            <button className={`btn${preview ? ' on' : ''}`} onClick={() => setPreview(true)}>{t('task.preview')}</button>
          </div>
          {preview
            ? <div className="msg-md" style={{ minHeight: 96 }}><ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.brief}</ReactMarkdown></div>
            : <textarea className="textarea" rows={6} aria-label={t('task.brief')} value={draft.brief} onChange={(e) => patch({ brief: e.target.value })} />}
        </Group>

        <Group icon="file-media" title={t('task.shots')} desc={t('task.group.shots.desc')}>
          {shots.length === 0 && <div className="dim">{t('task.shotsEmpty')}</div>}
          {shots.length > 0 && (
            <div className="task-shots">
              {shots.map((x) => (
                <div key={x.file} className="task-shot">
                  <img src={x.src} alt="" onClick={() => setZoom(x.src)} />
                  <button className="icon-btn shot-copy" title={t('task.shotCopy')} aria-label={t('task.shotCopy')} onClick={() => copyShotPath(x.file)}><Icon name="copy" /></button>
                  <button className="icon-btn" title={t('task.shotRemove')} aria-label={t('task.shotRemove')} onClick={() => removeShot(x.file)}><Icon name="close" /></button>
                </div>
              ))}
            </div>
          )}
        </Group>

        <Group icon="filter" title={t('task.scope')} desc={t('task.scopeHint')}>
          {draft.files.length > 0 && (
            <div className="task-globs">
              {draft.files.map((g) => (
                <span key={g} className="tag mono">
                  {g}
                  <button className="icon-btn" title={t('task.scopeRemove', { glob: g })} aria-label={t('task.scopeRemove', { glob: g })}
                    onClick={() => patch({ files: draft.files.filter((x) => x !== g) })}><Icon name="close" /></button>
                </span>
              ))}
            </div>
          )}
          <input className="input" placeholder={t('task.scopeAdd')} aria-label={t('task.scope')} value={glob}
            onChange={(e) => setGlob(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGlob() } }} />
        </Group>

        <Group icon="comment-discussion" title={t('task.notes')} desc={t('task.group.notes.desc')}>
          {notes.length === 0 && <div className="dim">{t('task.noNotes')}</div>}
          {notes.map((n) => (
            <div key={n.file} className="task-note">
              <span className="avatar-letter" style={{ width: 24, height: 24, fontSize: 11 }}>{n.login[0].toUpperCase()}</span>
              <div className="task-note-body">
                <div className="dim small">@{n.login} · {new Date(n.at).toLocaleString()}</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{n.text}</div>
              </div>
            </div>
          ))}
          <textarea className="textarea" rows={3} placeholder={t('task.notePlaceholder')} aria-label={t('task.addNote')} value={note} onChange={(e) => setNote(e.target.value)} />
          <div>
            <button className="btn btn-primary" disabled={!note.trim()} onClick={() => { void useTeam.getState().addNote(task.id, note); setNote('') }}>{t('task.saveNote')}</button>
          </div>
        </Group>
      </div>
      {zoom && <div className="modal-back" onMouseDown={() => setZoom(null)}><img className="shot-zoom" src={zoom} alt="" /></div>}
    </div>
  )
}

tabRenderers.task = TaskTab
