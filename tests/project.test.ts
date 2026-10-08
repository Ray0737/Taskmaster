import { it, expect, beforeAll } from 'vitest'
import { mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { git, setIdentity } from '../src/main/services/git'
import { nameError, createProject } from '../src/main/services/project'
import { pushRecent } from '../src/main/services/recent'

beforeAll(async () => {
  process.env.GIT_CONFIG_GLOBAL = join(mkdtempSync(join(tmpdir(), 'tm-gitcfg-')), 'gitconfig')
  process.env.GIT_CONFIG_NOSYSTEM = '1'
  await setIdentity({ name: 'T', email: 't@example.com' })
})

it('nameError rejects unsafe names', () => {
  expect(nameError('my app')).toBeNull()
  expect(nameError('ตัวอย่าง (1)')).toBeNull()
  for (const bad of ['', '  ', 'a/b', 'a\\b', '..', '.', 'x.', 'x ', 'CON', 'nul.txt', 'a:b', 'a*b', 'a'.repeat(101)]) {
    expect(nameError(bad), JSON.stringify(bad)).not.toBeNull()
  }
})

it('createProject makes a repo with one commit', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'tm-proj-'))
  const dir = await createProject(parent, 'My App')
  expect(dir).toBe(join(parent, 'My App'))
  expect((await git(dir, ['log', '--format=%s'])).trim()).toBe('Initial commit')
  await expect(createProject(parent, 'My App')).rejects.toThrow('already exists')
  await expect(createProject(parent, '../evil')).rejects.toThrow()
})

it('pushRecent dedupes, moves to front, caps at 20', () => {
  let l = pushRecent([], 'C:\\a', '1')
  l = pushRecent(l, 'C:\\b', '2')
  l = pushRecent(l, 'C:\\a', '3')
  expect(l.map((r) => r.path)).toEqual(['C:\\a', 'C:\\b'])
  expect(l[0].name).toBe('a')
  for (let i = 0; i < 30; i++) l = pushRecent(l, `C:\\p${i}`, String(i))
  expect(l).toHaveLength(20)
})
