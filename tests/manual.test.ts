import { it, expect } from 'vitest'
import { parseChapter, safeChapterFile } from '../src/main/services/manual'

it('parses title and h2 headings', () => {
  const c = parseChapter('01-getting-started.md', '# Getting started\n\nText\n\n## First run\n\n### deep\n\n## Next')
  expect(c).toEqual({ file: '01-getting-started.md', title: 'Getting started', headings: ['First run', 'Next'] })
})
it('falls back to file name when no h1', () => {
  expect(parseChapter('02-x.md', 'no heading').title).toBe('02-x')
})
it('rejects path tricks in chapter names', () => {
  expect(safeChapterFile('01-a.md')).toBe(true)
  expect(safeChapterFile('../secret.md')).toBe(false)
  expect(safeChapterFile('a\\b.md')).toBe(false)
  expect(safeChapterFile('a.txt')).toBe(false)
})
