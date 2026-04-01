import { contextBridge, ipcRenderer } from 'electron'

// Type-safe API exposed to renderer
const tclawAPI = {
  // ── Process Control ──────────────────────────────────────────
  claw: {
    start: (clawDir: string) => ipcRenderer.invoke('claw:start', clawDir),
    stop: () => ipcRenderer.invoke('claw:stop'),
    restart: () => ipcRenderer.invoke('claw:restart'),
    status: () => ipcRenderer.invoke('claw:status'),
  },

  // ── Config Management ────────────────────────────────────────
  config: {
    setDir: (dir: string) => ipcRenderer.invoke('config:setDir', dir),
    getAgents: () => ipcRenderer.invoke('config:getAgents'),
    saveAgent: (agentId: string, data: unknown) => ipcRenderer.invoke('config:saveAgent', agentId, data),
    getChannels: () => ipcRenderer.invoke('config:getChannels'),
    saveChannels: (data: unknown) => ipcRenderer.invoke('config:saveChannels', data),
    getGateway: () => ipcRenderer.invoke('config:getGateway'),
    saveGateway: (data: unknown) => ipcRenderer.invoke('config:saveGateway', data),
  },

  // ── Log ──────────────────────────────────────────────────────
  log: {
    watch: (logPath: string) => ipcRenderer.invoke('log:watch', logPath),
    unwatch: () => ipcRenderer.invoke('log:unwatch'),
  },

  // ── API Passthrough ──────────────────────────────────────────
  api: {
    request: (method: string, path: string, body?: unknown) =>
      ipcRenderer.invoke('api:request', method, path, body),
    setBase: (baseUrl: string) => ipcRenderer.invoke('api:setBase', baseUrl),
  },

  // ── Dialog ───────────────────────────────────────────────────
  dialog: {
    openDir: () => ipcRenderer.invoke('dialog:openDir'),
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
  },

  // ── Event Listeners ──────────────────────────────────────────
  on: {
    log: (cb: (msg: string) => void) => {
      ipcRenderer.on('log:line', (_, msg) => cb(msg))
      return () => ipcRenderer.removeAllListeners('log:line')
    },
    clawStatus: (cb: (status: string) => void) => {
      ipcRenderer.on('claw:status', (_, status) => cb(status))
      return () => ipcRenderer.removeAllListeners('claw:status')
    },
    configChanged: (cb: (path: string) => void) => {
      ipcRenderer.on('config:changed', (_, path) => cb(path))
      return () => ipcRenderer.removeAllListeners('config:changed')
    },
  }
}

contextBridge.exposeInMainWorld('tclaw', tclawAPI)

// Expose types to renderer via window
export type TClawAPI = typeof tclawAPI