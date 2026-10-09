import { runLine } from '@shared/run'
import { extOf } from '@shared/paths'
import { useEditor, saveFile } from './stores/editor'
import { runInTerminal } from './stores/terminal'
import { toast } from './stores/ui'
import { tr } from './i18n'

// Saves the file if it has unsaved edits, then runs it in the terminal with the toolchain on the user's machine.
export async function runFile(path: string): Promise<void> {
  const line = runLine(path)
  if (!line) {
    toast(extOf(path) === 'ino' ? tr('run.ino') : tr('run.unsupported', { ext: extOf(path) || '?' }))
    return
  }
  if (useEditor.getState().dirty[path]) await saveFile(path)
  await runInTerminal(line)
}

export function runActiveFile(): void {
  const { tabs, active } = useEditor.getState()
  const t = tabs.find((x) => x.id === active)
  if (t?.kind === 'file' && t.path) void runFile(t.path)
  else toast(tr('run.noFile'))
}
