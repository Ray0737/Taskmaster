import { it, expect } from 'vitest'
import { buildSystemPrompt, extractNote, PROMPT_CAP, type PromptContext } from '../src/shared/prompt'

const base: PromptContext = {
  role: { label: 'Front end', prompt: 'UI, components, styling' },
  task: { title: 'Login page', brief: 'Build the login form.', files: ['src/ui/**', 'src/pages/login.tsx'] },
  others: [{ login: 'bee', role: 'Back end', taskTitle: 'Auth API' }],
  notes: []
}

it('empty context gives an empty prompt', () => {
  expect(buildSystemPrompt({ others: [], notes: [] })).toBe('')
})

it('includes role, task, scope, team and the note instruction', () => {
  const p = buildSystemPrompt(base)
  expect(p).toContain('Your role: Front end — UI, components, styling')
  expect(p).toContain('Your task: Login page')
  expect(p).toContain('Build the login form.')
  expect(p).toContain('src/ui/**, src/pages/login.tsx')
  expect(p).toContain('- @bee (Back end) doing "Auth API"')
  expect(p).toContain('<tm-note>')
})

it('no task: no scope line and no note instruction', () => {
  const p = buildSystemPrompt({ role: base.role, others: [], notes: [] })
  expect(p).toContain('Your role: Front end')
  expect(p).not.toContain('<tm-note>')
  expect(p).not.toContain('Stay inside')
})

it('empty scope means "any"', () => {
  expect(buildSystemPrompt({ ...base, task: { ...base.task!, files: [] } })).toContain('Stay inside these files when possible: any')
})

it('notes: newest first, max 5, each trimmed to 400 chars', () => {
  const notes = Array.from({ length: 7 }, (_, i) => ({ taskTitle: `T${i}`, login: 'bee', text: `note${i} ` + 'x'.repeat(500), at: `2026-10-0${i + 1}T00:00:00Z` }))
  const p = buildSystemPrompt({ ...base, notes })
  const order = [...p.matchAll(/\[T(\d)\]/g)].map((m) => Number(m[1]))
  expect(order).toEqual([6, 5, 4, 3, 2])
  expect(p).toContain('…')
  expect(p.split('\n').find((l) => l.includes('[T6]'))!.length).toBeLessThan(460)
})

it('cap: never longer than 6000 and drops oldest notes first', () => {
  const notes = Array.from({ length: 5 }, (_, i) => ({ taskTitle: `T${i}`, login: 'bee', text: 'y'.repeat(400), at: `2026-10-0${i + 1}T00:00:00Z` }))
  const p = buildSystemPrompt({ ...base, task: { ...base.task!, brief: 'b'.repeat(4300) }, notes })
  expect(p.length).toBeLessThanOrEqual(PROMPT_CAP)
  expect(p).toContain('[T4]')
  expect(p).not.toContain('[T0]')
})

it('cap: a huge brief is truncated, prompt still within cap', () => {
  const p = buildSystemPrompt({ ...base, task: { ...base.task!, brief: 'z'.repeat(50000) } })
  expect(p.length).toBeLessThanOrEqual(PROMPT_CAP)
  expect(p).toContain('<tm-note>')
})

it('extractNote takes the last non-empty tm-note', () => {
  expect(extractNote('done\n<tm-note>\nChanged A.\nTell B.\n</tm-note>')).toBe('Changed A.\nTell B.')
  expect(extractNote('<tm-note>one</tm-note> then <tm-note>two</tm-note>')).toBe('two')
  expect(extractNote('no tag here')).toBeNull()
  expect(extractNote('<tm-note>   </tm-note>')).toBeNull()
})
