import type { ComponentType } from 'react'
import { useApp } from '../stores/app'
import { useEditor, openFile, type Tab, type TabKind } from '../stores/editor'
import { openMenu } from '../stores/ui'
import { call } from '../ipc'
import { useT } from '../i18n'
import { getCommand, runCommand } from '../commands'
import { relPath, joinPath, extOf } from '@shared/paths'
import { Icon } from '../components/Icon'
import { FileEditor } from './FileEditor'
import { DiffTab } from './DiffTab'
import { editorBanners } from './registry'

const Banners = () => <>{editorBanners.map((B, i) => <B key={i} />)}</>

// Later tasks assign renderers for other tab kinds, e.g. tabRenderers.settings = SettingsTab.
export const tabRenderers: Partial<Record<TabKind, ComponentType<{ tab: Tab }>>> = { diff: DiffTab }
// Shown in the empty editor when no folder is open (Plan 2 adds Home here).
export const emptyEditorExtras: ComponentType[] = []

const ICONS: Record<string, string> = { md: 'markdown', json: 'json', png: 'file-media', jpg: 'file-media', jpeg: 'file-media', gif: 'file-media', svg: 'file-media', webp: 'file-media' }
const CODE = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'cs', 'css', 'scss', 'html', 'vue', 'svelte', 'sql', 'sh', 'ps1', 'yml', 'yaml', 'toml'])
export const fileIcon = (name: string): string => ICONS[extOf(name)] ?? (CODE.has(extOf(name)) ? 'file-code' : 'file')
const KIND_ICON: Record<TabKind, string> = { file: 'file', diff: 'diff', settings: 'settings-gear', manual: 'book', task: 'checklist' }
const SHORTCUTS = ['quickOpen', 'palette.open', 'view.toggleTerminal', 'agent.focus', 'manual.open']

function EmptyEditor() {
  const t = useT()
  const root = useApp((s) => s.root)
  if (!root && emptyEditorExtras.length) return <>{emptyEditorExtras.map((C, i) => <C key={i} />)}</>
  return (
    <div className="empty-center">
      <Icon name="layers" className="empty-icon" />
      <div className="empty-title">{t(root ? 'editor.noFile' : 'editor.noFolder')}</div>
      {root && <div className="dim">{t('editor.empty.sub')}</div>}
      {!root && <button className="btn btn-primary" onClick={() => runCommand('project.openFolder')}><Icon name="folder-opened" />{t('cmd.openFolder')}</button>}
      <div className="shortcut-list">
        {SHORTCUTS.map((id) => getCommand(id)).filter((c) => c?.keys).map((c) => (
          <div key={c!.id} style={{ display: 'contents' }}><span>{t(c!.title)}</span><kbd>{c!.keys}</kbd></div>
        ))}
      </div>
    </div>
  )
}

function Tabs() {
  const t = useT()
  const { tabs, active, dirty, deleted, flash, activate, pin, close } = useEditor()
  return (
    <div className="tabs" role="tablist" onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY }}>
      {tabs.map((x) => {
        const isDirty = !!(x.path && x.kind === 'file' && dirty[x.path])
        const cls = ['tab', x.id === active && 'active', x.preview && 'preview', x.path && flash[x.path] && 'flash', x.path && deleted[x.path] && 'deleted'].filter(Boolean).join(' ')
        const label = x.kind === 'settings' || x.kind === 'manual' ? t(x.title) : x.title
        return (
          <div key={x.id} role="tab" aria-selected={x.id === active} tabIndex={0} className={cls} title={x.path ?? label}
            onClick={() => activate(x.id)} onDoubleClick={() => pin(x.id)}
            onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); void close(x.id) } }}
            onKeyDown={(e) => { if (e.key === 'Enter') activate(x.id) }}>
            <Icon name={x.kind === 'file' ? fileIcon(x.title) : KIND_ICON[x.kind]} />
            <span className="ellipsis tab-label">{label}</span>
            <button className={`tab-close${isDirty ? ' dirty' : ''}`} aria-label={t('common.close')} title={t('common.close')}
              onClick={(e) => { e.stopPropagation(); void close(x.id) }}>
              {isDirty ? <><Icon name="circle-filled" className="when-idle" /><Icon name="close" className="when-hover" /></> : <Icon name="close" />}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function Breadcrumbs({ path }: { path: string }) {
  const root = useApp((s) => s.root)
  if (!root) return null
  const parts = relPath(root, path).split('/')
  const show = async (i: number, el: HTMLElement) => {
    const dir = i === 0 ? root : joinPath(root, parts.slice(0, i).join('/'))
    const list = await call('fs.list', dir)
    const r = el.getBoundingClientRect()
    openMenu(r.left, r.bottom, list.filter((e) => !e.dir).map((e) => ({ label: e.name, run: () => openFile(e.path) })))
  }
  return (
    <div className="breadcrumbs">
      {parts.map((p, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span className="crumb-sep">›</span>}
          <button className="crumb" onClick={(e) => void show(i, e.currentTarget)}>{p}</button>
        </span>
      ))}
    </div>
  )
}

export function EditorArea() {
  const tabs = useEditor((s) => s.tabs)
  const active = useEditor((s) => s.active)
  const tab = tabs.find((x) => x.id === active)
  if (!tab) return <div className="editor-area"><Banners />{tabs.length > 0 && <Tabs />}<EmptyEditor /></div>
  const R = tabRenderers[tab.kind]
  return (
    <div className="editor-area">
      <Banners />
      <Tabs />
      {tab.kind === 'file' && tab.path && <Breadcrumbs path={tab.path} />}
      <div className="editor-body">
        {tab.kind === 'file' && tab.path ? <FileEditor key={tab.path} path={tab.path} /> : R ? <R key={tab.id} tab={tab} /> : null}
      </div>
    </div>
  )
}
