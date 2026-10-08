import { create } from 'zustand'
import type { FileEntry } from '@shared/types'
import { dirname } from '@shared/paths'
import { call, on } from '../ipc'
import { useApp } from './app'

interface ExplorerState {
  children: Record<string, FileEntry[]>
  expanded: Record<string, boolean>
  selected: string | null
  load(dir: string): Promise<void>
  toggle(dir: string): void
  reset(): void
  collapseAll(): void
  reveal(path: string): Promise<void>
}

export const useExplorer = create<ExplorerState>((set, get) => ({
  children: {}, expanded: {}, selected: null,
  load: async (dir) => {
    try {
      const list = await call('fs.list', dir)
      set((s) => ({ children: { ...s.children, [dir]: list } }))
    } catch {
      set((s) => { const c = { ...s.children }; delete c[dir]; return { children: c } })
    }
  },
  toggle: (dir) => {
    const open = !get().expanded[dir]
    set((s) => ({ expanded: { ...s.expanded, [dir]: open } }))
    if (open && !get().children[dir]) void get().load(dir)
  },
  reset: () => set({ children: {}, expanded: {}, selected: null }),
  collapseAll: () => set({ expanded: {} }),
  // Expands every parent folder of `path` and selects it.
  reveal: async (path) => {
    const root = useApp.getState().root
    if (!root) return
    const chain: string[] = []
    for (let d = dirname(path); d.length > root.length; d = dirname(d)) chain.unshift(d)
    for (const d of chain) {
      set((s) => ({ expanded: { ...s.expanded, [d]: true } }))
      if (!get().children[d]) await get().load(d)
    }
    set({ selected: path })
  }
}))

// Reload a loaded folder when something inside it changes.
const timers = new Map<string, ReturnType<typeof setTimeout>>()
on('fs.changed', ({ path }) => {
  const parent = dirname(path)
  for (const dir of [parent, path]) {
    if (!useExplorer.getState().children[dir]) continue
    clearTimeout(timers.get(dir))
    timers.set(dir, setTimeout(() => void useExplorer.getState().load(dir), 150))
  }
})
