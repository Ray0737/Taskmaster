export interface KeyLike { code: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }

const NAMES: Record<string, string> = {
  Backquote: '`', Comma: ',', Period: '.', Slash: '/', Tab: 'Tab', Escape: 'Escape', Enter: 'Enter'
}

// Uses KeyboardEvent.code (physical key) so shortcuts work on any keyboard layout, e.g. Thai Kedmanee.
export function keyFromEvent(e: KeyLike): string | null {
  let k: string | undefined
  if (/^Key[A-Z]$/.test(e.code)) k = e.code.slice(3)
  else if (/^Digit\d$/.test(e.code)) k = e.code.slice(5)
  else if (/^F\d{1,2}$/.test(e.code)) k = e.code
  else k = NAMES[e.code]
  if (!k) return null
  const ctrl = e.ctrlKey || e.metaKey
  if (!ctrl && !e.altKey && !/^F\d/.test(k)) return null
  return [ctrl && 'Ctrl', e.shiftKey && 'Shift', e.altKey && 'Alt', k].filter(Boolean).join('+')
}
