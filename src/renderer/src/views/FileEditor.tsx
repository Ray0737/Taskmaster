import { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { FileContent } from '@shared/types'
import { basename } from '@shared/paths'
import { call } from '../ipc'
import { useApp } from '../stores/app'
import { useEditor, saveFile, reloadFromDisk } from '../stores/editor'
import { getModel, uriOf, EDITOR_FONT } from '../monaco'
import { useT } from '../i18n'
import { Empty } from '../components/Empty'

const readonlyPaths = new Set<string>()

export function FileEditor({ path }: { path: string }) {
  const t = useT()
  const s = useApp((x) => x.settings!)
  const conflict = useEditor((x) => !!x.conflict[path])
  const deleted = useEditor((x) => !!x.deleted[path])
  const [content, setContent] = useState<FileContent | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    let live = true
    if (getModel(path)) setContent({ kind: 'text', text: '', readonly: readonlyPaths.has(path) })
    else {
      setContent(null)
      call('fs.read', path).then((c) => {
        if (!live) return
        if (c.kind === 'text' && c.readonly) readonlyPaths.add(path)
        setContent(c)
      })
    }
    return () => { live = false }
  }, [path])

  // Monaco can be created while its box still measures ~5x5 and then never re-measures, so the code stays invisible.
  // Lay it out on mount and whenever our wrapper changes size.
  const fill = useRef<HTMLDivElement>(null)
  const ed = useRef<{ layout(): void } | null>(null)
  useEffect(() => {
    const el = fill.current
    if (!el) return
    const ro = new ResizeObserver(() => ed.current?.layout())
    ro.observe(el)
    return () => ro.disconnect()
  }, [content])

  if (!content) return null
  if (content.kind === 'binary') return <Empty text={t('editor.binary')} />
  if (content.kind === 'tooBig') return <Empty text={t('editor.tooBig')} />
  if (content.kind === 'missing') return <Empty text={t('editor.deleted')} />

  const readOnly = content.readonly || deleted
  return (
    <>
      {content.readonly && <div className="editor-bar dim">{t('editor.readonly')}</div>}
      {deleted && <div className="editor-bar danger">{t('editor.deleted')}</div>}
      {conflict && (
        <div className="editor-bar">
          <span className="flex1">{t('editor.changed')}</span>
          <button className="btn" onClick={() => void reloadFromDisk(path)}>{t('editor.reload')}</button>
          <button className="btn" onClick={() => useEditor.setState((x) => { const c = { ...x.conflict }; delete c[path]; return { conflict: c } })}>{t('editor.keepMine')}</button>
          <button className="btn" onClick={() => useEditor.getState().open({ kind: 'diff', diff: 'disk', path, title: t('editor.diffDisk', { name: basename(path) }) })}>{t('editor.compare')}</button>
        </div>
      )}
      <div className="editor-fill" ref={fill}>
        <Editor
          onMount={(editor) => { ed.current = editor; editor.layout(); setTimeout(() => editor.layout(), 60) }}
          path={uriOf(path).toString()}
          defaultValue={content.text}
          theme={`tm-${s.theme}`}
          keepCurrentModel
          onChange={() => {
            useEditor.getState().setDirty(path, true)
            if (s.autoSave === 'delay') {
              clearTimeout(saveTimer.current)
              saveTimer.current = setTimeout(() => void saveFile(path), 1000)
            }
          }}
          options={{
            readOnly,
            fontSize: s.fontSize,
            fontFamily: EDITOR_FONT,
            wordWrap: s.wordWrap ? 'on' : 'off',
            minimap: { enabled: s.minimap },
            tabSize: s.tabSize,
            lineNumbers: s.lineNumbers ? 'on' : 'off',
            stickyScroll: { enabled: true },
            bracketPairColorization: { enabled: true },
            renderLineHighlight: 'all',
            smoothScrolling: false,
            automaticLayout: true,
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true
          }}
        />
      </div>
    </>
  )
}
