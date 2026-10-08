import { keyFromEvent } from '@shared/keys'
import { toast } from './stores/ui'
import { errMsg } from './ipc'

export interface Command {
  id: string
  title: string // i18n key
  keys?: string // e.g. "Ctrl+Shift+P"
  run: () => void | Promise<void>
  hidden?: boolean // not listed in palette
}

const reg = new Map<string, Command>()

export const registerCommand = (...cs: Command[]): void => cs.forEach((c) => reg.set(c.id, c))
export const hasCommand = (id: string): boolean => reg.has(id)
export const getCommand = (id: string): Command | undefined => reg.get(id)
export const allCommands = (): Command[] => [...reg.values()].filter((c) => !c.hidden)

export function runCommand(id: string): void {
  const c = reg.get(id)
  if (!c) return
  Promise.resolve()
    .then(() => c.run())
    .catch((e) => toast(errMsg(e), 'error'))
}

let installed = false
export function installKeybindings(): void {
  if (installed) return
  installed = true
  // Capture phase so Monaco/xterm cannot swallow app shortcuts.
  window.addEventListener('keydown', (e) => {
    const k = keyFromEvent(e)
    if (!k) return
    const c = [...reg.values()].find((x) => x.keys === k)
    if (!c) return
    e.preventDefault()
    e.stopPropagation()
    runCommand(c.id)
  }, true)
}
