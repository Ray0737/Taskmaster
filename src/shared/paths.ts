// Pure path helpers that work in the renderer (no Node 'path' there).
export const sepOf = (p: string): string => (p.includes('\\') ? '\\' : '/')
const trimEnd = (p: string): string => p.replace(/[\\/]+$/, '')

export const basename = (p: string): string => trimEnd(p).split(/[\\/]/).pop() ?? p

export function dirname(p: string): string {
  const s = trimEnd(p)
  const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'))
  return i <= 0 ? s : s.slice(0, i)
}

export const joinPath = (base: string, rel: string): string =>
  trimEnd(base) + sepOf(base) + rel.split(/[\\/]/).filter(Boolean).join(sepOf(base))

// Relative path with forward slashes, e.g. "src/App.tsx".
export const relPath = (root: string, p: string): string =>
  p.slice(trimEnd(root).length).replace(/^[\\/]+/, '').replace(/\\/g, '/')

export function extOf(p: string): string {
  const b = basename(p)
  const i = b.lastIndexOf('.')
  return i > 0 ? b.slice(i + 1).toLowerCase() : ''
}
