// ponytail: greedy subsequence scoring, fine up to ~50k entries. Upgrade path: worker + fzf-style DP scorer.
export function fuzzy(query: string, text: string): { score: number; hits: number[] } | null {
  const q = query.toLowerCase()
  if (!q) return { score: 0, hits: [] }
  const t = text.toLowerCase()
  const hits: number[] = []
  let from = 0
  let score = 0
  for (const ch of q) {
    if (ch === ' ') continue
    const i = t.indexOf(ch, from)
    if (i < 0) return null
    score += hits.length && i === hits[hits.length - 1] + 1 ? 5 : 1
    if (i === 0 || '/\\._- '.includes(t[i - 1])) score += 3
    hits.push(i)
    from = i + 1
  }
  return { score: score - t.length * 0.01, hits }
}
