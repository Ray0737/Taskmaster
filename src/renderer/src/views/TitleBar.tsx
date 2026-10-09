import { useApp } from '../stores/app'
import { useT } from '../i18n'
import { LimitBadges } from './LimitBadges'
import { openMenu, type MenuEntry } from '../stores/ui'
import { getCommand, hasCommand, runCommand } from '../commands'
import { Icon } from '../components/Icon'
import { basename } from '@shared/paths'

// Command ids not registered yet are skipped, so later plans just register them.
const MENUS: { label: string; items: string[] }[] = [
  { label: 'menu.file', items: ['project.new', 'project.openFolder', 'project.clone', 'sep', 'file.save', 'sep', 'settings.open', 'sep', 'project.close', 'app.quit'] },
  { label: 'menu.edit', items: ['edit.undo', 'edit.redo', 'sep', 'edit.cut', 'edit.copy', 'edit.paste', 'edit.selectAll'] },
  { label: 'menu.view', items: ['palette.open', 'sep', 'view.toggleSidebar', 'view.toggleAgent', 'view.toggleTerminal', 'sep', 'view.explorer', 'search.find', 'view.scm', 'view.tasks', 'view.team', 'view.notifications', 'sep', 'theme.pick', 'lang.toggle'] },
  { label: 'menu.go', items: ['quickOpen', 'tab.next'] },
  { label: 'menu.terminal', items: ['terminal.new', 'view.toggleTerminal'] },
  { label: 'menu.help', items: ['manual.open', 'setup.check', 'app.openLogs'] }
]

export function TitleBar() {
  const t = useT()
  const root = useApp((s) => s.root)
  const open = (m: (typeof MENUS)[number], el: HTMLElement) => {
    const entries: MenuEntry[] = []
    for (const id of m.items) {
      if (id === 'sep') { if (entries.length && entries[entries.length - 1] !== 'sep') entries.push('sep'); continue }
      if (!hasCommand(id)) continue
      const c = getCommand(id)!
      entries.push({ label: t(c.title), keys: c.keys, run: () => runCommand(id) })
    }
    if (entries[entries.length - 1] === 'sep') entries.pop()
    const r = el.getBoundingClientRect()
    openMenu(r.left, r.bottom, entries)
  }

  return (
    <header className="titlebar">
      <div className="tb-icon"><Icon name="layers" /></div>
      <nav className="tb-menus">
        {MENUS.map((m) => (
          <button key={m.label} className="tb-menu" onMouseDown={(e) => { e.stopPropagation(); open(m, e.currentTarget) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(m, e.currentTarget) } }}>
            {t(m.label)}
          </button>
        ))}
      </nav>
      <div className="tb-center">
        <button className="command-center" onClick={() => runCommand('quickOpen')} title={t('cmd.quickOpen')}>
          <Icon name="search" />
          <span className="ellipsis">{root ? basename(root) : 'Taskmaster'}</span>
        </button>
      </div>
      <div className="tb-right"><LimitBadges /></div>
    </header>
  )
}
