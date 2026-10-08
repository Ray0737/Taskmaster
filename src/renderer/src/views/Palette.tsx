import { useEffect, useMemo, useRef, useState } from 'react'
import { fuzzy } from '@shared/fuzzy'
import { joinPath } from '@shared/paths'
import { call } from '../ipc'
import { useApp } from '../stores/app'
import { useUi } from '../stores/ui'
import { openFile } from '../stores/editor'
import { allCommands, runCommand } from '../commands'
import { useT } from '../i18n'

interface Item { key: string; label: string; detail?: string; hits: number[]; score: number; run: () => void }

function Highlight({ text, hits }: { text: string; hits: number[] }) {
  if (!hits.length) return <>{text}</>
  const set = new Set(hits)
  return <>{[...text].map((c, i) => (set.has(i) ? <span key={i} className="hl">{c}</span> : c))}</>
}

function PaletteInner({ initial }: { initial: string }) {
  const t = useT()
  const root = useApp((s) => s.root)
  const [q, setQ] = useState(initial)
  const [sel, setSel] = useState(0)
  const [files, setFiles] = useState<string[] | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const cmdMode = q.startsWith('>')
  const close = () => useUi.setState({ palette: null })

  useEffect(() => {
    if (!cmdMode && root && files === null) call('fs.listAll').then(setFiles).catch(() => setFiles([]))
  }, [cmdMode, root, files])

  const items = useMemo<Item[]>(() => {
    const out: Item[] = []
    if (cmdMode) {
      const qq = q.slice(1).trim()
      for (const c of allCommands()) {
        const label = t(c.title)
        const m = fuzzy(qq, label) ?? (fuzzy(qq, c.id) && { score: 0, hits: [] })
        if (m) out.push({ key: c.id, label, detail: c.keys, hits: m.hits, score: m.score, run: () => runCommand(c.id) })
      }
    } else if (root && files) {
      for (const f of files) {
        const m = fuzzy(q.trim(), f)
        if (m) out.push({ key: f, label: f, hits: m.hits, score: m.score, run: () => openFile(joinPath(root, f)) })
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 200)
  }, [q, cmdMode, files, root, t])

  useEffect(() => { (listRef.current?.children[sel] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' }) }, [sel])

  const pick = (it: Item | undefined) => { if (!it) return; close(); it.run() }
  const empty = !cmdMode && !root ? t('palette.noFolder') : t('palette.noResults')

  return (
    <div className="palette-back" onMouseDown={close}>
      <div className="palette" role="dialog" aria-label={t('cmd.palette')} onMouseDown={(e) => e.stopPropagation()}>
        <input autoFocus className="input palette-input" value={q} placeholder={t(cmdMode ? 'palette.commands' : 'palette.files')}
          role="combobox" aria-expanded="true" aria-controls="palette-list"
          onChange={(e) => { setQ(e.target.value); setSel(0) }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
            else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => (items.length ? (s + 1) % items.length : 0)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => (items.length ? (s - 1 + items.length) % items.length : 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); pick(items[sel]) }
          }} />
        <div id="palette-list" role="listbox" ref={listRef} className="palette-list scroll">
          {items.length
            ? items.map((it, i) => (
              <div key={it.key} role="option" aria-selected={i === sel} className={`row palette-row${i === sel ? ' sel' : ''}`}
                onMouseMove={() => setSel(i)} onClick={() => pick(it)} title={it.label}>
                <span className="ellipsis"><Highlight text={it.label} hits={it.hits} /></span>
                {it.detail && <span className="dim palette-detail">{it.detail}</span>}
              </div>
            ))
            : <div className="empty-row dim">{empty}</div>}
        </div>
      </div>
    </div>
  )
}

export function Palette() {
  const text = useUi((s) => s.palette)
  if (text === null) return null
  return <PaletteInner initial={text} />
}
