import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('tm', {
  invoke: (ch: string, ...args: unknown[]) => ipcRenderer.invoke(ch, ...args),
  on: (ch: string, cb: (p: unknown) => void) => {
    const h = (_: unknown, p: unknown): void => cb(p)
    ipcRenderer.on(ch, h)
    return () => { ipcRenderer.removeListener(ch, h) }
  }
})
