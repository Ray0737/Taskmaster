import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useUi, closeToast } from '../stores/ui'
import { useT } from '../i18n'
import { Icon } from './Icon'

export function Toasts() {
  const toasts = useUi((s) => s.toasts)
  const t = useT()
  return (
    <div className="toasts">
      {toasts.map((x) => (
        <div key={x.id} className={`toast ${x.kind}`} role={x.kind === 'error' ? 'alert' : 'status'}>
          <Icon name={x.kind === 'error' ? 'error' : 'info'} />
          <div className="toast-text">{x.text}</div>
          {x.action && <button className="btn" onClick={() => { closeToast(x.id); x.action!.run() }}>{x.action.label}</button>}
          <button className="icon-btn" aria-label={t('common.close')} title={t('common.close')} onClick={() => closeToast(x.id)}>
            <Icon name="close" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function DialogHost() {
  const d = useUi((s) => s.dialog)
  const t = useT()
  const [val, setVal] = useState('')
  useEffect(() => { if (d?.kind === 'prompt') setVal(d.value) }, [d])
  if (!d) return null
  // true/false for confirm and prompt, the chosen value for choice, null/false = cancelled
  const finish = (result: boolean | string | null) => {
    useUi.setState({ dialog: null })
    if (d.kind === 'confirm') d.resolve(result === true)
    else if (d.kind === 'choice') d.resolve(typeof result === 'string' ? result : null)
    else d.resolve(result === true && val.trim() ? val.trim() : null)
  }
  return (
    <div className="modal-back" onMouseDown={() => finish(null)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={d.title}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') finish(null)
          if (e.key === 'Enter' && d.kind !== 'choice') { e.preventDefault(); finish(true) }
        }}>
        <div className="modal-title">{d.title}</div>
        {d.kind === 'prompt'
          ? <input autoFocus className="input" value={val} onChange={(e) => setVal(e.target.value)} />
          : <div className="modal-text">{d.text}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={() => finish(null)}>{t('common.cancel')}</button>
          {d.kind === 'choice'
            ? d.options.map((o, i) => (
              <button key={o.value} autoFocus={i === d.options.length - 1} className={`btn${i === d.options.length - 1 ? ' btn-primary' : ''}`}
                onClick={() => finish(o.value)}>{o.label}</button>
            ))
            : (
              <button autoFocus={d.kind === 'confirm'} className={`btn ${d.kind === 'confirm' && d.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => finish(true)}>
                {d.kind === 'confirm' ? (d.confirmLabel ?? t('common.confirm')) : t('common.ok')}
              </button>
            )}
        </div>
      </div>
    </div>
  )
}

export function MenuHost() {
  const menu = useUi((s) => s.menu)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  useLayoutEffect(() => {
    if (!menu || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ x: Math.max(0, Math.min(menu.x, innerWidth - r.width)), y: Math.max(0, Math.min(menu.y, innerHeight - r.height)) })
    ref.current.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const close = () => useUi.setState({ menu: null })
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
        const i = btns.indexOf(document.activeElement as HTMLButtonElement)
        const n = btns.length
        if (n) btns[(i + (e.key === 'ArrowDown' ? 1 : n - 1) + n) % n].focus()
      }
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', key)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', key)
      window.removeEventListener('blur', close)
    }
  }, [menu])

  if (!menu) return null
  return (
    <div ref={ref} className="menu" role="menu" style={{ left: pos.x, top: pos.y }} onMouseDown={(e) => e.stopPropagation()}>
      {menu.items.map((it, i) => it === 'sep'
        ? <div key={i} className="menu-sep" />
        : (
          <button key={i} role="menuitem" className={`menu-item${it.danger ? ' danger' : ''}`} disabled={it.disabled}
            onClick={() => { useUi.setState({ menu: null }); it.run() }}>
            <span className="ellipsis">{it.label}</span>
            {it.keys && <span className="dim">{it.keys}</span>}
          </button>
        ))}
    </div>
  )
}
