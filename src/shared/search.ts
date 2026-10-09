// Find in files: the query, its matcher and the per-file scan. Pure, so both sides and the tests share it.
export interface SearchQuery { text: string; caseSensitive: boolean; regex: boolean; wholeWord: boolean }
// line and col are 1-based positions in the file. text is the line, trimmed to a window; at is where the match starts inside text.
export interface SearchHit { line: number; col: number; len: number; text: string; at: number }
export interface SearchFile { path: string; hits: SearchHit[] }
export interface SearchResult { files: SearchFile[]; hits: number; truncated: boolean; error?: string }

export const SEARCH_MAX_HITS = 2000
export const SEARCH_MAX_FILE_HITS = 200
const LINE_MAX = 400 // a longer line (minified code) is skipped, which also bounds the cost of a bad regex

// A global RegExp for the query, or an error message.
export function buildMatcher(q: SearchQuery): RegExp | string {
  if (!q.text) return 'Empty search'
  let src = q.regex ? q.text : q.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (q.wholeWord) src = `\\b(?:${src})\\b`
  try {
    const re = new RegExp(src, q.caseSensitive ? 'g' : 'gi')
    if (re.test('')) return 'The pattern matches an empty string'
    re.lastIndex = 0
    return re
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid regular expression'
  }
}

// Hits in one file's text. At most `limit` hits; lines longer than LINE_MAX are skipped.
export function scanText(text: string, re: RegExp, limit = SEARCH_MAX_FILE_HITS): SearchHit[] {
  const out: SearchHit[] = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length && out.length < limit; i++) {
    const line = lines[i]
    if (line.length > LINE_MAX) continue
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(line)) && out.length < limit) {
      if (m[0].length === 0) { re.lastIndex++; continue }
      const lead = Math.max(0, m.index - 30) // keep the match visible in a narrow sidebar
      out.push({ line: i + 1, col: m.index + 1, len: m[0].length, text: (lead > 0 ? '…' : '') + line.slice(lead, lead + 160).trimEnd(), at: m.index - lead + (lead > 0 ? 1 : 0) })
    }
  }
  return out
}
