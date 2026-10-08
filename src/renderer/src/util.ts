// Collects partial patches and calls fn once with the merged patch after `ms` of quiet.
export function mergeDebounce<T extends object>(fn: (v: T) => void, ms: number): (p: T) => void {
  let acc = {} as T
  let timer: ReturnType<typeof setTimeout> | undefined
  return (p) => {
    acc = { ...acc, ...p }
    clearTimeout(timer)
    timer = setTimeout(() => { const v = acc; acc = {} as T; fn(v) }, ms)
  }
}

// "2 hours ago" / "yesterday" in the app language.
export function ago(iso: string, lang: string): string {
  const s = (Date.parse(iso) - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  for (const [unit, n] of [['day', 86400], ['hour', 3600], ['minute', 60]] as const) {
    if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), unit)
  }
  return rtf.format(Math.round(s), 'second')
}
