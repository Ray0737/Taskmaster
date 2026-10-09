import { useEffect, useRef, useState } from 'react'
import type { SearchResult } from '@shared/search'
import { basename, dirname, relPath } from '@shared/paths'
import { call, errMsg } from '../ipc'
import { useApp } from '../stores/app'
import { openAt, openFile } from '../stores/editor'
import { registerCommand } from '../commands'
import { showPanel } from '../layout'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Empty'
import { sidebarViews } from './registry'

// Find in files. Searches as you type (after a short pause); a click on a hit opens the file with the match selected.
export function Search() {
  const t = useT()
  const root = useApp((s) => s.root)
  const [text, setText] = useState('')
  const [cs, setCs] = useState(false)
  const [rx, setRx] = useState(false)
  const [ww, setWw] = useState(false)
  const [res, setRes] = useState<SearchResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const seq = useRef(0)

  const run = async () => {
    const mine = ++seq.current
    if (!text.trim() || !root) { setRes(null); setErr(''); setBusy(false); return }
    setBusy(true); setErr('')
    try {
      const r = await call('search.run', { text, caseSensitive: cs, regex: rx, wholeWord: ww })
      if (mine === seq.current) { setRes(r.error ? null : r); setErr(r.error ?? '') }
    } catch (e) { if (mine === seq.current) { setRes(null); setErr(errMsg(e)) } }
    finally { if (mine === seq.current) setBusy(false) }
  }
  useEffect(() => { const x = setTimeout(() => void run(), 350); return () => clearTimeout(x) }, [text, cs, rx, ww, root])

  if (!root) return <Empty text={t('search.needProject')} />
  const toggle = (label: string, icon: string, on: boolean, set: (v: boolean) => void) => (
    <button className={`icon-btn${on ? ' on' : ''}`} title={label} aria-label={label} aria-pressed={on} onClick={() => set(!on)}><Icon name={icon} /></button>
  )
  return (
    <div className="search-view">
      <div className="search-box">
        <input className="input search-input" autoFocus value={text} spellCheck={false} placeholder={t('search.placeholder')} aria-label={t('search.placeholder')}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void run() }} />
        {toggle(t('search.case'), 'case-sensitive', cs, setCs)}
        {toggle(t('search.word'), 'whole-word', ww, setWw)}
        {toggle(t('search.regex'), 'regex', rx, setRx)}
      </div>
      {err && <div className="danger small search-msg" role="alert">{t('search.invalid', { error: err })}</div>}
      {busy && !res && <div className="dim small search-msg">{t('search.searching')}</div>}
      {res && res.files.length === 0 && !err && <Empty text={t('search.none')} />}
      {res && res.files.length > 0 && (
        <div className="dim small search-msg">{t('search.summary', { n: res.hits, f: res.files.length })}{res.truncated ? ' ' + t('search.truncated') : ''}</div>
      )}
      {res?.files.map((f) => (
        <div key={f.path}>
          <button className="row search-file" title={f.path} onClick={() => openFile(f.path)}>
            <Icon name="file" />
            <span className="ellipsis">{basename(f.path)}</span>
            <span className="dim small ellipsis flex1">{relPath(root, dirname(f.path))}</span>
            <span className="badge">{f.hits.length}</span>
          </button>
          {f.hits.map((h) => (
            <button key={`${h.line}:${h.col}`} className="row search-hit" title={`${h.line}:${h.col}`} onClick={() => openAt(f.path, h.line, h.col, h.len)}>
              <span className="dim small search-ln">{h.line}</span>
              <span className="ellipsis mono">{h.text.slice(0, h.at)}<mark>{h.text.slice(h.at, h.at + h.len)}</mark>{h.text.slice(h.at + h.len)}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

sidebarViews.push({ id: 'search', title: 'view.search', icon: 'search', Comp: Search })

registerCommand({
  id: 'search.find', title: 'cmd.search', keys: 'Ctrl+Shift+F',
  run: () => { useApp.getState().setView('search'); showPanel('side'); setTimeout(() => document.querySelector<HTMLInputElement>('.search-input')?.focus(), 60) }
})
