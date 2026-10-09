import { create } from 'zustand'
import type { Settings, SettingsPatch } from '@shared/types'
import { call } from '../ipc'

export type SidebarView = 'explorer' | 'scm' | 'tasks' | 'team' | 'notifications'
export type PanelKey = 'side' | 'agent' | 'panel'

interface AppState {
  settings: Settings | null
  root: string | null
  view: SidebarView
  open: Record<PanelKey, boolean>
  load(): Promise<void>
  set(patch: SettingsPatch): Promise<void>
  setRoot(root: string | null): void
  setView(v: SidebarView): void
  setOpen(k: PanelKey, v: boolean): void
}

export const useApp = create<AppState>((set) => ({
  settings: null,
  root: null,
  view: 'explorer',
  open: { side: true, agent: true, panel: false },
  load: async () => {
    const s = await call('settings.get')
    set({ settings: s, open: { side: s.layout.sidebarVisible, agent: s.layout.agentVisible, panel: s.layout.panelVisible } })
  },
  set: async (patch) => set({ settings: await call('settings.set', patch) }),
  setRoot: (root) => set({ root }),
  setView: (view) => set({ view }),
  setOpen: (k, v) => set((s) => ({ open: { ...s.open, [k]: v } }))
}))
