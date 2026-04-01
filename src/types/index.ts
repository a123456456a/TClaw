// ── OpenClaw types ───────────────────────────────────────────────

export type ClawStatus = 'stopped' | 'starting' | 'running' | 'error'

export interface AgentConfig {
  _file?: string
  id?: string
  name: string
  model?: string
  description?: string
  tools?: string[]
  memory?: Record<string, unknown>
  [key: string]: unknown
}

export interface ChannelBinding {
  agentId: string
  accountId: string
  platform: 'feishu' | 'wechat' | 'qq' | 'dingtalk'
  [key: string]: unknown
}

export interface GatewayConfig {
  port?: number
  host?: string
  bindings?: ChannelBinding[]
  accounts?: AccountConfig[]
  [key: string]: unknown
}

export interface AccountConfig {
  id: string
  platform: 'feishu' | 'wechat' | 'qq' | 'dingtalk'
  type?: string
  [key: string]: unknown
}

// ── TClaw Settings ────────────────────────────────────────────────

export interface TClawSettings {
  clawDir: string
  gatewayUrl: string
  autoStart: boolean
  logPath: string
  /** 会话列表轮询路径，依 Gateway 实际路由调整 */
  sessionsApiPath: string
}

/**
 * 会话监控中展示的一条事件（来自 Gateway 或本地占位）。
 */
export interface SessionEventItem {
  id: string
  at: string
  payload: unknown
}

// ── IPC API type (mirrors preload) ───────────────────────────────

export interface TClawAPI {
  claw: {
    start: (clawDir: string) => Promise<{ ok: boolean; error?: string }>
    stop: () => Promise<{ ok: boolean }>
    restart: () => Promise<{ ok: boolean; error?: string }>
    status: () => Promise<ClawStatus>
  }
  config: {
    setDir: (dir: string) => Promise<{ ok: boolean }>
    getAgents: () => Promise<AgentConfig[]>
    saveAgent: (agentId: string, data: AgentConfig) => Promise<{ ok: boolean; error?: string }>
    getChannels: () => Promise<GatewayConfig>
    saveChannels: (data: GatewayConfig) => Promise<{ ok: boolean; error?: string }>
    getGateway: () => Promise<GatewayConfig>
    saveGateway: (data: GatewayConfig) => Promise<{ ok: boolean; error?: string }>
  }
  log: {
    watch: (logPath: string) => Promise<{ ok: boolean; error?: string }>
    unwatch: () => Promise<{ ok: boolean }>
  }
  api: {
    request: (method: string, path: string, body?: unknown) => Promise<unknown>
    setBase: (baseUrl: string) => Promise<void>
  }
  dialog: {
    openDir: () => Promise<string | null>
    openFile: () => Promise<string | null>
  }
  on: {
    log: (cb: (msg: string) => void) => () => void
    clawStatus: (cb: (status: ClawStatus) => void) => () => void
    configChanged: (cb: (path: string) => void) => () => void
  }
}

declare global {
  interface Window {
    tclaw: TClawAPI
  }
}