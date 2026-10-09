import { it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { buildMatcher, scanText } from '../src/shared/search'
import { searchProject } from '../src/main/services/search'

const q = (text: string, extra = {}) => ({ text, caseSensitive: false, regex: false, wholeWord: false, ...extra })

it('builds a matcher: literal, case, whole word, regex, and clear errors', () => {
  const lit = buildMatcher(q('a.b(c)')) as RegExp
  expect(lit.test('xx a.b(c) yy')).toBe(true)
  lit.lastIndex = 0
  expect(lit.test('axb(c)')).toBe(false) // the dot is literal
  expect((buildMatcher(q('Foo', { caseSensitive: true })) as RegExp).test('foo')).toBe(false)
  expect((buildMatcher(q('Foo')) as RegExp).test('foo')).toBe(true)
  const w = buildMatcher(q('cat', { wholeWord: true })) as RegExp
  expect(w.test('concat')).toBe(false)
  w.lastIndex = 0
  expect(w.test('a cat sat')).toBe(true)
  expect((buildMatcher(q('a+b', { regex: true })) as RegExp).test('aaab')).toBe(true)
  expect(typeof buildMatcher(q('(', { regex: true }))).toBe('string')
  expect(buildMatcher(q('', {}))).toBe('Empty search')
  expect(buildMatcher(q('a*', { regex: true }))).toBe('The pattern matches an empty string')
})

it('scans text for hits with line, column and a visible window', () => {
  const re = buildMatcher(q('needle')) as RegExp
  const text = 'first\n  a needle here\r\nnone\nNEEDLE and needle\n' + 'x'.repeat(500) + ' needle'
  const hits = scanText(text, re)
  expect(hits.map((h) => [h.line, h.col])).toEqual([[2, 5], [4, 1], [4, 12]]) // the 500-character line is skipped
  expect(hits[0].text.slice(hits[0].at, hits[0].at + hits[0].len)).toBe('needle')
  const far = scanText(' '.repeat(80) + 'needle tail', re)[0]
  expect(far.text.startsWith('…')).toBe(true)
  expect(far.text.slice(far.at, far.at + far.len)).toBe('needle')
  expect(far.col).toBe(81)
  expect(scanText('needle\n'.repeat(10), re, 3)).toHaveLength(3)
})

it('searches a project: skips dependency folders, binaries and big files', async () => {
  const d = mkdtempSync(join(tmpdir(), 'tm-search-'))
  mkdirSync(join(d, 'src'))
  mkdirSync(join(d, 'node_modules'))
  mkdirSync(join(d, '.git'))
  writeFileSync(join(d, 'src', 'a.ts'), 'const token = 1\nconst TOKEN2 = 2\n')
  writeFileSync(join(d, 'b.md'), 'a token here\n')
  writeFileSync(join(d, 'node_modules', 'x.js'), 'token')
  writeFileSync(join(d, '.git', 'config'), 'token')
  writeFileSync(join(d, 'bin.dat'), Buffer.concat([Buffer.from('token'), Buffer.from([0, 1, 2])]))
  writeFileSync(join(d, 'big.txt'), 'token '.repeat(400_000))
  const r = await searchProject(d, q('token'))
  expect(r.files.map((f) => f.path.slice(d.length + 1).replace(/\\/g, '/'))).toEqual(['b.md', 'src/a.ts'])
  expect(r.hits).toBe(3)
  expect(r.truncated).toBe(false)
  expect((await searchProject(d, q('(', { regex: true }))).error).toBeTruthy()
})
