import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { basename } from '@shared/paths'
import { call, on } from '../ipc'
import { getModel } from '../monaco'
import { useEditor, type Tab } from '../stores/editor'
import { registerCommand } from '../commands'
import { toast } from '../stores/ui'
import { tr } from '../i18n'
import { tabRenderers } from './EditorArea'

export const isMarkdown = (path: string): boolean => /\.(md|markdown)$/i.test(path)

export const openPreview = (path: string): void =>
  useEditor.getState().open({ kind: 'mdpreview', path, title: tr('preview.title', { name: basename(path) }) })

// Read-only rendered view of a Markdown file. It follows unsaved edits in the open editor, otherwise the file on disk.
// react-markdown does not render raw HTML, and only http(s) links are opened (in the browser).
export function MdPreview({ tab }: { tab: Tab }) {
  const path = tab.path!
  const [text, setText] = useState('')
  useEffect(() => {
    const load = async () => {
      const m = getModel(path)
      if (m) { setText(m.getValue()); return }
      const c = await call('fs.read', path)
      setText(c.kind === 'text' ? c.text : '')
    }
    void load()
    const m = getModel(path)
    const sub = m?.onDidChangeContent(() => setText(m.getValue()))
    const off = on('fs.changed', (e) => { if (e.path === path) void load() })
    return () => { off(); sub?.dispose() }
  }, [path])
  return (
    <div className="split-body scroll" style={{ height: '100%', background: 'var(--bg-0)' }}>
      <div className="doc selectable">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
          a: ({ href, children }) => (
            <a href={href} onClick={(e) => { e.preventDefault(); if (href && /^https?:/.test(href)) void call('shell.openExternal', href) }}>{children}</a>
          )
        }}>{text}</ReactMarkdown>
      </div>
    </div>
  )
}

tabRenderers.mdpreview = MdPreview

registerCommand({
  id: 'md.preview', title: 'cmd.mdPreview',
  run: () => {
    const { tabs, active } = useEditor.getState()
    const t = tabs.find((x) => x.id === active)
    if (t?.kind === 'file' && t.path && isMarkdown(t.path)) openPreview(t.path)
    else toast(tr('preview.notMd'))
  }
})
