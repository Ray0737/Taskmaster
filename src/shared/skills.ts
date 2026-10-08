// Team skills are Claude Code skills (SKILL.md with a small frontmatter) shared through the team branch.
export interface Skill { name: string; description: string; body: string }

export const SKILL_NAME = /^[a-z0-9][a-z0-9-]{0,39}$/
export const SKILL_BODY_MAX = 20000
export const SKILL_DESC_MAX = 300
export const isSkillName = (s: unknown): s is string => typeof s === 'string' && SKILL_NAME.test(s)

const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim()

export function renderSkill(s: Skill): string {
  return `---\nname: ${s.name}\ndescription: ${oneLine(s.description).slice(0, SKILL_DESC_MAX)}\n---\n\n${s.body.trim().slice(0, SKILL_BODY_MAX)}\n`
}

// A teammate wrote the file, so anything unexpected is skipped (null).
export function parseSkill(name: string, text: string): Skill | null {
  if (!isSkillName(name)) return null
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text)
  if (!m) return null
  const d = /^description:[ \t]*(.*)$/m.exec(m[1])
  return { name, description: oneLine(d?.[1] ?? '').slice(0, SKILL_DESC_MAX), body: m[2].trim().slice(0, SKILL_BODY_MAX) }
}
