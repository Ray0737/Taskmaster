import { useApp } from '../stores/app'
import { useT } from '../i18n'
import { runCommand } from '../commands'
import { THEMES } from '../theme/themes'
import { Icon } from '../components/Icon'
import { statusLeft, statusRight } from './registry'

export function StatusBar() {
  const t = useT()
  const s = useApp((x) => x.settings!)
  return (
    <footer className="statusbar">
      <div className="sb-left">{statusLeft.map((C, i) => <C key={i} />)}</div>
      <div className="sb-right">
        {statusRight.map((C, i) => <C key={i} />)}
        <button className="sb-item" title={t('cmd.langToggle')} onClick={() => runCommand('lang.toggle')}>{s.lang.toUpperCase()}</button>
        <button className="sb-item" title={t('cmd.themePick')} onClick={() => runCommand('theme.pick')}>
          <Icon name="color-mode" />{THEMES[s.theme].label}
        </button>
      </div>
    </footer>
  )
}
