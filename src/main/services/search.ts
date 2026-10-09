import { promises as fsp } from 'fs'
import { join } from 'path'
import { handle } from '../ipc'
import { state } from '../state'
import { buildMatcher, scanText, SEARCH_MAX_HITS, type SearchFile, type SearchQuery, type SearchResult } from '@shared/search'

// Find in files for the open project. Skips build and dependency folders, symlinks, binary and big files.
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'out', 'build', 'release', '.next', 'coverage', '__pycache__', '.venv', 'venv', 'target', '.cache', '.turbo'])
const MAX_FILE_BYTES = 1024 * 1024
const MAX_FILES = 400
const MAX_MS = 10_000

export async function searchProject(root: string, q: SearchQuery): Promise<SearchResult> {
  const re = buildMatcher(q)
  if (typeof re === 'string') return { files: [], hits: 0, truncated: false, error: re }
  const files: SearchFile[] = []
  let hits = 0, truncated = false
  const t0 = Date.now()
  const stack = [root]
  while (stack.length && !truncated) {
    const dir = stack.pop()!
    let entries
    try { entries = await fsp.readdir(dir, { withFileTypes: true }) } catch { continue }
    entries.sort((a, b) => b.name.localeCompare(a.name)) // popped from the end, so files come out in name order
    for (const e of entries) {
      if (e.isSymbolicLink()) continue
      const p = join(dir, e.name)
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) stack.push(p); continue }
      if (!e.isFile()) continue
      if (Date.now() - t0 > MAX_MS || hits >= SEARCH_MAX_HITS || files.length >= MAX_FILES) { truncated = true; break }
      try {
        if ((await fsp.stat(p)).size > MAX_FILE_BYTES) continue
        const buf = await fsp.readFile(p)
        if (buf.subarray(0, 8000).includes(0)) continue // binary
        const found = scanText(buf.toString('utf8'), re, Math.min(200, SEARCH_MAX_HITS - hits))
        if (found.length) { files.push({ path: p, hits: found }); hits += found.length }
      } catch { /* unreadable: skip */ }
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path))
  return { files, hits, truncated }
}

export function registerSearch(): void {
  handle('search.run', async (q: SearchQuery) => {
    if (!state.root) throw new Error('No project open')
    return searchProject(state.root, q)
  })
}
