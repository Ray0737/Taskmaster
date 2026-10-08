import { app, BrowserWindow, shell, Menu, dialog } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { handle } from './ipc'
import { log, logDir } from './log'
import { registerSettings } from './services/settings'
import { registerFs } from './services/fs'
import { registerPty, killAllPty } from './services/pty'
import { registerManual } from './services/manual'
import { registerGit } from './services/git'
import { registerAuth } from './services/auth'
import { registerRecent } from './services/recent'
import { registerProject } from './services/project'

let win: BrowserWindow | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 960, minHeight: 600, show: false,
    backgroundColor: '#000000',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#000000', symbolColor: '#e8e8e8', height: 35 },
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: true, nodeIntegration: false }
  })
  win.once('ready-to-show', () => win?.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('before-input-event', (_e, i) => {
    if (!app.isPackaged && i.type === 'keyDown' && i.key === 'F12') win?.webContents.toggleDevTools()
  })
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

function registerWindow(): void {
  handle('win.setOverlay', async (color, symbolColor) => {
    try { win?.setTitleBarOverlay({ color, symbolColor, height: 35 }) } catch { /* not supported on this OS */ }
  })
  handle('win.role', async (role) => {
    const wc = win?.webContents
    if (!wc) return
    if (role === 'undo') wc.undo()
    else if (role === 'redo') wc.redo()
    else if (role === 'cut') wc.cut()
    else if (role === 'copy') wc.copy()
    else if (role === 'paste') wc.paste()
    else if (role === 'selectAll') wc.selectAll()
  })
  handle('shell.openExternal', async (url) => { if (/^https?:\/\//.test(url)) await shell.openExternal(url) })
  handle('app.quit', async () => app.quit())
  handle('app.openLogs', async () => { mkdirSync(logDir(), { recursive: true }); await shell.openPath(logDir()) })
  handle('dialog.openFolder', async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
}

process.on('uncaughtException', (e) => log('uncaught', e))
process.on('unhandledRejection', (e) => log('unhandled', e))

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerSettings()
  registerWindow()
  registerFs()
  registerGit()
  registerAuth()
  registerRecent()
  registerProject()
  registerPty()
  registerManual()
  createWindow()
})
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => killAllPty())
