import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { openManual } from './ManualTab'

// "?" that opens the User Manual at a chapter, e.g. <HelpIcon chapter="05-tasks.md" />.
export function HelpIcon({ chapter }: { chapter: string }) {
  const t = useT()
  return (
    <button className="icon-btn" title={t('cmd.manual')} aria-label={t('cmd.manual')} onClick={() => openManual(chapter)}>
      <Icon name="question" />
    </button>
  )
}
