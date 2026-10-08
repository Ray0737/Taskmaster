import { create } from 'zustand'
import { basename } from '@shared/paths'
import { call } from './ipc'
import { useApp } from './stores/app'
import { useEditor } from './stores/editor'
import { confirmDialog, toast } from './stores/ui'
import { registerCommand } from './commands'
import { tr } from './i18n'

export const useProjectDialog = create<{ kind: null | 'new' | 'clone' }>(() => ({ kind: null }))
export const openProjectDialog = (kind: 'new' | 'clone'): void => useProjectDialog.setState({ kind })

async function confirmDiscard(): Promise<boolean> {
  if (!Object.keys(useEditor.getState().dirty).length) return true
  return confirmDialog({ title: tr('project.discardAll'), text: '', danger: true, confirmLabel: tr('editor.discardBtn') })
}

// Asks before throwing away unsaved edits, offers `git init` for plain folders, then switches project.
export async function openProject(path: string): Promise<boolean> {
  if (!(await confirmDiscard())) return false
  if (!(await call('git.isRepo', path))) {
    const ok = await confirmDialog({
      title: tr('project.notRepo.title'),
      text: tr('project.notRepo.text', { name: basename(path) }),
      confirmLabel: tr('project.notRepo.init')
    })
    if (!ok) return false
    await call('git.init', path)
  }
  useEditor.getState().closeAll()
  const root = await call('project.open', path)
  useApp.getState().setRoot(root)
  await call('recent.add', root)
  toast(tr('project.opened', { name: basename(root) }))
  return true
}

export async function closeProject(): Promise<boolean> {
  if (!useApp.getState().root) return true
  if (!(await confirmDiscard())) return false
  useEditor.getState().closeAll()
  await call('project.close')
  useApp.getState().setRoot(null)
  return true
}

// Registered after coreCommands, so this replaces Plan 1's simple 'project.openFolder'.
registerCommand(
  {
    id: 'project.openFolder', title: 'cmd.openFolder',
    run: async () => {
      const p = await call('dialog.openFolder')
      if (p) await openProject(p)
    }
  },
  { id: 'project.new', title: 'cmd.newProject', run: () => openProjectDialog('new') },
  { id: 'project.clone', title: 'cmd.cloneProject', run: () => openProjectDialog('clone') },
  { id: 'project.close', title: 'cmd.closeProject', run: async () => { await closeProject() } }
)
