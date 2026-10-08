import { useEffect, useState } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { call } from '../ipc'
import { useApp } from '../stores/app'
import type { Tab } from '../stores/editor'
import { getModel, languageOf, EDITOR_FONT } from '../monaco'

// Plan 2 adds the 'head' case (git HEAD vs working copy).
export async function loadDiff(tab: Tab): Promise<{ original: string; modified: string }> {
  const path = tab.path!
  const disk = await call('fs.read', path)
  const diskText = disk.kind === 'text' ? disk.text : ''
  return { original: diskText, modified: getModel(path)?.getValue() ?? diskText }
}

export function DiffTab({ tab }: { tab: Tab }) {
  const s = useApp((x) => x.settings!)
  const [d, setD] = useState<{ original: string; modified: string } | null>(null)
  useEffect(() => { let live = true; loadDiff(tab).then((v) => live && setD(v)); return () => { live = false } }, [tab.id])
  if (!d) return null
  return (
    <div className="editor-fill">
      <DiffEditor original={d.original} modified={d.modified} language={languageOf(tab.path!)} theme={`tm-${s.theme}`}
        options={{ readOnly: true, fontSize: s.fontSize, fontFamily: EDITOR_FONT, automaticLayout: true, renderSideBySide: true,
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false } }} />
    </div>
  )
}
