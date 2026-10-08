import { useT } from '../i18n'
import { Empty } from '../components/Empty'

export function EditorArea() {
  const t = useT()
  return <div className="editor-area"><Empty text={t('editor.noFolder')} /></div>
}
