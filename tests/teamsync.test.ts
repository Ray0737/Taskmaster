import { it, expect, beforeAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { git, initRepo, stage, commit, setIdentity } from '../src/main/services/git'
import { readAll, writeTask, writePresence, addNote, TM_DIR } from '../src/main/services/teamfs'
import { attach, enable, flush, pull, reset, fetchContext, isNetworkError, isRejected, SyncConflict, BRANCH, worktreeDir } from '../src/main/services/teamsync'
import type { Task } from '../src/shared/team'

beforeAll(async () => {
  process.env.GIT_CONFIG_GLOBAL = join(mkdtempSync(join(tmpdir(), 'tm-gitcfg-')), 'gitconfig')
  process.env.GIT_CONFIG_NOSYSTEM = '1'
  await setIdentity({ name: 'Test', email: 't@example.com' })
})

const T0 = '2026-10-08T12:00:00.000Z'
const task = (id: string, title: string): Task => ({ id, title, brief: '', role: 'custom', assignee: null, status: 'todo', files: [], branch: null, createdBy: 'ray', createdAt: T0, updatedAt: T0 })

// Two teammates: A created the repo, B cloned it. Same bare remote.
async function setup() {
  const base = mkdtempSync(join(tmpdir(), 'tm sync ทดสอบ-'))
  const remote = join(base, 'remote.git')
  mkdirSync(remote)
  await git(remote, ['init', '--bare', '-b', 'main'])
  const a = join(base, 'a')
  mkdirSync(a)
  await initRepo(a)
  writeFileSync(join(a, 'README.md'), '# app\n')
  await stage(a, ['README.md'])
  await commit(a, 'init')
  await git(a, ['remote', 'add', 'origin', remote])
  await git(a, ['push', '-u', 'origin', 'main'])
  const b = join(base, 'b')
  await git(base, ['clone', remote, b])
  const ctxA = { root: a, wt: worktreeDir(join(base, 'ud-a'), a), login: 'ray' }
  const ctxB = { root: b, wt: worktreeDir(join(base, 'ud-b'), b), login: 'bee' }
  return { base, remote, a, b, ctxA, ctxB }
}

it('classifies git errors', () => {
  expect(isNetworkError("fatal: unable to access 'https://x/': Could not resolve host: x")).toBe(true)
  expect(isNetworkError("fatal: '/nope' does not appear to be a git repository\nfatal: Could not read from remote repository.")).toBe(true)
  expect(isNetworkError('error: pathspec did not match')).toBe(false)
  expect(isRejected(' ! [rejected]        taskmaster/context -> taskmaster/context (fetch first)')).toBe(true)
  expect(isRejected("fatal: unable to access 'https://x/'")).toBe(false)
})

it('enable, attach, share, concurrent edit, presence and notes', async () => {
  const { a, b, ctxA, ctxB, remote } = await setup()

  expect(await attach(ctxA)).toEqual({ state: 'disabled', offline: false })
  expect(await fetchContext(a)).toBe('missing')

  const r = await enable(ctxA)
  expect(r).toEqual({ pushed: true, error: null })
  expect((await git(remote, ['branch', '--list', BRANCH])).trim()).toContain(BRANCH)
  expect((await readAll(ctxA.wt))!.team.lead).toBe('ray')
  expect((await readAll(ctxA.wt))!.team.members.map((m) => m.login)).toEqual(['ray']) // the enabling user is lead and member
  // the user's own checkout is untouched
  expect((await git(a, ['branch', '--show-current'])).trim()).toBe('main')
  expect((await git(a, ['status', '--porcelain'])).trim()).toBe('')
  expect(existsSync(join(a, TM_DIR))).toBe(false)

  expect(await attach(ctxB)).toEqual({ state: 'enabled', offline: false })
  expect((await readAll(ctxB.wt))!.team.lead).toBe('ray')
  expect(await attach(ctxA)).toEqual({ state: 'enabled', offline: false }) // re-attach is idempotent

  // A shares a task, B receives it
  await writeTask(ctxA.wt, task('t-aaaaaaaa', 'Original'))
  expect(await flush(ctxA, 'add task')).toEqual({ pushed: true })
  expect(await pull(ctxB)).toBe('changed')
  expect(await pull(ctxB)).toBe('same')
  expect((await readAll(ctxB.wt))!.tasks.map((t) => t.title)).toEqual(['Original'])

  // both edit the same task before syncing: last push wins, both end identical, nothing breaks
  await writeTask(ctxA.wt, task('t-aaaaaaaa', 'A title'))
  await flush(ctxA, 'edit task')
  await writeTask(ctxB.wt, task('t-aaaaaaaa', 'B title'))
  expect(await flush(ctxB, 'edit task')).toEqual({ pushed: true }) // rejected once, pulled, rebased, pushed
  await pull(ctxA)
  expect((await readAll(ctxA.wt))!.tasks[0].title).toBe('B title')
  expect((await readAll(ctxB.wt))!.tasks[0].title).toBe('B title')

  // single-writer files never conflict
  await writePresence(ctxA.wt, { login: 'ray', taskId: null, branch: null, status: 'idle', at: T0 })
  await addNote(ctxA.wt, 't-aaaaaaaa', 'ray', 'from A', '2026-10-08T13:00:00.000Z')
  await writePresence(ctxB.wt, { login: 'bee', taskId: null, branch: null, status: 'working', at: T0 })
  await addNote(ctxB.wt, 't-aaaaaaaa', 'bee', 'from B', '2026-10-08T13:00:01.000Z')
  await flush(ctxA, 'presence')
  await flush(ctxB, 'presence')
  await pull(ctxA)
  for (const wt of [ctxA.wt, ctxB.wt]) {
    const all = (await readAll(wt))!
    expect(all.presence.map((p) => p.login)).toEqual(['bee', 'ray'])
    expect(all.notes.map((n) => n.text)).toEqual(['from B', 'from A'])
  }
}, 120_000)

it('offline: local work is kept and pushed later; a bad remote is classified as a network error', async () => {
  const { b, ctxA, ctxB, remote } = await setup()
  await enable(ctxA)
  await attach(ctxB)

  await git(b, ['remote', 'set-url', 'origin', join(remote, 'does-not-exist')])
  expect(await fetchContext(b)).toBe('offline')
  expect(await pull(ctxB)).toBe('offline')
  await writeTask(ctxB.wt, task('t-bbbbbbbb', 'Made offline'))
  const err = await flush(ctxB, 'offline work').then(() => null, (e: Error) => e)
  expect(err).not.toBeNull()
  expect(isNetworkError(err!.message)).toBe(true)
  expect((await readAll(ctxB.wt))!.tasks.map((t) => t.id)).toEqual(['t-bbbbbbbb']) // still on disk
  expect((await git(ctxB.wt, ['log', '--format=%s', '-1'])).trim()).toBe('tm: bee offline work') // and committed

  await git(b, ['remote', 'set-url', 'origin', remote])
  expect(await flush(ctxB, 'retry')).toEqual({ pushed: true })
  await pull(ctxA)
  expect((await readAll(ctxA.wt))!.tasks.map((t) => t.id)).toEqual(['t-bbbbbbbb'])
}, 120_000)

it('modify/delete conflict: rebase is aborted (nothing half-done), SyncConflict, reset recovers', async () => {
  const { ctxA, ctxB } = await setup()
  await enable(ctxA)
  await writeTask(ctxA.wt, task('t-aaaaaaaa', 'Shared'))
  await flush(ctxA, 'add')
  await attach(ctxB)
  await pull(ctxB)

  // A deletes the task file; B edits it. -X theirs cannot resolve modify/delete.
  await git(ctxA.wt, ['rm', '-q', `${TM_DIR}/tasks/t-aaaaaaaa.json`])
  await flush(ctxA, 'delete')
  await writeTask(ctxB.wt, task('t-aaaaaaaa', 'Edited by B'))
  const err = await flush(ctxB, 'edit').then(() => null, (e: Error) => e)
  expect(err).toBeInstanceOf(SyncConflict)
  const st = await git(ctxB.wt, ['status'])
  expect(st).not.toMatch(/rebase in progress|You are currently rebasing/i)

  await reset(ctxB)
  expect((await readAll(ctxB.wt))!.tasks).toEqual([])
  expect((await git(ctxB.wt, ['status', '--porcelain'])).trim()).toBe('')
}, 120_000)

it('enable gives clear errors without a remote or without a first commit', async () => {
  const base = mkdtempSync(join(tmpdir(), 'tm-enable-'))
  const noRemote = join(base, 'r')
  mkdirSync(noRemote)
  await initRepo(noRemote)
  writeFileSync(join(noRemote, 'a.txt'), 'x')
  await stage(noRemote, ['a.txt'])
  await commit(noRemote, 'init')
  await expect(enable({ root: noRemote, wt: join(base, 'wt1'), login: 'ray' })).rejects.toThrow('no remote')

  const noCommit = join(base, 'c')
  mkdirSync(noCommit)
  await initRepo(noCommit)
  await git(noCommit, ['remote', 'add', 'origin', join(base, 'x.git')])
  await expect(enable({ root: noCommit, wt: join(base, 'wt2'), login: 'ray' })).rejects.toThrow('first commit')
  expect(existsSync(join(base, 'wt2'))).toBe(false)
})
