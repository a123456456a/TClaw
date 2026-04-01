import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import chokidar, { FSWatcher } from 'chokidar'

type Emitter = (channel: string, data: unknown) => void

/**
 * 管理 OpenClaw 配置。
 * 优先读写 `~/.openclaw/openclaw.json`（OpenClaw 标准 JSON5 配置），
 * 回退到配置目录下的 `agents/*.yaml` + `gateway.yaml`（兼容旧版布局）。
 * 使用 chokidar 监听变更并通知渲染进程。
 */
export class ConfigManagerService {
  private configDir: string = ''
  private watcher: FSWatcher | null = null
  private emit: Emitter

  constructor(emit: Emitter) {
    this.emit = emit
  }

  /**
   * 设置配置目录并启动 chokidar 文件监听。
   * @param dir - OpenClaw 项目根目录或 `~/.openclaw` 目录
   */
  setConfigDir(dir: string): { ok: boolean; error?: string } {
    this.configDir = dir
    this.watcher?.close()

    this.watcher = chokidar.watch(dir, {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true
    })

    this.watcher.on('change', (filePath) => {
      this.emit('config:changed', filePath)
    })

    return { ok: true }
  }

  // ── OpenClaw JSON 配置（公开方法） ─────────────────────────────

  /**
   * 获取完整的 openclaw.json 配置（解析后的对象）。
   * @returns 配置对象，找不到或解析失败返回 null
   */
  getOpenClawConfig(): Record<string, unknown> | null {
    return this.readOpenClawConfig()
  }

  /**
   * 深度合并部分字段到 openclaw.json，Gateway 会自动热重载。
   * @param patch - 需要 deep-merge 的部分配置
   */
  patchConfig(patch: Record<string, unknown>): { ok: boolean; error?: string } {
    const fp = this.findOpenClawConfig()
    if (!fp) {
      const home = process.env.HOME || process.env.USERPROFILE || ''
      const defaultDir = home ? path.join(home, '.openclaw') : this.configDir
      if (!fs.existsSync(defaultDir)) {
        fs.mkdirSync(defaultDir, { recursive: true })
      }
      const newPath = path.join(defaultDir, 'openclaw.json')
      try {
        fs.writeFileSync(newPath, JSON.stringify(patch, null, 2), 'utf-8')
        return { ok: true }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    }
    try {
      const existing = this.readOpenClawConfig() ?? {}
      const merged = this.deepMerge(existing, patch)
      fs.writeFileSync(fp, JSON.stringify(merged, null, 2), 'utf-8')
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }

  // ── OpenClaw JSON 内部方法 ─────────────────────────────────────

  /**
   * 定位 openclaw.json 配置文件路径。
   * 优先在 configDir 下查找，其次在 `~/.openclaw/` 下查找。
   */
  private findOpenClawConfig(): string | null {
    const candidates = [
      path.join(this.configDir, 'openclaw.json'),
      path.join(this.configDir, '.openclaw', 'openclaw.json')
    ]
    const home = process.env.HOME || process.env.USERPROFILE || ''
    if (home) {
      candidates.push(path.join(home, '.openclaw', 'openclaw.json'))
    }
    return candidates.find(f => fs.existsSync(f)) ?? null
  }

  /**
   * 读取 openclaw.json 并解析（JSON5 兼容简易处理：去除注释后 JSON.parse）。
   */
  private readOpenClawConfig(): Record<string, unknown> | null {
    const fp = this.findOpenClawConfig()
    if (!fp) return null
    try {
      let raw = fs.readFileSync(fp, 'utf-8')
      raw = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      raw = raw.replace(/,\s*([\]}])/g, '$1')
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  /**
   * 将部分字段写回 openclaw.json（保留原文件其余内容）。
   * @param patch - 需要 merge 的顶层字段
   */
  private patchOpenClawConfig(patch: Record<string, unknown>): { ok: boolean; error?: string } {
    const fp = this.findOpenClawConfig()
    if (!fp) return { ok: false, error: '未找到 openclaw.json' }
    try {
      const existing = this.readOpenClawConfig() ?? {}
      const merged = { ...existing, ...patch }
      fs.writeFileSync(fp, JSON.stringify(merged, null, 2), 'utf-8')
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }

  // ── Agents ────────────────────────────────────────────────────

  /**
   * 获取 Agent 列表。
   * 优先从 openclaw.json 的 `agents.list[]` 读取，
   * 回退到 `agents/*.yaml` 文件读取。
   * @returns Agent 配置对象数组
   */
  getAgents(): unknown[] {
    const config = this.readOpenClawConfig()
    if (config) {
      const agents = config.agents as Record<string, unknown> | undefined
      if (agents && Array.isArray(agents.list)) {
        return (agents.list as unknown[]).map((a, i) => {
          const agent = a as Record<string, unknown>
          return {
            _source: 'openclaw.json',
            id: agent.id ?? `agent-${i}`,
            name: agent.name ?? agent.id ?? `agent-${i}`,
            model: this.resolveModel(agent.model ?? agents?.defaults),
            description: agent.workspace ? `workspace: ${agent.workspace}` : '',
            ...agent
          }
        })
      }
      if (agents?.defaults) {
        const defaults = agents.defaults as Record<string, unknown>
        return [{
          _source: 'openclaw.json',
          id: 'main',
          name: 'main (default)',
          model: this.resolveModel(defaults.model),
          description: defaults.workspace ? `workspace: ${defaults.workspace}` : 'Default agent',
          ...defaults
        }]
      }
    }

    const agentsDir = path.join(this.configDir, 'agents')
    if (!fs.existsSync(agentsDir)) return []
    return fs.readdirSync(agentsDir)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => {
        const content = fs.readFileSync(path.join(agentsDir, f), 'utf-8')
        return { _file: f, _source: 'yaml', ...yaml.load(content) as object }
      })
  }

  /**
   * 从 model 字段中提取可展示的模型名。
   * @param model - 可能是字符串或 `{ primary, fallbacks }` 对象
   */
  private resolveModel(model: unknown): string {
    if (!model) return ''
    if (typeof model === 'string') return model
    if (typeof model === 'object') {
      const m = model as Record<string, unknown>
      if (typeof m.primary === 'string') return m.primary
    }
    return ''
  }

  /**
   * 保存 Agent 配置。
   * 若来源是 openclaw.json，写回 `agents.list[]`；否则写入 YAML 文件。
   * @param agentId - Agent ID
   * @param data - Agent 配置对象
   */
  saveAgent(agentId: string, data: unknown): { ok: boolean; error?: string } {
    const record = data as Record<string, unknown>
    const source = record._source

    if (source === 'openclaw.json') {
      const config = this.readOpenClawConfig()
      if (!config) return { ok: false, error: '无法读取 openclaw.json' }

      const agents = (config.agents ?? {}) as Record<string, unknown>
      const list = Array.isArray(agents.list) ? [...agents.list] as Record<string, unknown>[] : []

      const copy = { ...record }
      delete copy._source
      delete copy._file

      const idx = list.findIndex(a => (a as Record<string, unknown>).id === agentId)
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...copy }
      } else {
        list.push(copy)
      }

      return this.patchOpenClawConfig({
        agents: { ...agents, list }
      })
    }

    try {
      const agentsDir = path.join(this.configDir, 'agents')
      if (!fs.existsSync(agentsDir)) {
        fs.mkdirSync(agentsDir, { recursive: true })
      }
      const filePath = path.join(agentsDir, `${agentId}.yaml`)
      const copy = { ...record }
      delete copy._file
      delete copy._source
      fs.writeFileSync(filePath, yaml.dump(copy), 'utf-8')
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }

  // ── Channels / Bindings ────────────────────────────────────────

  /**
   * 读取渠道与绑定配置。
   * 优先从 openclaw.json 的 `channels` + `bindings` 读取，
   * 回退到 `gateway.yaml`。
   */
  getChannels(): unknown {
    const config = this.readOpenClawConfig()
    if (config && (config.channels || config.bindings)) {
      return {
        channels: config.channels ?? {},
        bindings: config.bindings ?? []
      }
    }
    return this.readYaml('gateway.yaml') ?? this.readYaml('config.yaml')
  }

  /**
   * 保存渠道配置。
   * @param data - 包含 channels 和 bindings 的配置对象
   */
  saveChannels(data: unknown): { ok: boolean; error?: string } {
    const record = data as Record<string, unknown>
    const config = this.readOpenClawConfig()
    if (config) {
      const patch: Record<string, unknown> = {}
      if (record.channels) patch.channels = record.channels
      if (record.bindings) patch.bindings = record.bindings
      return this.patchOpenClawConfig(patch)
    }
    return this.writeYaml('gateway.yaml', data)
  }

  // ── Gateway ───────────────────────────────────────────────────

  /**
   * 读取 Gateway 完整配置（openclaw.json 或 gateway.yaml）。
   */
  getGateway(): unknown {
    const config = this.readOpenClawConfig()
    if (config) {
      return {
        _source: 'openclaw.json',
        gateway: config.gateway ?? {},
        channels: config.channels ?? {},
        bindings: config.bindings ?? [],
        agents: config.agents ?? {}
      }
    }
    return this.readYaml('gateway.yaml')
  }

  /**
   * 保存 Gateway 配置。
   * @param data - Gateway 配置对象
   */
  saveGateway(data: unknown): { ok: boolean; error?: string } {
    const record = data as Record<string, unknown>
    if (record._source === 'openclaw.json') {
      const patch: Record<string, unknown> = {}
      if (record.gateway) patch.gateway = record.gateway
      if (record.channels) patch.channels = record.channels
      if (record.bindings) patch.bindings = record.bindings
      return this.patchOpenClawConfig(patch)
    }
    return this.writeYaml('gateway.yaml', data)
  }

  // ── Helpers ───────────────────────────────────────────────────

  /** @internal */
  private readYaml(filename: string): unknown {
    const filePath = path.join(this.configDir, filename)
    if (!fs.existsSync(filePath)) return null
    try {
      return yaml.load(fs.readFileSync(filePath, 'utf-8'))
    } catch {
      return null
    }
  }

  /** @internal */
  private writeYaml(filename: string, data: unknown): { ok: boolean; error?: string } {
    try {
      const filePath = path.join(this.configDir, filename)
      fs.writeFileSync(filePath, yaml.dump(data), 'utf-8')
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }

  /**
   * 递归深度合并两个对象（数组直接替换，null 删除键）。
   * @param target - 基础对象
   * @param source - 要合并的补丁
   */
  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result = { ...target }
    for (const key of Object.keys(source)) {
      const sv = source[key]
      if (sv === null) {
        delete result[key]
      } else if (
        typeof sv === 'object' && !Array.isArray(sv) &&
        typeof result[key] === 'object' && !Array.isArray(result[key]) && result[key] !== null
      ) {
        result[key] = this.deepMerge(result[key] as Record<string, unknown>, sv as Record<string, unknown>)
      } else {
        result[key] = sv
      }
    }
    return result
  }
}
