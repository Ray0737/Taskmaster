import type { ThemeId } from '@shared/types'
import { call } from '../ipc'

export const UI_KEYS = ['bg-0', 'bg-1', 'bg-bar', 'bg-2', 'hover', 'selected', 'focus', 'fg', 'fg-dim', 'fg-faint', 'accent',
  'inv-bg', 'inv-fg', 'inv-hover', 'danger', 'ok', 'warn', 'diff-add', 'diff-del', 'scroll', 'scroll-hover'] as const
export type UiKey = typeof UI_KEYS[number]

export interface Syntax {
  comment: string; keyword: string; string: string; number: string; fn: string; type: string
  variable: string; operator: string; tag: string; attribute: string
  boldKeywords?: boolean; italicTypes?: boolean
}

export interface ThemeDef { label: string; dark: boolean; ui: Record<UiKey, string>; syntax: Syntax }

const ui = (v: string[]): Record<UiKey, string> =>
  Object.fromEntries(UI_KEYS.map((k, i) => [k, v[i]])) as Record<UiKey, string>

// Column order = UI_KEYS order. Values copied from spec §10.2 / §10.2.1.
export const THEMES: Record<ThemeId, ThemeDef> = {
  'mono-dark': {
    label: 'Mono Dark', dark: true,
    ui: ui(['#000000', '#0b0b0b', '#000000', '#141414', '#1c1c1c', '#262626', '#333333', '#e8e8e8', '#9a9a9a', '#6a6a6a', '#ffffff',
      '#e8e8e8', '#000000', '#ffffff', '#ff6b6b', '#e8e8e8', '#e8e8e8', '#1a2e1a', '#331a1a', '#2a2a2a', '#3d3d3d']),
    syntax: { comment: '#6a6a6a', keyword: '#ffffff', string: '#b5b5b5', number: '#d0d0d0', fn: '#f0f0f0', type: '#dcdcdc',
      variable: '#e8e8e8', operator: '#8a8a8a', tag: '#ffffff', attribute: '#b5b5b5', boldKeywords: true, italicTypes: true }
  },
  'mono-light': {
    label: 'Mono Light', dark: false,
    ui: ui(['#ffffff', '#f5f5f5', '#ececec', '#ebebeb', '#e0e0e0', '#d4d4d4', '#c4c4c4', '#111111', '#555555', '#8a8a8a', '#000000',
      '#111111', '#ffffff', '#333333', '#c62828', '#111111', '#111111', '#e3f3e3', '#f8e1e1', '#cfcfcf', '#b0b0b0']),
    syntax: { comment: '#8a8a8a', keyword: '#000000', string: '#444444', number: '#333333', fn: '#111111', type: '#222222',
      variable: '#111111', operator: '#666666', tag: '#000000', attribute: '#444444', boldKeywords: true, italicTypes: true }
  },
  mocha: {
    label: 'Catppuccin Mocha', dark: true,
    ui: ui(['#1e1e2e', '#181825', '#11111b', '#313244', '#2a2b3c', '#45475a', '#585b70', '#cdd6f4', '#a6adc8', '#6c7086', '#cba6f7',
      '#cba6f7', '#11111b', '#b4befe', '#f38ba8', '#a6e3a1', '#f9e2af', '#323c3f', '#3e2e40', '#45475a', '#585b70']),
    syntax: { comment: '#9399b2', keyword: '#cba6f7', string: '#a6e3a1', number: '#fab387', fn: '#89b4fa', type: '#f9e2af',
      variable: '#cdd6f4', operator: '#89dceb', tag: '#cba6f7', attribute: '#f9e2af' }
  },
  'github-dark': {
    label: 'GitHub Dark', dark: true,
    ui: ui(['#0d1117', '#010409', '#010409', '#161b22', '#1c2128', '#262c36', '#30363d', '#e6edf3', '#9198a1', '#6e7681', '#2f81f7',
      '#238636', '#ffffff', '#2ea043', '#f85149', '#3fb950', '#d29922', '#12261e', '#25171c', '#30363d', '#484f58']),
    syntax: { comment: '#8b949e', keyword: '#ff7b72', string: '#a5d6ff', number: '#79c0ff', fn: '#d2a8ff', type: '#ffa657',
      variable: '#e6edf3', operator: '#e6edf3', tag: '#7ee787', attribute: '#79c0ff' }
  }
}

export const THEME_IDS = Object.keys(THEMES) as ThemeId[]

export function applyTheme(id: ThemeId): void {
  const t = THEMES[id]
  const root = document.documentElement
  for (const k of UI_KEYS) root.style.setProperty(`--${k}`, t.ui[k])
  root.style.colorScheme = t.dark ? 'dark' : 'light'
  root.dataset.theme = id
  void call('win.setOverlay', t.ui['bg-bar'], t.ui.fg)
}
