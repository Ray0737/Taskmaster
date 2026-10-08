import { create } from 'zustand'

export interface Toast { id: number; text: string; kind: 'info' | 'error'; action?: { label: string; run: () => void } }
export interface MenuItem { label: string; keys?: string; run: () => void; danger?: boolean; disabled?: boolean }
export type MenuEntry = MenuItem | 'sep'
type Dialog =
  | { kind: 'confirm'; title: string; text: string; danger?: boolean; confirmLabel?: string; resolve: (v: boolean) => void }
  | { kind: 'prompt'; title: string; value: string; resolve: (v: string | null) => void }

interface UiState {
  toasts: Toast[]
  dialog: Dialog | null
  menu: { x: number; y: number; items: MenuEntry[] } | null
  palette: string | null // null = closed, string = initial input text
}

export const useUi = create<UiState>(() => ({ toasts: [], dialog: null, menu: null, palette: null }))

let seq = 0
export function toast(text: string, kind: Toast['kind'] = 'info', action?: Toast['action']): void {
  const id = ++seq
  useUi.setState((s) => ({ toasts: [...s.toasts, { id, text, kind, action }].slice(-3) }))
  if (kind === 'info') setTimeout(() => closeToast(id), 5000)
}
export const closeToast = (id: number): void => useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))

export const confirmDialog = (o: { title: string; text: string; danger?: boolean; confirmLabel?: string }): Promise<boolean> =>
  new Promise((resolve) => useUi.setState({ dialog: { kind: 'confirm', ...o, resolve } }))

export const promptDialog = (title: string, value = ''): Promise<string | null> =>
  new Promise((resolve) => useUi.setState({ dialog: { kind: 'prompt', title, value, resolve } }))

export const openMenu = (x: number, y: number, items: MenuEntry[]): void => useUi.setState({ menu: { x, y, items } })
export const openPalette = (text = ''): void => useUi.setState({ palette: text })
