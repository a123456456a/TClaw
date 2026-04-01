import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { ClawProcessService } from './services/clawProcess'
import { ConfigManagerService } from './services/configManager'
import { LogWatcherService } from './services/logWatcher'
import { ApiClientService } from './services/apiClient'

let mainWindow: BrowserWindow | null = null

// Service singletons
let clawProcess: ClawProcessService
let configManager: ConfigManagerService
let logWatcher: LogWatcherService
let apiClient: ApiClientService

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    title: 'TClaw',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })
}

// Init services after window created
function initServices() {
  clawProcess = new ClawProcessService((channel, data) => {
    mainWindow?.webContents.send(channel, data)
  })
  configManager = new ConfigManagerService((channel, data) => {
    mainWindow?.webContents.send(channel, data)
  })
  logWatcher = new LogWatcherService((channel, data) => {
    mainWindow?.webContents.send(channel, data)
  })
  apiClient = new ApiClientService()
}

// ── IPC Handlers ────────────────────────────────────────────────

// Process control
ipcMain.handle('claw:start', async (_, clawDir: string) => {
  return clawProcess.start(clawDir)
})
ipcMain.handle('claw:stop', async () => {
  return clawProcess.stop()
})
ipcMain.handle('claw:restart', async () => {
  return clawProcess.restart()
})
ipcMain.handle('claw:status', async () => {
  return clawProcess.getStatus()
})

// Config management
ipcMain.handle('config:setDir', async (_, dir: string) => {
  return configManager.setConfigDir(dir)
})
ipcMain.handle('config:getAgents', async () => {
  return configManager.getAgents()
})
ipcMain.handle('config:saveAgent', async (_, agentId: string, data: unknown) => {
  return configManager.saveAgent(agentId, data)
})
ipcMain.handle('config:getChannels', async () => {
  return configManager.getChannels()
})
ipcMain.handle('config:saveChannels', async (_, data: unknown) => {
  return configManager.saveChannels(data)
})
ipcMain.handle('config:getGateway', async () => {
  return configManager.getGateway()
})
ipcMain.handle('config:saveGateway', async (_, data: unknown) => {
  return configManager.saveGateway(data)
})

// Log watcher
ipcMain.handle('log:watch', async (_, logPath: string) => {
  return logWatcher.watch(logPath)
})
ipcMain.handle('log:unwatch', async () => {
  return logWatcher.unwatch()
})

// API passthrough
ipcMain.handle('api:request', async (_, method: string, path: string, body?: unknown) => {
  return apiClient.request(method, path, body)
})
ipcMain.handle('api:setBase', async (_, baseUrl: string) => {
  apiClient.setBase(baseUrl)
})

// Dialog
ipcMain.handle('dialog:openDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile']
  })
  return result.canceled ? null : result.filePaths[0]
})

// ── App lifecycle ────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  initServices()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  try {
    clawProcess?.stop()
    logWatcher?.unwatch()
  } catch {
    /* ignore */
  }
  if (process.platform !== 'darwin') app.quit()
})