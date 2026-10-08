import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { create } from 'zustand'
import type { Lang, ManualChapter } from '@shared/types'
import { call } from '../ipc'
import { useApp } from '../stores/app'
import { useEditor } from '../stores/editor'
import { useT } from '../i18n'
import { registerCommand } from '../commands'
import { Empty } from '../components/Empty'
import { Icon } from '../components/Icon'
import { activityBottom } from './registry'
import { tabRenderers } from './EditorArea'

const useManual = create<{ chapter: string | null }>(() => ({ chapter: null }))

// e.g. openManual('05-tasks.md') from a "?" icon next to a view header.
export function openManual(chapter?: string): void {
  if (chapter) useManual.setState({ chapter })
  useEditor.getState().open({ kind: 'manual', title: 'tab.manual' })
}

export function ManualTab() {
  const t = useT()
  const appLang = useApp((s) => s.settings!.lang)
  const [lang, setLang] = useState<Lang>(appLang)
  const [chapters, setChapters] = useState<ManualChapter[]>([])
  const [filter, setFilter] = useState('')
  const [md, setMd] = useState('')
  const chapter = useManual((s) => s.chapter)

  useEffect(() => setLang(appLang), [appLang])
  useEffect(() => {
    call('manual.list', lang).then((c) => {
      setChapters(c)
      if (!useManual.getState().chapter || !c.some((x) => x.file === useManual.getState().chapter)) useManual.setState({ chapter: c[0]?.file ?? null })
    }).catch(() => setChapters([]))
  }, [lang])
  useEffect(() => { if (chapter) call('manual.read', lang, chapter).then(setMd).catch(() => setMd('')) }, [chapter, lang])

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return f ? chapters.filter((c) => [c.title, ...c.headings].some((h) => h.toLowerCase().includes(f))) : chapters
  }, [chapters, filter])

  return (
    <div className="split-view">
      <nav className="split-nav" aria-label={t('tab.manual')}>
        <div className="nav-label">{t('tab.manual')}</div>
        <div className="nav-filter">
          <input className="input" placeholder={t('manual.filter')} value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <div className="scroll" style={{ flex: 1 }}>
          {shown.length
            ? shown.map((c) => (
              <button key={c.file} className={`row${c.file === chapter ? ' sel' : ''}`} title={c.title} onClick={() => useManual.setState({ chapter: c.file })}>
                <span className="ellipsis">{c.title}</span>
              </button>
            ))
            : <Empty text={t('manual.empty')} />}
        </div>
      </nav>
      <div className="split-body scroll" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 8, right: 16, display: 'flex' }}>
          {(['en', 'th'] as const).map((l) => (
            <button key={l} className={`btn${l === lang ? ' btn-primary' : ''}`} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
          ))}
        </div>
        <div className="doc">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            a: ({ href, children }) => (
              <a href={href} onClick={(e) => { e.preventDefault(); if (href && /^https?:/.test(href)) void call('shell.openExternal', href) }}>{children}</a>
            )
          }}>{md}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

function ManualButton() {
  const t = useT()
  return <button className="ab-item" title={t('cmd.manual')} aria-label={t('cmd.manual')} onClick={() => openManual()}><Icon name="book" /></button>
}

activityBottom.push(ManualButton)
tabRenderers.manual = ManualTab
registerCommand({ id: 'manual.open', title: 'cmd.manual', keys: 'F1', run: () => openManual() })
