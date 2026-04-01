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
    getOpenClawConfig: () => ipcRenderer.invoke('config:getOpenClawConfig'),
    patchConfig: (patch: Record<string, unknown>) => ipcRenderer.invoke('config:patchConfig', patch),
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
    setToken: (token: string) => ipcRenderer.invoke('api:setToken', token),
  },

  // ── Channel Login (QR pairing) ───────────────────────────────
  channelLogin: {
    start: (channelKey: string, account?: string) =>
      ipcRenderer.invoke('channelLogin:start', channelKey, account),
    stop: () => ipcRenderer.invoke('channelLogin:stop'),
  },

  // ── Dialog ───────────────────────────────────────────────────
  dialog: {
    openDir: () => ipcRenderer.invoke('dialog:openDir'),
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
  },

  // ── Event Listeners ──────────────────────────────────────────
  on: {
    log: (cb: (msg: string) => void) => {
      const handler = (_: unknown, msg: string) => cb(msg)
      ipcRenderer.on('log:line', handler)
      return () => { ipcRenderer.removeListener('log:line', handler) }
    },
    clawStatus: (cb: (status: string) => void) => {
      const handler = (_: unknown, status: string) => cb(status)
      ipcRenderer.on('claw:status', handler)
      return () => { ipcRenderer.removeListener('claw:status', handler) }
    },
    configChanged: (cb: (path: string) => void) => {
      const handler = (_: unknown, path: string) => cb(path)
      ipcRenderer.on('config:changed', handler)
      return () => { ipcRenderer.removeListener('config:changed', handler) }
    },
    channelLoginQR: (cb: (data: { raw: string; dataUrl: string | null }) => void) => {
      const handler = (_: unknown, data: { raw: string; dataUrl: string | null }) => cb(data)
      ipcRenderer.on('channelLogin:qr', handler)
      return () => { ipcRenderer.removeListener('channelLogin:qr', handler) }
    },
    channelLoginStatus: (cb: (data: { status: string; channel: string; error?: string }) => void) => {
      const handler = (_: unknown, data: { status: string; channel: string; error?: string }) => cb(data)
      ipcRenderer.on('channelLogin:status', handler)
      return () => { ipcRenderer.removeListener('channelLogin:status', handler) }
    },
    channelLoginLog: (cb: (msg: string) => void) => {
      const handler = (_: unknown, msg: string) => cb(msg)
      ipcRenderer.on('channelLogin:log', handler)
      return () => { ipcRenderer.removeListener('channelLogin:log', handler) }
    },
    channelLoginTerminalQR: (cb: (art: string) => void) => {
      const handler = (_: unknown, art: string) => cb(art)
      ipcRenderer.on('channelLogin:terminalQR', handler)
      return () => { ipcRenderer.removeListener('channelLogin:terminalQR', handler) }
    },
  }
}

contextBridge.exposeInMainWorld('tclaw', tclawAPI)

// Expose types to renderer via window
export type TClawAPI = typeof tclawAPI