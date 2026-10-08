import { useState, type ReactNode } from 'react'
import { create } from 'zustand'
import type { GitStatusEntry } from '@shared/types'
import { basename, joinPath } from '@shared/paths'
import { call, errMsg } from '../ipc'
import { useApp } from '../stores/app'
import { useGit, letterOf, letterClass } from '../stores/git'
import { useEditor } from '../stores/editor'
import { newTerminal } from '../stores/terminal'
import { openMenu, promptDialog, confirmDialog, toast } from '../stores/ui'
import { registerCommand } from '../commands'
import { showPanel } from '../layout'
import { tr, useT } from '../i18n'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Empty'
import { sidebarViews } from './registry'

export const useSync = create<{ busy: boolean }>(() => ({ busy: false }))

// Run a git action: show errors as a toast, always refresh the status afterwards.
async function act(fn: () => Promise<unknown>): Promise<void> {
  try { await fn() } catch (e) { toast(errMsg(e), 'error') }
  await useGit.getState().refresh()
}

export async function syncNow(): Promise<void> {
  if (useSync.getState().busy) return
  useSync.setState({ busy: true })
  try {
    await call('git.sync')
    toast(tr('scm.synced'))
  } catch (e) {
    const m = errMsg(e)
    toast(m, 'error', /conflict/i.test(m) ? { label: tr('scm.openTerminal'), run: () => void newTerminal() } : undefined)
  } finally {
    useSync.setState({ busy: false })
    await useGit.getState().refresh()
  }
}

export async function openBranchMenu(el: HTMLElement): Promise<void> {
  let b
  try { b = await call('git.branches') } catch { return }
  const r = el.getBoundingClientRect()
  openMenu(r.left, r.bottom, [
    ...b.all.map((n) => ({
      label: `${n === b.current ? '✓ ' : '    '}${n}`,
      run: () => { if (n !== b.current) void act(() => call('git.switch', n, false)) }
    })),
    ...(b.all.length ? ['sep' as const] : []),
    {
      label: tr('scm.newBranch'),
      run: async () => {
        const name = await promptDialog(tr('scm.newBranchPrompt'))
        if (name) void act(() => call('git.switch', name, true))
      }
    }
  ])
}

const shownLetter = (e: GitStatusEntry, staged: boolean): string => {
  const l = letterOf(e)
  if (l === '!') return l
  const c = staged ? e.index : e.work === '?' ? 'U' : e.work
  return c === 'C' ? 'R' : c
}

function Entry({ e, staged }: { e: GitStatusEntry; staged: boolean }) {
  const t = useT()
  const root = useApp((s) => s.root)!
  const l = shownLetter(e, staged)
  const name = basename(e.path)
  const dir = e.path.includes('/') ? e.path.slice(0, e.path.lastIndexOf('/')) : ''
  const open = () => useEditor.getState().open(
    { kind: 'diff', diff: 'head', path: joinPath(root, e.path), title: tr('scm.diffTitle', { name }) }, true)
  const discard = async () => {
    const ok = await confirmDialog({ title: t('scm.discardConfirm', { name }), text: e.path, danger: true, confirmLabel: t('scm.discard') })
    if (!ok) return
    const untracked = e.work === '?'
    await act(() => call('git.discard', untracked ? [] : [e.path], untracked ? [e.path] : []))
  }
  const btn = (icon: string, label: string, run: () => void) => (
    <button className="icon-btn" title={label} aria-label={label} onClick={(ev) => { ev.stopPropagation(); run() }}><Icon name={icon} /></button>
  )
  return (
    <div className="row" role="button" tabIndex={0} title={e.path} onClick={open} onKeyDown={(k) => { if (k.key === 'Enter') open() }}>
      <Icon name="file" />
      <span className="ellipsis">{name}</span>
      <span className="dim small ellipsis flex1">{dir}</span>
      <span className={`git-letter git-letter-inline ${letterClass(l)}`}>{l}</span>
      <span className="row-actions">
        {!staged && btn('discard', t('scm.discard'), () => void discard())}
        {staged ? btn('remove', t('scm.unstage'), () => void act(() => call('git.unstage', [e.path])))
          : btn('add', t('scm.stage'), () => void act(() => call('git.stage', [e.path])))}
      </span>
    </div>
  )
}

function Section({ title, count, actions, children }: { title: string; count: number; actions: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="section-h" style={{ padding: '0 8px' }}>
        <span className="ellipsis">{title}</span>
        <span className="badge">{count}</span>
        <span className="flex1" />
        <span className="pane-actions" style={{ opacity: 1 }}>{actions}</span>
      </div>
      {children}
    </>
  )
}

function CommitBox({ stagedCount }: { stagedCount: number }) {
  const t = useT()
  const [msg, setMsg] = useState('')
  const can = stagedCount > 0 && msg.trim().length > 0
  const commit = () => { if (can) void act(async () => { await call('git.commit', msg); setMsg(''); toast(tr('scm.committed')) }) }
  return (
    <div className="scm-commit">
      <textarea className="textarea" rows={3} value={msg} placeholder={t('scm.commitMsg')} aria-label={t('scm.commitMsg')}
        onChange={(e) => setMsg(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit() } }} />
      <button className="btn btn-primary" disabled={!can} onClick={commit}><Icon name="check" />{t('scm.commit')}</button>
    </div>
  )
}

export function SourceControl() {
  const t = useT()
  const root = useApp((s) => s.root)
  const st = useGit((s) => s.status)
  const busy = useSync((s) => s.busy)
  if (!root) return <Empty text={t('scm.noProject')} />
  if (!st) return <Empty text={t('scm.notRepo')} />
  const staged = st.files.filter((f) => f.index !== ' ' && f.index !== '?')
  const changes = st.files.filter((f) => f.work !== ' ')
  const paths = (list: GitStatusEntry[]) => list.map((f) => f.path)
  const ab = (icon: string, label: string, run: () => void) => (
    <button className="icon-btn" title={label} aria-label={label} onClick={run}><Icon name={icon} /></button>
  )
  return (
    <div style={{ paddingBottom: 16 }}>
      <div className="scm-branch" style={{ padding: 8 }}>
        <button className="btn flex1" style={{ justifyContent: 'flex-start' }} onClick={(e) => void openBranchMenu(e.currentTarget)}>
          <Icon name="source-control" /><span className="ellipsis">{st.branch ?? t('status.detached')}</span>
        </button>
        <button className="btn" disabled={busy} title={t('status.sync', { ahead: st.ahead, behind: st.behind })} onClick={() => void syncNow()}>
          <Icon name="sync" />{busy ? '…' : `↑${st.ahead} ↓${st.behind}`}
        </button>
      </div>
      <CommitBox stagedCount={staged.length} />
      {staged.length > 0 && (
        <Section title={t('scm.staged')} count={staged.length}
          actions={ab('remove', t('scm.unstageAll'), () => void act(() => call('git.unstage', paths(staged))))}>
          {staged.map((f) => <Entry key={'s' + f.path} e={f} staged />)}
        </Section>
      )}
      {changes.length > 0 && (
        <Section title={t('scm.changes')} count={changes.length}
          actions={ab('add', t('scm.stageAll'), () => void act(() => call('git.stage', paths(changes))))}>
          {changes.map((f) => <Entry key={'c' + f.path} e={f} staged={false} />)}
        </Section>
      )}
      {!staged.length && !changes.length && <div className="empty dim">{t('scm.noChanges')}</div>}
    </div>
  )
}

function ScmBadge() {
  const n = useGit((s) => s.status?.files.length ?? 0)
  return n > 0 ? <span className="badge">{n > 99 ? '99+' : n}</span> : null
}

sidebarViews.push({ id: 'scm', title: 'view.scm', icon: 'source-control', Comp: SourceControl, Badge: ScmBadge })

registerCommand(
  { id: 'view.scm', title: 'cmd.scm', keys: 'Ctrl+Shift+G', run: () => { useApp.getState().setView('scm'); showPanel('side') } },
  { id: 'git.sync', title: 'cmd.sync', run: syncNow }
)
