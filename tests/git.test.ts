import { it, expect, beforeAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  git, parseStatus, gitVersion, getIdentity, setIdentity, isRepoRoot, initRepo, status, stage, unstage,
  discardTracked, commit, branches, switchBranch, showHead, remoteUrl, syncRepo, cloneRepo
} from '../src/main/services/git'

// Isolate from the developer's real git config.
beforeAll(() => {
  process.env.GIT_CONFIG_GLOBAL = join(mkdtempSync(join(tmpdir(), 'tm-gitcfg-')), 'gitconfig')
  process.env.GIT_CONFIG_NOSYSTEM = '1'
})

const tmp = () => mkdtempSync(join(tmpdir(), 'tm git ทดสอบ-'))
const ident = { name: 'Test User', email: 'test@example.com' }

it('parseStatus reads branch line and entries', () => {
  const s = parseStatus('## main...origin/main [ahead 2, behind 1]\0 M a b.txt\0A  new.ts\0R  to.ts\0from.ts\0?? ก.txt\0')
  expect(s.branch).toBe('main')
  expect(s.upstream).toBe('origin/main')
  expect(s.ahead).toBe(2)
  expect(s.behind).toBe(1)
  expect(s.files).toEqual([
    { path: 'a b.txt', index: ' ', work: 'M' },
    { path: 'new.ts', index: 'A', work: ' ' },
    { path: 'to.ts', index: 'R', work: ' ' },
    { path: 'ก.txt', index: '?', work: '?' }
  ])
})

it('parseStatus handles odd branch lines', () => {
  expect(parseStatus('## No commits yet on main\0').branch).toBe('main')
  expect(parseStatus('## HEAD (no branch)\0').branch).toBeNull()
  expect(parseStatus('## feature/x\0').upstream).toBeNull()
  expect(parseStatus('## main...origin/main [gone]\0').ahead).toBe(0)
})

it('git is installed', async () => {
  expect(await gitVersion()).toMatch(/^\d+\.\d+/)
})

it('identity round trip', async () => {
  expect(await getIdentity()).toEqual({ name: '', email: '' })
  await setIdentity(ident)
  expect(await getIdentity()).toEqual(ident)
})

it('fresh repo: init, status, stage, unstage, commit (odd names, odd messages)', async () => {
  const dir = tmp()
  expect(await isRepoRoot(dir)).toBe(false)
  await initRepo(dir)
  expect(await isRepoRoot(dir)).toBe(true)

  // zero commits: nothing may throw
  expect((await status(dir)).branch).toBe('main')
  expect(await branches(dir)).toEqual({ current: 'main', all: [] })
  expect(await showHead(dir, 'a b.txt')).toBeNull()

  for (const f of ['a b.txt', 'ก.txt', "q'uote.txt"]) writeFileSync(join(dir, f), 'hi\n')
  let s = await status(dir)
  expect(s.files.map((f) => f.path).sort()).toEqual(['a b.txt', "q'uote.txt", 'ก.txt'].sort())
  expect(s.files.every((f) => f.index === '?')).toBe(true)

  await stage(dir, ['a b.txt', 'ก.txt'])
  s = await status(dir)
  expect(s.files.find((f) => f.path === 'a b.txt')!.index).toBe('A')
  await unstage(dir, ['ก.txt']) // works with zero commits
  expect((await status(dir)).files.find((f) => f.path === 'ก.txt')!.index).toBe('?')

  const msg = '-dash first line\n\nsecond "paragraph" with $HOME and `ticks`'
  await commit(dir, msg)
  expect((await git(dir, ['log', '-1', '--format=%B'])).trim()).toBe(msg)
  expect(await showHead(dir, 'a b.txt')).toBe('hi\n')
  await expect(commit(dir, '   ')).rejects.toThrow('message')
})

it('discardTracked restores a modified file', async () => {
  const dir = tmp()
  await initRepo(dir)
  writeFileSync(join(dir, 'f.txt'), 'one')
  await stage(dir, ['f.txt'])
  await commit(dir, 'init')
  writeFileSync(join(dir, 'f.txt'), 'two')
  await discardTracked(dir, ['f.txt'])
  expect(readFileSync(join(dir, 'f.txt'), 'utf8')).toBe('one')
})

it('branches: create, switch, reject bad names', async () => {
  const dir = tmp()
  await initRepo(dir)
  writeFileSync(join(dir, 'f.txt'), 'x')
  await stage(dir, ['f.txt'])
  await commit(dir, 'init')
  await switchBranch(dir, 'tm/ray/t-ab12', true)
  expect(await branches(dir)).toEqual({ current: 'tm/ray/t-ab12', all: ['main', 'tm/ray/t-ab12'] })
  await switchBranch(dir, 'main', false)
  expect((await branches(dir)).current).toBe('main')
  await expect(switchBranch(dir, 'bad name..x', true)).rejects.toThrow()
})

it('sync: first push sets upstream, then pull --rebase + push; clone works', async () => {
  const base = tmp()
  const bare = join(base, 'remote.git')
  mkdirSync(bare)
  await git(bare, ['init', '--bare', '-b', 'main'])

  const a = join(base, 'a')
  mkdirSync(a)
  await initRepo(a)
  await git(a, ['remote', 'add', 'origin', bare])
  expect(await remoteUrl(a)).toBe(bare)
  writeFileSync(join(a, 'one.txt'), '1')
  await stage(a, ['one.txt'])
  await commit(a, 'one')
  await syncRepo(a) // no upstream yet -> push -u
  expect((await status(a)).upstream).toBe('origin/main')

  const percents: number[] = []
  const b = await cloneRepo(bare, base, 'b', (p) => percents.push(p))
  expect(b).toBe(join(base, 'b'))
  writeFileSync(join(b, 'two.txt'), '2')
  await stage(b, ['two.txt'])
  await commit(b, 'two')
  await syncRepo(b)

  writeFileSync(join(a, 'three.txt'), '3')
  await stage(a, ['three.txt'])
  await commit(a, 'three')
  await syncRepo(a) // behind 1, ahead 1 -> rebase then push
  const log = (await git(a, ['log', '--format=%s'])).trim().split('\n')
  expect(log).toEqual(['three', 'two', 'one'])
})
