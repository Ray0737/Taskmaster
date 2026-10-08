import { it, expect } from 'vitest'
import { parseGithubRemote, prUrl } from '../src/shared/github'
import { parseGithubRemote as fromAuth } from '../src/main/services/auth'

it('auth re-exports the shared parser', () => {
  expect(fromAuth).toBe(parseGithubRemote)
})
it('prUrl builds the "open a pull request" page for a branch', () => {
  expect(prUrl('https://github.com/ray/app.git', 'tm/ray/t-aaaaaaaa')).toBe('https://github.com/ray/app/pull/new/tm/ray/t-aaaaaaaa')
  expect(prUrl('git@github.com:ray/app.git', 'feature x')).toBe('https://github.com/ray/app/pull/new/feature%20x')
  expect(prUrl('https://gitlab.com/ray/app.git', 'b')).toBeNull()
})

it('parses GitHub remotes in every common form', () => {
  const want = { owner: 'ray', repo: 'app' }
  for (const u of ['https://github.com/ray/app.git', 'https://github.com/ray/app', 'git@github.com:ray/app.git', 'https://user@github.com/ray/app.git/', 'ssh://git@github.com/ray/app.git', 'HTTPS://GITHUB.COM/ray/app.git']) {
    expect(parseGithubRemote(u), u).toEqual(want)
  }
  expect(parseGithubRemote('https://github.com/ray/my.repo-1.git')).toEqual({ owner: 'ray', repo: 'my.repo-1' })
})
it('returns null for anything else', () => {
  for (const u of ['https://gitlab.com/ray/app.git', 'C:\\repos\\app', '/srv/git/app.git', '', 'https://github.com/ray']) {
    expect(parseGithubRemote(u), u).toBeNull()
  }
})
