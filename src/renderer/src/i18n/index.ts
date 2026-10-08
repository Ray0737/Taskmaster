import type { Lang } from '@shared/types'
import en from './en.json'
import th from './th.json'
import { useApp } from '../stores/app'

const dicts: Record<Lang, Record<string, string>> = { en, th }
type Vars = Record<string, string | number>

export function translate(lang: Lang, key: string, vars?: Vars): string {
  let s = dicts[lang][key] ?? dicts.en[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, () => String(v))
  return s
}

export const currentLang = (): Lang => useApp.getState().settings?.lang ?? 'en'
// For non-React code (stores, commands).
export const tr = (key: string, vars?: Vars): string => translate(currentLang(), key, vars)

export function useT(): (key: string, vars?: Vars) => string {
  const lang = useApp((s) => s.settings?.lang ?? 'en')
  return (key, vars) => translate(lang, key, vars)
}
