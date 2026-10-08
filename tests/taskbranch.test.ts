import { it, expect, beforeAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { git, initRepo, stage, commit, status, setIdentity, branches, defaultBranch, startTaskBranch, stashAll, commitEverything } from '../src/main/services/git'

beforeAll(async () => {
  process.env.GIT_CONFIG_GLOBAL = join(mkdtempSync(join(tmpdir(), 'tm-gitcfg-')), 'gitconfig')
  process.env.GIT_CONFIG_NOSYSTEM = '1'
  await setIdentity({ name: 'T', email: 't@example.com' })
})

async function repo() {
  const d = mkdtempSync(join(tmpdir(), 'tm task ทดสอบ-'))
  await initRepo(d)
  writeFileSync(join(d, 'f.txt'), 'one\n')
  await stage(d, ['f.txt'])
  await commit(d, 'init')
  return d
}

it('defaultBranch falls back to local main', async () => {
  expect(await defaultBranch(await repo())).toBe('main')
})

it('defaultBranch follows origin/HEAD when set', async () => {
  const base = mkdtempSync(join(tmpdir(), 'tm-db-'))
  const bare = join(base, 'r.git')
  mkdirSync(bare)
  await git(bare, ['init', '--bare', '-b', 'trunk'])
  const a = join(base, 'a')
  mkdirSync(a)
  await git(a, ['init', '-b', 'trunk'])
  writeFileSync(join(a, 'x'), '1')
  await stage(a, ['x'])
  await commit(a, 'init')
  await git(a, ['remote', 'add', 'origin', bare])
  await git(a, ['push', '-u', 'origin', 'trunk'])
  const b = join(base, 'b')
  await git(base, ['clone', bare, b])
  expect(await defaultBranch(b)).toBe('trunk')
})

it('startTaskBranch branches off the default branch without tracking it', async () => {
  const d = await repo()
  await startTaskBranch(d, 'tm/ray/t-aaaaaaaa')
  expect((await branches(d)).current).toBe('tm/ray/t-aaaaaaaa')
  expect((await status(d)).upstream).toBeNull() // must not track main, or Sync would pull/push main
  await git(d, ['switch', 'main'])
  await startTaskBranch(d, 'tm/ray/t-aaaaaaaa') // existing branch: just switch
  expect((await branches(d)).current).toBe('tm/ray/t-aaaaaaaa')
  await expect(startTaskBranch(d, 'bad name..x')).rejects.toThrow()
})

it('a task branch starts from main even when another branch is checked out', async () => {
  const d = await repo()
  await git(d, ['switch', '-c', 'other'])
  writeFileSync(join(d, 'g.txt'), 'only on other\n')
  await stage(d, ['g.txt'])
  await commit(d, 'other work')
  await startTaskBranch(d, 'tm/ray/t-bbbbbbbb')
  expect(await git(d, ['ls-files'])).not.toContain('g.txt')
})

it('stashAll saves tracked and untracked changes and leaves a clean tree', async () => {
  const d = await repo()
  writeFileSync(join(d, 'f.txt'), 'changed\n')
  writeFileSync(join(d, 'new.txt'), 'untracked\n')
  await stashAll(d, 'before task')
  expect((await status(d)).files).toEqual([])
  expect((await git(d, ['stash', 'list'])).trim().split('\n')).toHaveLength(1)
  await git(d, ['stash', 'pop'])
  expect(readFileSync(join(d, 'f.txt'), 'utf8')).toBe('changed\n')
  expect(readFileSync(join(d, 'new.txt'), 'utf8')).toBe('untracked\n')
})

it('stashAll with nothing to stash is a no-op', async () => {
  const d = await repo()
  await stashAll(d, 'x')
  expect((await git(d, ['stash', 'list'])).trim()).toBe('')
})

it('commitEverything commits tracked and untracked changes', async () => {
  const d = await repo()
  writeFileSync(join(d, 'f.txt'), 'changed\n')
  writeFileSync(join(d, 'new.txt'), 'untracked\n')
  await commitEverything(d, 'WIP before starting task')
  expect((await status(d)).files).toEqual([])
  expect((await git(d, ['log', '-1', '--format=%s'])).trim()).toBe('WIP before starting task')
  await commitEverything(d, 'nothing to do') // clean tree: no error, no empty commit
  expect((await git(d, ['log', '-1', '--format=%s'])).trim()).toBe('WIP before starting task')
})

it('switching to an existing branch with conflicting local changes is refused and loses nothing', async () => {
  const d = await repo()
  await git(d, ['switch', '-c', 'tm/ray/t-cccccccc'])
  writeFileSync(join(d, 'f.txt'), 'task version\n')
  await stage(d, ['f.txt'])
  await commit(d, 'task work')
  await git(d, ['switch', 'main'])
  writeFileSync(join(d, 'f.txt'), 'my uncommitted edit\n')
  await expect(startTaskBranch(d, 'tm/ray/t-cccccccc')).rejects.toThrow()
  expect(readFileSync(join(d, 'f.txt'), 'utf8')).toBe('my uncommitted edit\n')
})
