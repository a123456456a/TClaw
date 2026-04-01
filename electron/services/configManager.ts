import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import chokidar, { FSWatcher } from 'chokidar'

type Emitter = (channel: string, data: unknown) => void

/**
 * 管理 OpenClaw 配置目录下的 YAML，并用 chokidar 监听变更通知渲染进程。
 */
export class ConfigManagerService {
  private configDir: string = ''
  private watcher: FSWatcher | null = null
  private emit: Emitter

  constructor(emit: Emitter) {
    this.emit = emit
  }

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

  // ── Agents ────────────────────────────────────────────────────

  getAgents(): unknown[] {
    const agentsDir = path.join(this.configDir, 'agents')
    if (!fs.existsSync(agentsDir)) return []

    return fs.readdirSync(agentsDir)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => {
        const content = fs.readFileSync(path.join(agentsDir, f), 'utf-8')
        return { _file: f, ...yaml.load(content) as object }
      })
  }

  /**
   * 将 Agent 写入 `agents/<agentId>.yaml`，写入前会去掉仅用于 UI 的 `_file` 字段。
   * @param agentId - 文件名（不含扩展名）
   * @param data - Agent 配置对象
   */
  saveAgent(agentId: string, data: unknown): { ok: boolean; error?: string } {
    try {
      const filePath = path.join(this.configDir, 'agents', `${agentId}.yaml`)
      const copy = { ...(data as Record<string, unknown>) }
      delete copy._file
      fs.writeFileSync(filePath, yaml.dump(copy), 'utf-8')
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }

  // ── Channels ──────────────────────────────────────────────────

  getChannels(): unknown {
    return this.readYaml('gateway.yaml') ?? this.readYaml('config.yaml')
  }

  saveChannels(data: unknown): { ok: boolean; error?: string } {
    return this.writeYaml('gateway.yaml', data)
  }

  // ── Gateway ───────────────────────────────────────────────────

  getGateway(): unknown {
    return this.readYaml('gateway.yaml')
  }

  saveGateway(data: unknown): { ok: boolean; error?: string } {
    return this.writeYaml('gateway.yaml', data)
  }

  // ── Helpers ───────────────────────────────────────────────────

  private readYaml(filename: string): unknown {
    const filePath = path.join(this.configDir, filename)
    if (!fs.existsSync(filePath)) return null
    try {
      return yaml.load(fs.readFileSync(filePath, 'utf-8'))
    } catch {
      return null
    }
  }

  private writeYaml(filename: string, data: unknown): { ok: boolean; error?: string } {
    try {
      const filePath = path.join(this.configDir, filename)
      fs.writeFileSync(filePath, yaml.dump(data), 'utf-8')
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }
}