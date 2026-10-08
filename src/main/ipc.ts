import { ipcMain, BrowserWindow } from 'electron'
import type { Api, Events } from '@shared/api'
import { log } from './log'

export function handle<K extends keyof Api>(k: K, fn: Api[K]): void {
  ipcMain.handle(k, async (_e, ...args: unknown[]) => {
    try {
      return await (fn as (...a: unknown[]) => unknown)(...args)
    } catch (err) {
      log(`ipc ${k} failed`, err)
      throw err
    }
  })
}

export function emit<K extends keyof Events>(k: K, payload: Events[K]): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(k, payload)
}
