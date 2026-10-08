import { it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { parseChapter } from '../src/main/services/manual'

const root = join('resources', 'manual')
const chapters = (lang: string): string[] => readdirSync(join(root, lang)).filter((f) => /^\d\d-[a-z-]+\.md$/.test(f)).sort()
const read = (lang: string, f: string): string => readFileSync(join(root, lang, f), 'utf8')

const EXPECTED = ['01-getting-started.md', '02-sign-in.md', '03-projects.md', '04-team-and-roles.md', '05-tasks.md', '06-agents.md',
  '07-source-control.md', '08-sync-and-offline.md', '09-themes-and-language.md', '10-shortcuts.md', '11-troubleshooting.md']

it('English and Thai have exactly the planned chapters', () => {
  expect(chapters('en')).toEqual(EXPECTED)
  expect(chapters('th')).toEqual(EXPECTED)
})

it('every chapter starts with a # title and has the same number of ## sections in both languages', () => {
  for (const f of EXPECTED) {
    for (const lang of ['en', 'th']) {
      const txt = read(lang, f)
      expect(txt.startsWith('# '), `${lang}/${f} must start with "# "`).toBe(true)
      expect(parseChapter(f, txt).title.length, `${lang}/${f} title`).toBeGreaterThan(0)
    }
    expect(parseChapter(f, read('th', f)).headings.length, `section count of ${f}`).toBe(parseChapter(f, read('en', f)).headings.length)
  }
})

// Every key combination in the shortcuts chapter must exist in the code, so the manual cannot promise a dead key.
const NOT_REGISTERED_AS_COMMANDS = new Set(['F2', 'Delete', 'Ctrl+Enter', 'Enter', 'Shift+Enter', 'Esc'])
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
}
it('every shortcut in 10-shortcuts.md is registered in the renderer code', () => {
  const src = sourceFiles(join('src', 'renderer', 'src')).map((f) => readFileSync(f, 'utf8')).join('\n')
  const rows = read('en', '10-shortcuts.md').split('\n').filter((l) => /^\|\s*[A-Z]/.test(l) && !/^\|\s*Keys\s*\|/.test(l))
  expect(rows.length).toBeGreaterThan(10)
  for (const row of rows) {
    const keys = row.split('|')[1].trim()
    if (NOT_REGISTERED_AS_COMMANDS.has(keys)) continue
    expect(src.includes(`keys: '${keys}'`), `shortcut "${keys}" is documented but not registered`).toBe(true)
  }
})

it('the Thai shortcuts table lists the same keys in the same order as the English one', () => {
  const keysOf = (lang: string) => read(lang, '10-shortcuts.md').split('\n').filter((l) => /^\|\s*[A-Z]/.test(l) && !/^\|\s*(Keys|ปุ่ม)\s*\|/.test(l)).map((l) => l.split('|')[1].trim())
  expect(keysOf('th')).toEqual(keysOf('en'))
})

// Every **bold** UI label in the manual must exist in the language files, so renaming a button in the app
// fails this test until the manual is updated. Chapter 01 describes regions of the window in prose and is skipped.
const i18n = join('src', 'renderer', 'src', 'i18n')
const dictValues = (lang: string): string[] =>
  readdirSync(i18n)
    .filter((f) => new RegExp(`^${lang}(\\.\\w+)?\\.json$`).test(f))
    .flatMap((f) => Object.values(JSON.parse(readFileSync(join(i18n, f), 'utf8')) as Record<string, string>))
    .map((v) => v.replace(/\{(\w+)\}/g, '$1').replace(/[“”]/g, '"'))
const stripCode = (s: string): string => s.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
const NOT_LABELS = new Set(['+', 'EN / TH', 'Codex CLI, Gemini CLI, Aider, opencode', 'กำลังทำ "งาน"'])
function missingLabels(lang: string): string[] {
  const values = dictValues(lang)
  const missing: string[] = []
  for (const f of EXPECTED.slice(1)) {
    for (const m of stripCode(read(lang, f)).matchAll(/\*\*([^*]+)\*\*/g)) {
      for (const part of m[1].split(' → ').map((x) => x.trim())) {
        if (!NOT_LABELS.has(part) && !values.some((v) => v.includes(part))) missing.push(`${lang}/${f}: "${part}"`)
      }
    }
  }
  return missing
}
it('every bold label in the English manual exists in the English language files', () => {
  expect(missingLabels('en')).toEqual([])
})
it('every bold label in the Thai manual exists in the Thai language files', () => {
  expect(missingLabels('th')).toEqual([])
})
