import { app } from 'electron'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { Settings } from '@shared/types'
import { handle } from '../ipc'
import { writeJsonAtomic } from '../util'

export const DEFAULT_SETTINGS: Settings = {
  lang: 'en', theme: 'mono-dark', fontSize: 14, autoSave: 'off', wordWrap: false, tabSize: 4, teamSkills: false, minimap: true, lineNumbers: true, terminalFontSize: 13,
  defaultAgent: null, defaultMode: 'acceptEdits', fetchInterval: 15, syncPaused: false, setupDone: false,
  layout: { sidebar: 20, agent: 28, panel: 30, sidebarVisible: true, agentVisible: true, panelVisible: false }
}

const pick = <T,>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d)
const num = (v: unknown, min: number, max: number, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : d
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

export function mergeSettings(raw: unknown): Settings {
  const r = obj(raw), l = obj(r.layout), d = DEFAULT_SETTINGS, dl = d.layout
  return {
    lang: pick(r.lang, ['en', 'th'] as const, d.lang),
    theme: pick(r.theme, ['mono-dark', 'mono-light', 'mocha', 'github-dark'] as const, d.theme),
    fontSize: num(r.fontSize, 10, 24, d.fontSize),
    autoSave: pick(r.autoSave, ['off', 'delay'] as const, d.autoSave),
    wordWrap: bool(r.wordWrap, d.wordWrap),
    tabSize: pick(r.tabSize, [2, 4, 8] as const, d.tabSize),
    teamSkills: bool(r.teamSkills, d.teamSkills),
    minimap: bool(r.minimap, d.minimap),
    lineNumbers: bool(r.lineNumbers, d.lineNumbers),
    terminalFontSize: num(r.terminalFontSize, 10, 24, d.terminalFontSize),
    defaultAgent: typeof r.defaultAgent === 'string' ? r.defaultAgent : null,
    defaultMode: pick(r.defaultMode, ['plan', 'acceptEdits', 'bypassPermissions'] as const, d.defaultMode),
    fetchInterval: pick(r.fetchInterval, [15, 30, 60] as const, d.fetchInterval),
    syncPaused: bool(r.syncPaused, d.syncPaused),
    setupDone: bool(r.setupDone, d.setupDone),
    layout: {
      sidebar: num(l.sidebar, 5, 60, dl.sidebar),
      agent: num(l.agent, 5, 70, dl.agent),
      panel: num(l.panel, 5, 80, dl.panel),
      sidebarVisible: bool(l.sidebarVisible, dl.sidebarVisible),
      agentVisible: bool(l.agentVisible, dl.agentVisible),
      panelVisible: bool(l.panelVisible, dl.panelVisible)
    }
  }
}

export function loadSettings(file: string): Settings {
  try { return mergeSettings(JSON.parse(readFileSync(file, 'utf8'))) } catch { return mergeSettings({}) }
}

let current: Settings = DEFAULT_SETTINGS
export const getSettings = (): Settings => current

export function registerSettings(): void {
  const file = join(app.getPath('userData'), 'settings.json')
  current = loadSettings(file)
  handle('settings.get', async () => current)
  handle('settings.set', async (patch) => {
    current = mergeSettings({ ...current, ...patch, layout: { ...current.layout, ...(patch.layout ?? {}) } })
    writeJsonAtomic(file, current)
    return current
  })
}
