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
  /** OpenClaw 支持的渠道标识 */
  platform: 'whatsapp' | 'telegram' | 'discord' | 'slack' | 'signal' | 'imessage' | 'googlechat' | 'mattermost' | 'msteams' | string
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
  platform: 'whatsapp' | 'telegram' | 'discord' | 'slack' | 'signal' | 'imessage' | 'googlechat' | 'mattermost' | 'msteams' | string
  type?: string
  [key: string]: unknown
}

// ── TClaw Settings ────────────────────────────────────────────────

export interface TClawSettings {
  clawDir: string
  /** OpenClaw Gateway 根地址（默认 http://localhost:18789） */
  gatewayUrl: string
  /** Gateway Bearer Token（`gateway.auth.token` 或 `OPENCLAW_GATEWAY_TOKEN`），留空则不发送认证头 */
  gatewayToken: string
  autoStart: boolean
  logPath: string
  /** 会话/状态查询路径（默认 /v1/models） */
  sessionsApiPath: string
  /** 聊天 POST 路径（默认 /v1/chat/completions，兼容 OpenAI 格式） */
  chatApiPath: string
  /** 可选：发往 Gateway 的 Agent 目标（如 `openclaw/default`、`openclaw/<agentId>`） */
  chatAgentId: string
}

/**
 * 单条聊天消息（本地展示用）。
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  at: string
  error?: boolean
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
    /** @deprecated 与 getGateway 功能重复，推荐使用 getGateway */
    getChannels: () => Promise<GatewayConfig>
    /** @deprecated 与 saveGateway 功能重复，推荐使用 saveGateway */
    saveChannels: (data: GatewayConfig) => Promise<{ ok: boolean; error?: string }>
    getGateway: () => Promise<GatewayConfig>
    saveGateway: (data: GatewayConfig) => Promise<{ ok: boolean; error?: string }>
    /** 获取完整 openclaw.json 配置 */
    getOpenClawConfig: () => Promise<Record<string, unknown> | null>
    /** 深度合并补丁到 openclaw.json（Gateway 自动热重载） */
    patchConfig: (patch: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>
  }
  log: {
    watch: (logPath: string) => Promise<{ ok: boolean; error?: string }>
    unwatch: () => Promise<{ ok: boolean }>
  }
  api: {
    request: (method: string, path: string, body?: unknown) => Promise<unknown>
    setBase: (baseUrl: string) => Promise<void>
    setToken: (token: string) => Promise<void>
  }
  channelLogin: {
    start: (channelKey: string, account?: string) => Promise<{ ok: boolean; error?: string }>
    stop: () => Promise<{ ok: boolean }>
  }
  dialog: {
    openDir: () => Promise<string | null>
    openFile: () => Promise<string | null>
  }
  on: {
    log: (cb: (msg: string) => void) => () => void
    clawStatus: (cb: (status: ClawStatus) => void) => () => void
    configChanged: (cb: (path: string) => void) => () => void
    channelLoginQR: (cb: (data: { raw: string; dataUrl: string | null }) => void) => () => void
    channelLoginStatus: (cb: (data: { status: string; channel: string; error?: string }) => void) => () => void
    channelLoginLog: (cb: (msg: string) => void) => () => void
    channelLoginTerminalQR: (cb: (art: string) => void) => () => void
  }
}

declare global {
  interface Window {
    tclaw: TClawAPI
  }
}