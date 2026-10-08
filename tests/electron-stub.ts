import { tmpdir } from 'os'

export const app = { getPath: () => tmpdir(), isPackaged: false, getAppPath: () => process.cwd() }
export const ipcMain = { handle: () => {} }
export const BrowserWindow = { getAllWindows: () => [] as unknown[] }
export const shell = { trashItem: async () => {}, openExternal: async () => {}, showItemInFolder: () => {}, openPath: async () => '' }
export const dialog = {}
export const safeStorage = {}
