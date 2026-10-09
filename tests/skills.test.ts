import { it, expect } from 'vitest'
import { mkdtempSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { parseSkill, renderSkill, isSkillName } from '../src/shared/skills'
import { listSkills, writeSkill, deleteSkill, pluginDir } from '../src/main/services/teamfs'
import { claudeArgs } from '../src/main/services/agents'

it('skill names are restricted and SKILL.md round-trips', () => {
  expect(['a', 'review-pr', 'x1'].every(isSkillName)).toBe(true)
  expect(['', 'Bad', '../x', '-x', 'a b', 'a'.repeat(41)].some(isSkillName)).toBe(false)
  const text = renderSkill({ name: 'review-pr', description: 'Use when\nreviewing a PR', body: '  Step 1\nStep 2  ' })
  expect(text.startsWith('---\nname: review-pr\ndescription: Use when reviewing a PR\n---')).toBe(true)
  expect(parseSkill('review-pr', text)).toEqual({ name: 'review-pr', description: 'Use when reviewing a PR', body: 'Step 1\nStep 2' })
  expect(parseSkill('review-pr', 'no frontmatter')).toBeNull()
  expect(parseSkill('../x', text)).toBeNull()
})

it('team skills are stored as a Claude Code plugin and removed cleanly', async () => {
  const d = mkdtempSync(join(tmpdir(), 'tm-skills-'))
  expect(await listSkills(d)).toEqual([])
  await writeSkill(d, { name: 'b-skill', description: 'second', body: 'Do B' })
  await writeSkill(d, { name: 'a-skill', description: 'first', body: 'Do A' })
  expect((await listSkills(d)).map((s) => s.name)).toEqual(['a-skill', 'b-skill'])
  expect(JSON.parse(readFileSync(join(pluginDir(d), '.claude-plugin', 'plugin.json'), 'utf8')).name).toBe('team')
  await deleteSkill(d, 'a-skill')
  await deleteSkill(d, 'a-skill') // already gone: fine
  expect((await listSkills(d)).map((s) => s.name)).toEqual(['b-skill'])
  await expect(writeSkill(d, { name: '../x', description: '', body: 'x' })).rejects.toThrow('Invalid skill name')
  await expect(writeSkill(d, { name: 'empty', description: '', body: '  ' })).rejects.toThrow('Empty skill')
  await expect(deleteSkill(d, '../team')).rejects.toThrow('Invalid skill name')
  expect(existsSync(join(pluginDir(d), 'skills', 'empty'))).toBe(false)
})

it('claude gets --plugin-dir only when a team skills folder is given', () => {
  expect(claudeArgs({ system: '', mode: 'plan' })).not.toContain('--plugin-dir')
  const a = claudeArgs({ system: '', mode: 'plan', pluginDir: '/x/plugin' })
  expect(a[a.indexOf('--plugin-dir') + 1]).toBe('/x/plugin')
})

import { parseGithubUrl, skillsInTree, frontmatterDescription } from '../src/shared/skills'

it('parses GitHub URLs and refuses anything else', () => {
  expect(parseGithubUrl('https://github.com/obra/superpowers')).toEqual({ owner: 'obra', repo: 'superpowers', ref: null, path: '' })
  expect(parseGithubUrl('github.com/obra/superpowers.git')).toEqual({ owner: 'obra', repo: 'superpowers', ref: null, path: '' })
  expect(parseGithubUrl('https://github.com/a/b/tree/main/skills/x/')).toEqual({ owner: 'a', repo: 'b', ref: 'main', path: 'skills/x' })
  expect(parseGithubUrl('https://github.com/a/b/blob/dev/skills/x/SKILL.md')).toEqual({ owner: 'a', repo: 'b', ref: 'dev', path: 'skills/x/SKILL.md' })
  for (const bad of ['https://evil.com/a/b', 'https://github.com/a', 'https://github.com/a/b/tree/main/../x', 'https://github.com.evil.com/a/b', 'file:///etc/passwd', 'https://github.com/a/..', '']) expect(parseGithubUrl(bad), bad).toBeNull()
})

it('finds skill folders in a repo tree with their files, ignoring unsafe paths and nested skills', () => {
  const b = (path: string, size = 10) => ({ path, type: 'blob', size })
  const tree = [b('README.md'), b('skills/alpha/SKILL.md'), b('skills/alpha/ref/a.md'), b('skills/alpha/run.py'), b('skills/Beta Thing/SKILL.md'),
    b('.claude/skills/gamma/SKILL.md'), b('node_modules/x/SKILL.md'), b('skills/bad/../evil/SKILL.md'), b('skills/huge/SKILL.md', 600 * 1024), { path: 'skills/dir', type: 'tree' }]
  const r = skillsInTree(tree, '', 'repo')
  expect(r.map((x) => x.name)).toEqual(['alpha', 'beta-thing', 'gamma', 'huge'])
  const a = r.find((x) => x.name === 'alpha')!
  expect(a.files.map((f) => f.path).sort()).toEqual(['SKILL.md', 'ref/a.md', 'run.py'])
  expect(a.scripts).toBe(1)
  expect(r.find((x) => x.name === 'huge')!.tooBig).toBe(true)
  expect(skillsInTree(tree, 'skills/alpha', 'repo').map((x) => x.name)).toEqual(['alpha'])
  expect(skillsInTree(tree, 'skills/alpha/SKILL.md', 'repo').map((x) => x.name)).toEqual(['alpha'])
  expect(skillsInTree([b('SKILL.md'), b('notes.md')], '', 'My Repo').map((x) => [x.name, x.files.length])).toEqual([['my-repo', 2]])
})

it('reads plain, quoted and folded descriptions', () => {
  expect(frontmatterDescription('name: x\ndescription: Use when testing')).toBe('Use when testing')
  expect(frontmatterDescription('description: "Quoted: yes"')).toBe('Quoted: yes')
  expect(frontmatterDescription('name: x\ndescription: >\n  folded line one\n  and two\nlicense: MIT')).toBe('folded line one and two')
})

it('keeps one folder per skill name, preferring a visible, shallow path', () => {
  const b = (path: string) => ({ path, type: 'blob', size: 5 })
  const tree = [b('.openclaw/skills/ponytail/SKILL.md'), b('plugins/p/skills/ponytail/SKILL.md'), b('skills/ponytail/SKILL.md'), b('.claude/skills/ponytail/SKILL.md'), b('skills/other/SKILL.md')]
  const r = skillsInTree(tree, '', 'repo')
  expect(r.map((x) => [x.name, x.dir])).toEqual([['other', 'skills/other'], ['ponytail', 'skills/ponytail']])
})
