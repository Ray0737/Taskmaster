import { it, expect } from 'vitest'
import { parseCredential, tryExec, toRepoInfo, sanitizeRepoName } from '../src/main/services/auth'

it('parseCredential finds the password line (CRLF safe)', () => {
  expect(parseCredential('protocol=https\r\nhost=github.com\r\nusername=ray\r\npassword=gho_abc123\r\n')).toBe('gho_abc123')
  expect(parseCredential('password=tok\n')).toBe('tok')
})
it('parseCredential returns null for empty or missing', () => {
  expect(parseCredential('')).toBeNull()
  expect(parseCredential('username=ray\nhost=github.com\n')).toBeNull()
  expect(parseCredential('password=\n')).toBeNull()
})
it('tryExec never throws for a missing program', async () => {
  expect(await tryExec('definitely-not-a-real-program-xyz', ['--version'])).toBeNull()
})
it('tryExec returns stdout on success', async () => {
  expect((await tryExec('git', ['--version']))?.startsWith('git version')).toBe(true)
})
it('toRepoInfo maps the GitHub payload', () => {
  expect(toRepoInfo({ full_name: 'ray/app', owner: { login: 'ray' }, name: 'app', private: true, updated_at: '2026-10-08T00:00:00Z', clone_url: 'https://github.com/ray/app.git', extra: 1 } as Parameters<typeof toRepoInfo>[0]))
    .toEqual({ fullName: 'ray/app', owner: 'ray', name: 'app', private: true, updatedAt: '2026-10-08T00:00:00Z', cloneUrl: 'https://github.com/ray/app.git' })
})
it('sanitizeRepoName keeps GitHub-safe characters', () => {
  expect(sanitizeRepoName('My Cool App')).toBe('My-Cool-App')
  expect(sanitizeRepoName('  ทดสอบ  ')).toBe('project')
  expect(sanitizeRepoName('a_b.c-d')).toBe('a_b.c-d')
})
