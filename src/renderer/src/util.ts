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
