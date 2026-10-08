import { useEffect, type CSSProperties } from 'react'
import type { FileEntry } from '@shared/types'
import { basename, dirname, joinPath, relPath } from '@shared/paths'
import { call, errMsg } from '../ipc'
import { useApp } from '../stores/app'
import { useExplorer } from '../stores/explorer'
import { useGit, letterClass } from '../stores/git'
import { useEditor, openFile } from '../stores/editor'
import { openMenu, promptDialog, confirmDialog, toast, type MenuEntry } from '../stores/ui'
import { tr, useT } from '../i18n'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Empty'
import { fileIcon } from './EditorArea'
import { sidebarViews } from './registry'

const safe = (fn: () => Promise<unknown>) => () => { void fn().catch((e) => toast(errMsg(e), 'error')) }

const closeTabsUnder = (path: string) => {
  const ed = useEditor.getState()
  for (const t of ed.tabs) if (t.path && (t.path === path || t.path.startsWith(path + '\\') || t.path.startsWith(path + '/'))) {
    ed.setDirty(t.path, false)
    void ed.close(t.id)
  }
}

async function createIn(dir: string, isDir: boolean) {
  const name = await promptDialog(tr(isDir ? 'explorer.newFolder' : 'explorer.newFile'))
  if (!name) return
  const p = joinPath(dir, name)
  await call('fs.create', p, isDir)
  const ex = useExplorer.getState()
  if (dir !== useApp.getState().root) useExplorer.setState((s) => ({ expanded: { ...s.expanded, [dir]: true } }))
  await ex.load(dir)
  if (!isDir) openFile(p)
}

async function rename(e: FileEntry) {
  const name = await promptDialog(tr('explorer.rename'), e.name)
  if (!name || name === e.name) return
  closeTabsUnder(e.path)
  await call('fs.rename', e.path, joinPath(dirname(e.path), name))
}

async function remove(e: FileEntry) {
  const ok = await confirmDialog({ title: tr('explorer.deleteConfirm', { name: e.name }), text: e.path, danger: true, confirmLabel: tr('explorer.delete') })
  if (!ok) return
  closeTabsUnder(e.path)
  await call('fs.delete', e.path)
}

function menuFor(e: FileEntry): MenuEntry[] {
  const items: MenuEntry[] = []
  if (e.dir) items.push({ label: tr('explorer.newFile'), run: safe(() => createIn(e.path, false)) }, { label: tr('explorer.newFolder'), run: safe(() => createIn(e.path, true)) }, 'sep')
  items.push(
    { label: tr('explorer.rename'), keys: 'F2', run: safe(() => rename(e)) },
    { label: tr('explorer.delete'), keys: 'Delete', danger: true, run: safe(() => remove(e)) },
    'sep',
    { label: tr('explorer.reveal'), run: safe(() => call('fs.reveal', e.path)) },
    { label: tr('explorer.copyPath'), run: safe(() => navigator.clipboard.writeText(e.path)) }
  )
  return items
}

function Node({ e, depth }: { e: FileEntry; depth: number }) {
  const open = useExplorer((s) => !!s.expanded[e.path])
  const sel = useExplorer((s) => s.selected === e.path)
  const root = useApp((s) => s.root)
  const rel = root ? relPath(root, e.path) : ''
  // files: their letter; folders: a dot when something inside changed
  const letter = useGit((s) => (e.dir ? (s.dirtyDirs[rel] ? '•' : '') : (s.letters[rel] ?? '')))
  const activate = (preview: boolean) => {
    useExplorer.setState({ selected: e.path })
    if (e.dir) useExplorer.getState().toggle(e.path)
    else openFile(e.path, { preview })
  }
  return (
    <>
      <div role="treeitem" aria-expanded={e.dir ? open : undefined} aria-selected={sel} tabIndex={0}
        className={`row tree-row${sel ? ' sel' : ''}`} style={{ paddingLeft: 8 + depth * 8 }} title={e.path}
        onClick={() => activate(true)}
        onDoubleClick={() => !e.dir && openFile(e.path, { preview: false })}
        onKeyDown={(k) => {
          if (k.key === 'Enter') activate(false)
          else if (k.key === 'F2') safe(() => rename(e))()
          else if (k.key === 'Delete') safe(() => remove(e))()
        }}
        onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); useExplorer.setState({ selected: e.path }); openMenu(ev.clientX, ev.clientY, menuFor(e)) }}>
        <span className="tree-chevron">{e.dir && <Icon name={open ? 'chevron-down' : 'chevron-right'} />}</span>
        <Icon name={e.dir ? (open ? 'folder-opened' : 'folder') : fileIcon(e.name)} />
        <span className="ellipsis tree-name">{e.name}</span>
        {letter && <span className={`git-letter ${letterClass(letter)}`}>{letter}</span>}
      </div>
      {e.dir && open && (
        <div role="group" className="tree-group" style={{ '--guide': `${8 + depth * 8 + 7}px` } as CSSProperties}>
          <Tree dir={e.path} depth={depth + 1} />
        </div>
      )}
    </>
  )
}

function Tree({ dir, depth }: { dir: string; depth: number }) {
  const t = useT()
  const list = useExplorer((s) => s.children[dir])
  if (!list) return null
  if (!list.length && depth > 0) return <div className="row dim" style={{ paddingLeft: 8 + depth * 8 + 22 }}>{t('explorer.empty')}</div>
  return <>{list.map((e) => <Node key={e.path} e={e} depth={depth} />)}</>
}

export function Explorer() {
  const t = useT()
  const root = useApp((s) => s.root)
  useEffect(() => {
    useExplorer.getState().reset()
    if (root) void useExplorer.getState().load(root)
  }, [root])
  if (!root) {
    return (
      <div className="explorer-empty">
        <Icon name="folder-opened" className="empty-icon" />
        <div className="dim">{t('editor.noFolder')}</div>
        <button className="btn btn-primary" onClick={() => runOpen()}><Icon name="folder-opened" />{t('cmd.openFolder')}</button>
      </div>
    )
  }
  return (
    <div role="tree" aria-label={basename(root)} style={{ minHeight: '100%' }}
      onContextMenu={(ev) => {
        ev.preventDefault()
        openMenu(ev.clientX, ev.clientY, [
          { label: tr('explorer.newFile'), run: safe(() => createIn(root, false)) },
          { label: tr('explorer.newFolder'), run: safe(() => createIn(root, true)) }
        ])
      }}>
      <Tree dir={root} depth={0} />
    </div>
  )
}

function runOpen() { void import('../commands').then((m) => m.runCommand('project.openFolder')) }

export function ExplorerActions() {
  const t = useT()
  const root = useApp((s) => s.root)
  if (!root) return null
  const target = () => {
    const sel = useExplorer.getState().selected
    const entry = sel ? Object.values(useExplorer.getState().children).flat().find((x) => x.path === sel) : undefined
    return entry ? (entry.dir ? entry.path : dirname(entry.path)) : root
  }
  return (
    <>
      <button className="icon-btn" title={t('explorer.newFile')} aria-label={t('explorer.newFile')} onClick={safe(() => createIn(target(), false))}><Icon name="new-file" /></button>
      <button className="icon-btn" title={t('explorer.newFolder')} aria-label={t('explorer.newFolder')} onClick={safe(() => createIn(target(), true))}><Icon name="new-folder" /></button>
      <button className="icon-btn" title={t('explorer.refresh')} aria-label={t('explorer.refresh')}
        onClick={() => { const ex = useExplorer.getState(); for (const d of Object.keys(ex.children)) void ex.load(d) }}><Icon name="refresh" /></button>
      <button className="icon-btn" title={t('explorer.collapse')} aria-label={t('explorer.collapse')} onClick={() => useExplorer.getState().collapseAll()}><Icon name="collapse-all" /></button>
    </>
  )
}

sidebarViews.push({ id: 'explorer', title: 'view.explorer', icon: 'files', Comp: Explorer, Actions: ExplorerActions })
