import { promises as fsp } from 'fs'
import { join } from 'path'
import { handle } from '../ipc'
import { state } from '../state'
import { git, initRepo, stage, commit } from './git'
import { createRepo } from './auth'
import { stopWatch } from './fs'
import { stopTeam } from './team'

export function nameError(name: string): string | null {
  const n = name.trim()
  if (!n) return 'Name is required'
  if (n.length > 100) return 'Name is too long (max 100)'
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(n) || n === '.' || n === '..' || /[. ]$/.test(name)) return 'Name contains characters that are not allowed'
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(n)) return 'Name is reserved by Windows'
  return null
}

export async function createProject(parent: string, name: string): Promise<string> {
  const err = nameError(name)
  if (err) throw new Error(err)
  const dir = join(parent, name.trim())
  try { await fsp.mkdir(dir) } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Folder already exists')
    throw e
  }
  await initRepo(dir)
  await fsp.writeFile(join(dir, 'README.md'), `# ${name.trim()}\n`)
  await stage(dir, ['README.md'])
  await commit(dir, 'Initial commit')
  return dir
}

export function registerProject(): void {
  handle('project.create', async (parent, name, github) => {
    const path = await createProject(parent, name)
    if (!github) return { path }
    try { // the local project exists either way; a GitHub failure becomes a warning, not an error
      const repo = await createRepo(name, github === 'private')
      await git(path, ['remote', 'add', 'origin', repo.cloneUrl])
      await git(path, ['push', '-u', 'origin', 'main'], { timeout: 300_000 })
      return { path }
    } catch (e) { return { path, warning: (e as Error).message } }
  })
  handle('project.close', async () => { stopTeam(); state.root = null; stopWatch() })
}
