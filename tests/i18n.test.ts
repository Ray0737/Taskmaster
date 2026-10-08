import { it, expect } from 'vitest'
import en from '../src/renderer/src/i18n/en.json'
import th from '../src/renderer/src/i18n/th.json'

const E = en as Record<string, string>
const T = th as Record<string, string>

it('th has every en key', () => {
  expect(Object.keys(E).filter(k => !(k in T))).toEqual([])
})

it('th has no extra keys', () => {
  expect(Object.keys(T).filter(k => !(k in E))).toEqual([])
})

it('placeholders match', () => {
  const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
  expect(Object.keys(E).filter(k => vars(E[k]) !== vars(T[k] ?? ''))).toEqual([])
})
