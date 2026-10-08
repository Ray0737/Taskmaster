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
