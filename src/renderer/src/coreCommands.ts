import { registerCommand } from './commands'
import { call } from './ipc'
import { useApp } from './stores/app'
import { openPalette } from './stores/ui'
import { togglePanel, showPanel, panels } from './layout'
import { THEME_IDS } from './theme/themes'
import { useEditor, saveActive } from './stores/editor'
import { useTerm, newTerminal } from './stores/terminal'
import type { EditRole } from '@shared/api'

const role = (r: EditRole) => () => call('win.role', r)
// Ctrl+= / Ctrl+- / Ctrl+0 change the editor font size (10 to 24, default 14), not the whole window.
const zoom = (d: number | null) => { const st = useApp.getState(); void st.set({ fontSize: d === null ? 14 : Math.min(24, Math.max(10, st.settings!.fontSize + d)) }) }

registerCommand(
  { id: 'edit.undo', title: 'cmd.undo', run: role('undo'), hidden: true },
  { id: 'edit.redo', title: 'cmd.redo', run: role('redo'), hidden: true },
  { id: 'edit.cut', title: 'cmd.cut', run: role('cut'), hidden: true },
  { id: 'edit.copy', title: 'cmd.copy', run: role('copy'), hidden: true },
  { id: 'edit.paste', title: 'cmd.paste', run: role('paste'), hidden: true },
  { id: 'edit.selectAll', title: 'cmd.selectAll', run: role('selectAll'), hidden: true },
  { id: 'app.quit', title: 'cmd.quit', run: () => call('app.quit') },
  { id: 'app.openLogs', title: 'cmd.openLogs', run: () => call('app.openLogs') },
  {
    id: 'lang.toggle', title: 'cmd.langToggle',
    run: () => useApp.getState().set({ lang: useApp.getState().settings?.lang === 'th' ? 'en' : 'th' })
  },
  { id: 'theme.pick', title: 'cmd.themePick', run: () => openPalette('>' + 'Theme') },
  ...THEME_IDS.map((id) => ({ id: `theme.${id}`, title: `theme.${id}`, run: () => useApp.getState().set({ theme: id }) })),
  { id: 'editor.zoomIn', title: 'cmd.zoomIn', keys: 'Ctrl+=', run: () => zoom(1) },
  { id: 'editor.zoomOut', title: 'cmd.zoomOut', keys: 'Ctrl+-', run: () => zoom(-1) },
  { id: 'editor.zoomReset', title: 'cmd.zoomReset', keys: 'Ctrl+0', run: () => zoom(null) },
  { id: 'view.toggleSidebar', title: 'cmd.toggleSidebar', keys: 'Ctrl+B', run: () => togglePanel('side') },
  { id: 'view.toggleAgent', title: 'cmd.toggleAgent', keys: 'Ctrl+Alt+B', run: () => togglePanel('agent') },
  { id: 'view.toggleTerminal', title: 'cmd.toggleTerminal', keys: 'Ctrl+`', run: () => {
    togglePanel('panel')
    if (!useTerm.getState().list.length && panels.panel && !panels.panel.isCollapsed()) void newTerminal()
  } },
  { id: 'view.explorer', title: 'cmd.explorer', keys: 'Ctrl+Shift+E', run: () => { useApp.getState().setView('explorer'); showPanel('side') } }
)

registerCommand(
  { id: 'palette.open', title: 'cmd.palette', keys: 'Ctrl+Shift+P', run: () => openPalette('>') },
  { id: 'quickOpen', title: 'cmd.quickOpen', keys: 'Ctrl+P', run: () => openPalette('') }
)

registerCommand({ id: 'terminal.new', title: 'cmd.newTerminal', keys: 'Ctrl+Shift+`', run: () => newTerminal() })

// Plan 2 replaces this with the full project flow (git check, recent list).
registerCommand({
  id: 'project.openFolder', title: 'cmd.openFolder',
  run: async () => {
    const p = await call('dialog.openFolder')
    if (!p) return
    useEditor.getState().closeAll()
    useApp.getState().setRoot(await call('project.open', p))
  }
})

registerCommand(
  { id: 'file.save', title: 'cmd.save', keys: 'Ctrl+S', run: saveActive },
  { id: 'tab.close', title: 'cmd.closeTab', keys: 'Ctrl+W', run: () => { const a = useEditor.getState().active; if (a) void useEditor.getState().close(a) } },
  { id: 'tab.next', title: 'cmd.nextTab', keys: 'Ctrl+Tab', run: () => useEditor.getState().next() }
)
