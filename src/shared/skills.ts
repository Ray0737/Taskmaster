// Team skills are Claude Code skills (SKILL.md with a small frontmatter) shared through the team branch.
// `source` is set for skills imported from GitHub: they keep their whole folder (scripts, references) and are read-only in the editor.
export interface Skill { name: string; description: string; body: string; source?: string }

export const SKILL_NAME = /^[a-z0-9][a-z0-9-]{0,39}$/
export const SKILL_BODY_MAX = 20000
export const SKILL_DESC_MAX = 300
export const isSkillName = (s: unknown): s is string => typeof s === 'string' && SKILL_NAME.test(s)

const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim()

// The description from a frontmatter block: a plain value, a quoted value, or a folded block (`>` or `|` with indented lines).
export function frontmatterDescription(fm: string): string {
  const lines = fm.split(/\r?\n/)
  const i = lines.findIndex((l) => /^description:/.test(l))
  if (i < 0) return ''
  let v = lines[i].replace(/^description:[ \t]*/, '')
  if (/^[>|][+-]?$/.test(v.trim())) {
    const block: string[] = []
    for (let j = i + 1; j < lines.length && /^[ \t]+\S/.test(lines[j]); j++) block.push(lines[j].trim())
    v = block.join(' ')
  }
  v = v.trim()
  if (v.length > 1 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) v = v.slice(1, -1)
  return oneLine(v).slice(0, SKILL_DESC_MAX)
}

export function renderSkill(s: Skill): string {
  return `---\nname: ${s.name}\ndescription: ${oneLine(s.description).slice(0, SKILL_DESC_MAX)}\n---\n\n${s.body.trim().slice(0, SKILL_BODY_MAX)}\n`
}

// A teammate wrote the file, so anything unexpected is skipped (null).
export function parseSkill(name: string, text: string): Skill | null {
  if (!isSkillName(name)) return null
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text)
  if (!m) return null
  return { name, description: frontmatterDescription(m[1]), body: m[2].trim().slice(0, SKILL_BODY_MAX) }
}

// ---------- import from GitHub ----------

export interface GhRef { owner: string; repo: string; ref: string | null; path: string }

const GH_NAME = /^[A-Za-z0-9._-]{1,100}$/
const SAFE_SEG = /^[A-Za-z0-9_.][A-Za-z0-9._ -]{0,99}$/
// Relative path from a repo or a skill folder: no empty, "." or ".." segments, no odd characters.
export const isSafeRelPath = (p: string): boolean => p.length > 0 && p.length <= 300 && p.split('/').every((s) => SAFE_SEG.test(s) && s !== '.' && s !== '..')

// https://github.com/owner/repo[.git][/tree|blob/<ref>/<path>] (also without the scheme). The ref is the first segment after tree/blob.
export function parseGithubUrl(input: string): GhRef | null {
  const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s?#]+)\/([^/\s?#]+)(?:\/(?:tree|blob)\/([^/\s?#]+)(?:\/([^\s?#]*))?)?\/?(?:[?#].*)?$/.exec(input.trim())
  if (!m) return null
  const owner = m[1], repo = m[2].replace(/\.git$/, '')
  const ref = m[3] ?? null
  const path = (m[4] ?? '').replace(/\/+$/, '')
  if (!GH_NAME.test(owner) || !GH_NAME.test(repo) || repo === '.' || repo === '..') return null
  if (ref !== null && !/^[\w.-]{1,100}$/.test(ref)) return null
  if (path && !isSafeRelPath(path)) return null
  return { owner, repo, ref, path }
}

export interface TreeItem { path: string; type: string; size?: number }
export interface FoundSkill { name: string; dir: string; skillMd: string; files: { path: string; size: number }[]; scripts: number; tooBig: boolean }

export const IMPORT_MAX_FILES = 60
export const IMPORT_MAX_FILE = 500 * 1024
export const IMPORT_MAX_TOTAL = 1500 * 1024
const SCRIPT_EXT = /\.(py|sh|bash|zsh|js|mjs|cjs|ts|ps1|bat|cmd|rb|pl|exe|dll)$/i
const SKIP_DIR = /^(\.git|\.github|node_modules)\//

export const skillNameFrom = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

// Skills in a repo tree: every folder holding a SKILL.md, below `prefix` (a folder or a SKILL.md path). The folder name is the skill name;
// a SKILL.md at the repo root takes the repo name. Files are everything under the folder, except nested skills.
export function skillsInTree(tree: TreeItem[], prefix: string, repoName: string): FoundSkill[] {
  const blobs = tree.filter((t) => t.type === 'blob' && isSafeRelPath(t.path) && !SKIP_DIR.test(t.path))
  const base = /(^|\/)SKILL\.md$/i.test(prefix) ? prefix.replace(/\/?SKILL\.md$/i, '') : prefix
  const under = (p: string): boolean => !base || p === base || p.startsWith(base + '/')
  const mds = blobs.filter((b) => /(^|\/)SKILL\.md$/.test(b.path) && under(b.path))
  const dirs = mds.map((b) => b.path.replace(/\/?SKILL\.md$/, ''))
  const out: FoundSkill[] = []
  for (const dir of dirs) {
    const name = skillNameFrom(dir ? dir.split('/').pop()! : repoName)
    if (!isSkillName(name)) continue
    const nested = dirs.filter((d) => d !== dir && (dir === '' || d.startsWith(dir + '/')))
    const files = blobs
      .filter((b) => (dir === '' ? true : b.path.startsWith(dir + '/')) && !nested.some((n) => b.path.startsWith(n + '/')))
      .map((b) => ({ path: dir ? b.path.slice(dir.length + 1) : b.path, size: b.size ?? 0 }))
    const total = files.reduce((n, f) => n + f.size, 0)
    out.push({
      name, dir, skillMd: dir ? `${dir}/SKILL.md` : 'SKILL.md', files,
      scripts: files.filter((f) => SCRIPT_EXT.test(f.path)).length,
      tooBig: files.length > IMPORT_MAX_FILES || total > IMPORT_MAX_TOTAL || files.some((f) => f.size > IMPORT_MAX_FILE)
    })
  }
  // Repos often ship the same skill in several places (skills/x, .claude/skills/x, plugin copies). Keep one per name:
  // a visible folder before a hidden one, then the shallowest, then the shortest path.
  const key = (x: FoundSkill): number[] => [x.dir.split('/').some((p) => p.startsWith('.')) ? 1 : 0, x.dir.split('/').length, x.dir.length]
  const before = (x: number[], y: number[]): boolean => { for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false }
  const best = new Map<string, FoundSkill>()
  for (const x of out) { const cur = best.get(x.name); if (!cur || before(key(x), key(cur))) best.set(x.name, x) }
  return [...best.values()].sort((a, b) => a.name.localeCompare(b.name))
}
