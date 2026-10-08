import { registerCommand } from './commands'
import { call } from './ipc'
import { useApp } from './stores/app'
import { openPalette } from './stores/ui'
import { togglePanel, showPanel } from './layout'
import { THEME_IDS } from './theme/themes'
import type { EditRole } from '@shared/api'

const role = (r: EditRole) => () => call('win.role', r)

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
  { id: 'view.toggleSidebar', title: 'cmd.toggleSidebar', keys: 'Ctrl+B', run: () => togglePanel('side') },
  { id: 'view.toggleAgent', title: 'cmd.toggleAgent', keys: 'Ctrl+Alt+B', run: () => togglePanel('agent') },
  { id: 'view.toggleTerminal', title: 'cmd.toggleTerminal', keys: 'Ctrl+`', run: () => togglePanel('panel') },
  { id: 'view.explorer', title: 'cmd.explorer', keys: 'Ctrl+Shift+E', run: () => { useApp.getState().setView('explorer'); showPanel('side') } }
)

// Plan 2 replaces this with the full project flow (git check, recent list).
registerCommand({
  id: 'project.openFolder', title: 'cmd.openFolder',
  run: async () => {
    const p = await call('dialog.openFolder')
    if (!p) return
    useApp.getState().setRoot(await call('project.open', p))
  }
})
