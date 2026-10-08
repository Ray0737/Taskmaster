import type { ImperativePanelHandle } from 'react-resizable-panels'
import type { PanelKey } from './stores/app'

export const panels: Record<PanelKey, ImperativePanelHandle | null> = { side: null, agent: null, panel: null }

export function togglePanel(k: PanelKey): void {
  const p = panels[k]
  if (!p) return
  if (p.isCollapsed()) p.expand()
  else p.collapse()
}

export const showPanel = (k: PanelKey): void => { if (panels[k]?.isCollapsed()) panels[k]?.expand() }
