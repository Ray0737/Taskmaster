import { create } from 'zustand'
import { basename } from '@shared/paths'
import { call, on } from '../ipc'
import { getModel, disposeModel } from '../monaco'
import { confirmDialog } from './ui'
import { tr } from '../i18n'

export type TabKind = 'file' | 'diff' | 'settings' | 'manual' | 'task' | 'mdpreview'
export interface Tab { id: string; kind: TabKind; title: string; path?: string; taskId?: string; diff?: 'disk' | 'head'; preview: boolean }
type NewTab = Omit<Tab, 'id' | 'preview'>

const tabId = (t: NewTab): string => `${t.kind}:${t.path ?? t.taskId ?? ''}${t.diff ? ':' + t.diff : ''}`
const flag = (rec: Record<string, boolean>, k: string, v: boolean): Record<string, boolean> => {
  const n = { ...rec }
  if (v) n[k] = true
  else delete n[k]
  return n
}

interface EditorState {
  tabs: Tab[]
  active: string | null
  dirty: Record<string, boolean> // by path
  conflict: Record<string, boolean> // by path: changed on disk while dirty
  deleted: Record<string, boolean> // by path
  flash: Record<string, boolean> // by path: reloaded from disk just now
  open(t: NewTab, preview?: boolean): void
  close(id: string): Promise<void>
  closeAll(): void
  activate(id: string): void
  pin(id: string): void
  next(): void
  setDirty(path: string, v: boolean): void
}

export const useEditor = create<EditorState>((set, get) => ({
  tabs: [], active: null, dirty: {}, conflict: {}, deleted: {}, flash: {},

  open: (t, preview = false) => {
    const id = tabId(t)
    const { tabs, active } = get()
    const existing = tabs.find((x) => x.id === id)
    if (existing) {
      set({ active: id, tabs: preview ? tabs : tabs.map((x) => (x.id === id ? { ...x, preview: false } : x)) })
      return
    }
    const tab: Tab = { ...t, id, preview }
    const prevIdx = preview ? tabs.findIndex((x) => x.preview && !(x.path && get().dirty[x.path])) : -1
    if (prevIdx >= 0) {
      const old = tabs[prevIdx]
      if (old.kind === 'file' && old.path) disposeModel(old.path)
      set({ tabs: tabs.map((x, i) => (i === prevIdx ? tab : x)), active: id })
      return
    }
    const at = Math.max(tabs.findIndex((x) => x.id === active), tabs.length - 1) + 1
    set({ tabs: [...tabs.slice(0, at), tab, ...tabs.slice(at)], active: id })
  },

  close: async (id) => {
    const { tabs, active, dirty } = get()
    const tab = tabs.find((x) => x.id === id)
    if (!tab) return
    if (tab.kind === 'file' && tab.path && dirty[tab.path]) {
      const ok = await confirmDialog({ title: tr('editor.discard', { name: tab.title }), text: tab.path, danger: true, confirmLabel: tr('editor.discardBtn') })
      if (!ok) return
    }
    const i = tabs.indexOf(tab)
    const rest = tabs.filter((x) => x.id !== id)
    if (tab.kind === 'file' && tab.path) {
      disposeModel(tab.path)
      set((s) => ({ dirty: flag(s.dirty, tab.path!, false), conflict: flag(s.conflict, tab.path!, false), deleted: flag(s.deleted, tab.path!, false) }))
    }
    set({ tabs: rest, active: active === id ? (rest[Math.min(i, rest.length - 1)]?.id ?? null) : active })
  },

  closeAll: () => {
    for (const t of get().tabs) if (t.kind === 'file' && t.path) disposeModel(t.path)
    set({ tabs: [], active: null, dirty: {}, conflict: {}, deleted: {}, flash: {} })
  },

  activate: (id) => set({ active: id }),
  pin: (id) => set((s) => ({ tabs: s.tabs.map((x) => (x.id === id ? { ...x, preview: false } : x)) })),
  next: () => {
    const { tabs, active } = get()
    if (!tabs.length) return
    const i = tabs.findIndex((x) => x.id === active)
    set({ active: tabs[(i + 1) % tabs.length].id })
  },
  setDirty: (path, v) => {
    if (!!get().dirty[path] === v) return
    set((s) => ({
      dirty: flag(s.dirty, path, v),
      // editing a preview tab pins it (VS Code behavior)
      tabs: v ? s.tabs.map((x) => (x.kind === 'file' && x.path === path ? { ...x, preview: false } : x)) : s.tabs
    }))
  }
}))

export const openFile = (path: string, o: { preview?: boolean } = {}): void =>
  useEditor.getState().open({ kind: 'file', path, title: basename(path) }, o.preview ?? false)

export async function saveFile(path: string): Promise<void> {
  const m = getModel(path)
  if (!m) return
  await call('fs.write', path, m.getValue())
  const s = useEditor.getState()
  s.setDirty(path, false)
  useEditor.setState({ conflict: flag(s.conflict, path, false) })
}

export async function saveActive(): Promise<void> {
  const { tabs, active } = useEditor.getState()
  const t = tabs.find((x) => x.id === active)
  if (t?.kind === 'file' && t.path) await saveFile(t.path)
}

export async function reloadFromDisk(path: string): Promise<void> {
  const m = getModel(path)
  const c = await call('fs.read', path)
  if (c.kind === 'missing') { useEditor.setState((s) => ({ deleted: flag(s.deleted, path, true) })); return }
  useEditor.setState((s) => ({ deleted: flag(s.deleted, path, false), conflict: flag(s.conflict, path, false) }))
  if (c.kind !== 'text' || !m || m.getValue() === c.text) return
  m.setValue(c.text) // ponytail: resets undo history; upgrade path: pushEditOperations with a full-range edit
  useEditor.getState().setDirty(path, false)
  useEditor.setState((s) => ({ flash: flag(s.flash, path, true) }))
  setTimeout(() => useEditor.setState((s) => ({ flash: flag(s.flash, path, false) })), 500)
}

// Agent edits and other tools change files on disk: keep open tabs in sync (spec §12.5).
on('fs.changed', ({ path }) => {
  const s = useEditor.getState()
  if (!s.tabs.some((t) => t.kind === 'file' && t.path === path)) return
  if (s.dirty[path]) {
    void call('fs.read', path).then((c) => {
      if (c.kind === 'missing') useEditor.setState((x) => ({ deleted: flag(x.deleted, path, true) }))
      else if (c.kind === 'text' && c.text !== getModel(path)?.getValue()) useEditor.setState((x) => ({ conflict: flag(x.conflict, path, true) }))
    })
  } else void reloadFromDisk(path)
})
