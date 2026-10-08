import picomatch from 'picomatch'

const WRITE_TOOLS: Record<string, string> = { Edit: 'file_path', MultiEdit: 'file_path', Write: 'file_path', NotebookEdit: 'notebook_path' }
const fwd = (p: string): string => p.replace(/\\/g, '/')

// Path relative to the project root with forward slashes, or the normalized absolute path if it is outside the root.
export function toRel(path: string, root: string): string {
  const p = fwd(path)
  const r = fwd(root).replace(/\/+$/, '')
  return p.toLowerCase().startsWith(r.toLowerCase() + '/') ? p.slice(r.length + 1) : p
}

// Path a tool call writes to (see toRel), or null for tools that do not write files.
export function writtenPath(tool: { name: string; input: Record<string, unknown> }, root: string): string | null {
  const key = WRITE_TOOLS[tool.name]
  const raw = key ? tool.input[key] : undefined
  return typeof raw === 'string' && raw ? toRel(raw, root) : null
}

// Empty scope = no restriction.
export function outsideScope(globs: string[], rel: string): boolean {
  if (!globs.length) return false
  return !picomatch(globs, { dot: true })(fwd(rel))
}
