import type { Lang } from '@shared/types'
import { useApp } from '../stores/app'

type Dict = Record<string, string>
const merge = (mods: Record<string, { default: Dict }>): Dict => Object.assign({}, ...Object.values(mods).map((m) => m.default))

// en.json + en.*.json, th.json + th.*.json. Add a feature's strings as a new file pair.
const dicts: Record<Lang, Dict> = {
  en: merge(import.meta.glob('./en*.json', { eager: true })),
  th: merge(import.meta.glob('./th*.json', { eager: true }))
}
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
