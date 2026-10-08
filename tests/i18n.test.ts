import { it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const dir = join('src', 'renderer', 'src', 'i18n')
const files = (lang: string) => readdirSync(dir).filter((f) => new RegExp(`^${lang}(\\.\\w+)?\\.json$`).test(f))
const load = (lang: string): Record<string, string> =>
  Object.assign({}, ...files(lang).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))))

const E = load('en')
const T = load('th')

it('every en file has a th twin and vice versa', () => {
  expect(files('th').map((f) => f.replace(/^th/, 'en')).sort()).toEqual(files('en').sort())
})
it('th has every en key', () => {
  expect(Object.keys(E).filter((k) => !(k in T))).toEqual([])
})
it('th has no extra keys', () => {
  expect(Object.keys(T).filter((k) => !(k in E))).toEqual([])
})
it('no key is defined in two files', () => {
  const seen = new Map<string, string>()
  const dup: string[] = []
  for (const f of files('en')) for (const k of Object.keys(JSON.parse(readFileSync(join(dir, f), 'utf8')))) {
    if (seen.has(k)) dup.push(`${k} (${seen.get(k)} and ${f})`)
    seen.set(k, f)
  }
  expect(dup).toEqual([])
})
it('placeholders match', () => {
  const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
  expect(Object.keys(E).filter((k) => vars(E[k]) !== vars(T[k] ?? ''))).toEqual([])
})
