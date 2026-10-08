import { it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { mergeSettings, loadSettings, DEFAULT_SETTINGS } from '../src/main/services/settings'

it('fills defaults and rejects bad values', () => {
  const s = mergeSettings({ theme: 'bogus', fontSize: 16, lang: 'th', layout: { sidebar: 30 } })
  expect(s.theme).toBe('mono-dark')
  expect(s.fontSize).toBe(16)
  expect(s.lang).toBe('th')
  expect(s.layout.sidebar).toBe(30)
  expect(s.layout.agent).toBe(DEFAULT_SETTINGS.layout.agent)
})

it('rejects out-of-range numbers', () => {
  expect(mergeSettings({ fontSize: 99 }).fontSize).toBe(14)
  expect(mergeSettings({ fetchInterval: 7 }).fetchInterval).toBe(15)
})

it('corrupt file gives defaults', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'tm-')), 's.json')
  writeFileSync(f, '{nope')
  expect(loadSettings(f)).toEqual(DEFAULT_SETTINGS)
})

it('missing file gives defaults', () => {
  expect(loadSettings(join(tmpdir(), 'tm-does-not-exist.json'))).toEqual(DEFAULT_SETTINGS)
})
