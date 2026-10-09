import { parseGithubUrl, skillsInTree, frontmatterDescription, IMPORT_MAX_FILE, type FoundSkill, type TreeItem } from '@shared/skills'

// Reads skills from a public GitHub repo. Only api.github.com and raw.githubusercontent.com are contacted, and every path comes from
// the repo tree after validation (see skillsInTree), so a repo cannot make us write outside a skill folder.
const API = 'https://api.github.com'
const RAW = 'https://raw.githubusercontent.com'

async function get(url: string, accept: string): Promise<Response> {
  const r = await fetch(url, { headers: { 'User-Agent': 'Taskmaster', Accept: accept }, signal: AbortSignal.timeout(20000) })
  if (r.status === 404) throw new Error('Not found on GitHub. Private repo, wrong URL or wrong branch?')
  if (r.status === 403 || r.status === 429) throw new Error('GitHub rate limit reached. Try again in a few minutes.')
  if (!r.ok) throw new Error(`GitHub answered ${r.status}`)
  return r
}

const enc = (p: string): string => p.split('/').map(encodeURIComponent).join('/')

interface Loaded { owner: string; repo: string; ref: string; found: FoundSkill[]; truncated: boolean }

async function load(url: string): Promise<Loaded> {
  const gh = parseGithubUrl(url)
  if (!gh) throw new Error('Not a GitHub repo URL. Example: https://github.com/owner/repo')
  let ref = gh.ref
  if (!ref) {
    const info = (await (await get(`${API}/repos/${gh.owner}/${gh.repo}`, 'application/vnd.github+json')).json()) as { default_branch?: unknown }
    ref = typeof info.default_branch === 'string' ? info.default_branch : 'main'
  }
  if (!/^[\w.-]{1,100}$/.test(ref)) throw new Error('Unsupported branch name')
  const t = (await (await get(`${API}/repos/${gh.owner}/${gh.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, 'application/vnd.github+json')).json()) as { tree?: TreeItem[]; truncated?: boolean }
  return { owner: gh.owner, repo: gh.repo, ref, found: skillsInTree(Array.isArray(t.tree) ? t.tree : [], gh.path, gh.repo), truncated: !!t.truncated }
}

const sourceOf = (l: Loaded, f: FoundSkill): string => `https://github.com/${l.owner}/${l.repo}/tree/${l.ref}${f.dir ? '/' + f.dir : ''}`
const rawUrl = (l: Loaded, path: string): string => `${RAW}/${l.owner}/${l.repo}/${encodeURIComponent(l.ref)}/${enc(path)}`

export interface RemoteSkill { name: string; dir: string; description: string; files: number; scripts: number; tooBig: boolean }

export async function scanSkills(url: string): Promise<{ skills: RemoteSkill[]; truncated: boolean }> {
  const l = await load(url)
  const skills = await Promise.all(l.found.slice(0, 60).map(async (f): Promise<RemoteSkill> => {
    let description = ''
    try {
      const text = (await (await get(rawUrl(l, f.skillMd), 'text/plain')).text()).slice(0, 8000)
      const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
      description = m ? frontmatterDescription(m[1]) : ''
    } catch { /* description is optional */ }
    return { name: f.name, dir: f.dir, description, files: f.files.length, scripts: f.scripts, tooBig: f.tooBig }
  }))
  return { skills, truncated: l.truncated }
}

export interface FetchedSkill { name: string; source: string; files: { rel: string; bytes: Buffer }[] }

// Downloads the chosen skill folders (by their folder path in the repo; '' is the repo root).
export async function fetchSkills(url: string, dirs: string[]): Promise<FetchedSkill[]> {
  const l = await load(url)
  const out: FetchedSkill[] = []
  for (const f of l.found.filter((x) => dirs.includes(x.dir))) {
    if (f.tooBig) throw new Error(`"${f.name}" is too large to import`)
    const files: FetchedSkill['files'] = []
    for (let i = 0; i < f.files.length; i += 6) {
      files.push(...(await Promise.all(f.files.slice(i, i + 6).map(async (x) => {
        const bytes = Buffer.from(await (await get(rawUrl(l, f.dir ? `${f.dir}/${x.path}` : x.path), 'application/octet-stream')).arrayBuffer())
        if (bytes.length > IMPORT_MAX_FILE) throw new Error(`"${x.path}" is too large to import`)
        return { rel: x.path, bytes }
      }))))
    }
    out.push({ name: f.name, source: sourceOf(l, f), files })
  }
  return out
}
