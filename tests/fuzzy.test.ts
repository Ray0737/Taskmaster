import { it, expect } from 'vitest'
import { fuzzy } from '../src/shared/fuzzy'

it('matches subsequences case-insensitively', () => {
  expect(fuzzy('apx', 'src/App.tsx')?.hits).toEqual([4, 5, 10])
  expect(fuzzy('zz', 'src/App.tsx')).toBeNull()
})
it('empty query matches everything', () => {
  expect(fuzzy('', 'anything')).toEqual({ score: 0, hits: [] })
})
it('prefers consecutive and word-start matches', () => {
  const a = fuzzy('app', 'src/App.tsx')!.score
  const b = fuzzy('app', 'src/a-p-p.ts')!.score
  expect(a).toBeGreaterThan(b)
})
it('prefers shorter paths on ties', () => {
  expect(fuzzy('a', 'a.ts')!.score).toBeGreaterThan(fuzzy('a', 'a/very/long/path.ts')!.score)
})
