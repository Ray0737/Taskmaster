import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

export interface Opt { value: string; label: string }

interface Props {
  value: string
  options: Opt[]
  onChange: (value: string) => void
  ariaLabel: string
  disabled?: boolean
  // field: underlined, fills its container (forms). pill: compact, no line (toolbars).
  variant?: 'field' | 'pill'
  icon?: string
  compact?: boolean // no chevron
  iconOnly?: boolean // icon and chevron only; the label is in the tooltip and the list
  className?: string
  style?: CSSProperties
}

interface Pos { left: number; width: number; top?: number; bottom?: number; maxHeight: number }

// Replaces <select>: the native popup cannot follow the theme. Opens above the trigger when there is no room below.
export function Dropdown({ value, options, onChange, ariaLabel, disabled, variant = 'field', icon, compact, iconOnly, className = '', style }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  const close = useCallback((refocus = false) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }, [])

  useLayoutEffect(() => {
    if (!open || !trigger.current) return
    const r = trigger.current.getBoundingClientRect()
    const want = Math.min(options.length * 26 + 8, 280)
    const below = innerHeight - r.bottom - 8
    const above = r.top - 8
    const up = below < want && above > below
    setPos({
      left: Math.min(r.left, Math.max(0, innerWidth - Math.max(r.width, 160) - 8)),
      width: r.width,
      ...(up ? { bottom: innerHeight - r.top } : { top: r.bottom }),
      maxHeight: Math.max(80, Math.min(want, up ? above : below))
    })
  }, [open, options.length])

  useEffect(() => {
    if (!open || !pos) return
    const sel = list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]') ?? list.current?.querySelector<HTMLButtonElement>('button')
    sel?.focus()
  }, [open, pos])

  useEffect(() => {
    if (!open) return
    const outside = (e: MouseEvent) => {
      const n = e.target as Node
      if (!list.current?.contains(n) && !trigger.current?.contains(n)) close()
    }
    const away = () => close()
    window.addEventListener('mousedown', outside)
    window.addEventListener('blur', away)
    window.addEventListener('resize', away)
    window.addEventListener('scroll', away, true)
    return () => {
      window.removeEventListener('mousedown', outside)
      window.removeEventListener('blur', away)
      window.removeEventListener('resize', away)
      window.removeEventListener('scroll', away, true)
    }
  }, [open, close])

  const move = (delta: number) => {
    const items = [...(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    if (!items.length) return
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    items[(i + delta + items.length) % items.length].focus()
  }

  return (
    <>
      <button ref={trigger} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
        title={iconOnly && current ? `${ariaLabel}: ${current.label}` : ariaLabel} disabled={disabled} className={`dd dd-${variant}${iconOnly ? ' dd-icononly' : ''} ${className}`} style={style}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true) } }}>
        {icon && <Icon name={icon} />}
        {!iconOnly && <span className="ellipsis dd-label">{current?.label ?? ''}</span>}
        {!compact && <Icon name="chevron-down" className="dd-chev" />}
      </button>
      {open && createPortal(
        <div ref={list} role="listbox" aria-label={ariaLabel} className="dd-list"
          style={{ left: pos?.left ?? 0, minWidth: iconOnly ? 170 : pos?.width, top: pos?.top, bottom: pos?.bottom, maxHeight: pos?.maxHeight, visibility: pos ? 'visible' : 'hidden' }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); close(true) }
            else if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
            else if (e.key === 'Tab') close()
          }}>
          {options.map((o) => (
            <button key={o.value} type="button" role="option" aria-selected={o.value === value} className="dd-item"
              onClick={() => { close(true); if (o.value !== value) onChange(o.value) }}>
              <span className="dd-check">{o.value === value && <Icon name="check" />}</span>
              <span className="ellipsis">{o.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
