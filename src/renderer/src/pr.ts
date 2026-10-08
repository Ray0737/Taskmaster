import { prUrl } from '@shared/github'
import { call, errMsg } from './ipc'
import { toast } from './stores/ui'
import { tr } from './i18n'

// Opens GitHub's "new pull request" page for a branch (it must be pushed first: Source Control -> Sync).
export async function openPullRequest(branch: string): Promise<void> {
  try {
    const url = prUrl((await call('git.remoteUrl')) ?? '', branch)
    if (!url) { toast(tr('scm.noPr'), 'error'); return }
    await call('shell.openExternal', url)
  } catch (e) { toast(errMsg(e), 'error') }
}
