import { memo, useState, type ReactElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toRel } from '@shared/scope'
import { basename } from '@shared/paths'
import { call } from '../ipc'
import { useApp } from '../stores/app'
import { useEditor, openFile } from '../stores/editor'
import { useAgent } from '../stores/agent'
import { newTerminal } from '../stores/terminal'
import type { Item } from '../stores/agentReduce'
import { tr, useT } from '../i18n'
import { Icon } from '../components/Icon'

const textOf = (n: ReactNode): string =>
  typeof n === 'string' ? n
    : Array.isArray(n) ? n.map(textOf).join('')
      : n && typeof n === 'object' && 'props' in n ? textOf((n as ReactElement<{ children?: ReactNode }>).props.children) : ''

function CodeBlock({ children }: { children?: ReactNode }) {
  const t = useT()
  const [done, setDone] = useState(false)
  return (
    <pre>
      <button className="icon-btn code-copy" title={done ? t('agent.copied') : t('agent.copy')} aria-label={t('agent.copy')}
        onClick={() => { void navigator.clipboard.writeText(textOf(children)); setDone(true); setTimeout(() => setDone(false), 1200) }}>
        <Icon name={done ? 'check' : 'copy'} />
      </button>
      {children}
    </pre>
  )
}

const ICONS: Record<string, string> = {
  Read: 'eye', Edit: 'edit', MultiEdit: 'edit', Write: 'new-file', NotebookEdit: 'notebook', Bash: 'terminal', PowerShell: 'terminal',
  Grep: 'search', Glob: 'search', WebFetch: 'globe', WebSearch: 'globe', Task: 'organization', TodoWrite: 'checklist'
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

// What a tool call acts on: text to show, and an absolute file path if it is a file.
function toolTarget(name: string, input: Record<string, unknown>, root: string): { text: string; path?: string } {
  switch (name) {
    case 'Read': case 'Edit': case 'MultiEdit': case 'Write': {
      const p = str(input.file_path)
      return { text: toRel(p, root), path: p || undefined }
    }
    case 'NotebookEdit': {
      const p = str(input.notebook_path)
      return { text: toRel(p, root), path: p || undefined }
    }
    case 'Bash': case 'PowerShell': return { text: str(input.command) }
    case 'Grep': case 'Glob': return { text: str(input.pattern) }
    case 'WebFetch': return { text: str(input.url) }
    case 'WebSearch': return { text: str(input.query) }
    case 'Task': return { text: str(input.description) }
    default: return { text: Object.values(input).find((v) => typeof v === 'string') as string ?? '' }
  }
}

// Reads open the file; edits and writes open the HEAD diff. Paths outside the project are not opened.
function openTarget(name: string, abs: string, root: string): void {
  if (/^[A-Za-z]:|^\//.test(toRel(abs, root))) return
  if (name === 'Read') openFile(abs, { preview: true })
  else useEditor.getState().open({ kind: 'diff', diff: 'head', path: abs, title: tr('scm.diffTitle', { name: basename(abs) }) }, true)
}

const ToolRow = memo(function ToolRow({ item }: { item: Extract<Item, { kind: 'tool' }> }) {
  const t = useT()
  const root = useApp((s) => s.root) ?? ''
  const [open, setOpen] = useState(false)
  const { text, path } = toolTarget(item.name, item.input, root)
  const r = item.result
  return (
    <div>
      <div className="tool-row" role="button" tabIndex={0} aria-expanded={open} onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open) } }}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} />
        <Icon name={ICONS[item.name] ?? 'tools'} />
        <span>{item.name}</span>
        {path
          ? <button className="chip ellipsis" title={path} onClick={(e) => { e.stopPropagation(); openTarget(item.name, path, root) }}>{text}</button>
          : <span className="ellipsis tool-target" title={text}>{text}</span>}
        <span className="flex1" />
        <Icon name={r ? (r.isError ? 'error' : 'check') : 'circle-large-outline'} className={r?.isError ? 'danger' : ''} />
      </div>
      {open && (
        <div className="tool-detail mono">
          <div className="label">{t('agent.toolInput')}</div>
          {JSON.stringify(item.input, null, 2)}
          <div className="label" style={{ marginTop: 6 }}>{t('agent.toolResult')}</div>
          <span className={r?.isError ? 'danger' : ''}>{r ? r.text || t('agent.noResult') : t('agent.toolPending')}</span>
        </div>
      )}
    </div>
  )
})

function Notice({ item }: { item: Extract<Item, { kind: 'notice' }> }) {
  const t = useT()
  const running = useAgent((s) => s.runId !== null)
  const tone = item.level === 'error' ? 'danger' : item.level === 'warn' ? 'warn' : 'dim'
  return (
    <div className="notice" role={item.level === 'error' ? 'alert' : 'status'}>
      <Icon name={item.level === 'error' ? 'error' : item.level === 'warn' ? 'warning' : 'info'} className={tone} />
      <div className="notice-body">
        {item.key && <div className={tone === 'dim' ? '' : tone}>{t(item.key, item.vars)}</div>}
        {item.raw && <div className="notice-raw mono dim">{item.raw}</div>}
        {item.action === 'login' && <button className="btn" onClick={() => void newTerminal('claude')}>{t('agent.login')}</button>}
        {item.action === 'retry' && <button className="btn" disabled={running} onClick={() => void useAgent.getState().retry()}>{t('agent.retry')}</button>}
      </div>
    </div>
  )
}

export const Message = memo(function Message({ item }: { item: Item }) {
  switch (item.kind) {
    case 'user': return <div className="msg-user"><Icon name="account" /><span>{item.text}</span></div>
    case 'assistant':
      return (
        <div className="msg-md">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
            a: ({ href, children }) => (
              <a href={href} onClick={(e) => { e.preventDefault(); if (href && /^https?:/.test(href)) void call('shell.openExternal', href) }}>{children}</a>
            )
          }}>{item.text}</ReactMarkdown>
        </div>
      )
    case 'tool': return <ToolRow item={item} />
    case 'notice': return <Notice item={item} />
  }
})
