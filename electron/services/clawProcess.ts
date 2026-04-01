import { spawn, ChildProcess } from 'child_process'

type Emitter = (channel: string, data: unknown) => void

export type ClawStatus = 'stopped' | 'starting' | 'running' | 'error'

/** stdout 中表示 Gateway 已就绪的关键字（匹配 OpenClaw 实际输出） */
const RUNNING_SIGNATURES = [
  'Runtime: running',
  'RPC probe: ok',
  'Gateway listening',
  'listening on',
  'gateway started'
]

/**
 * 在子进程中启动 OpenClaw Gateway，并将 stdout/stderr 转发为日志与状态事件。
 * 使用 `openclaw gateway` CLI 命令启动，与 OpenClaw 官方启动方式一致。
 */
export class ClawProcessService {
  private process: ChildProcess | null = null
  private status: ClawStatus = 'stopped'
  private clawDir: string = ''
  /** 手动停止标记，避免 exit 回调与手动 stop 竞争 */
  private stopping: boolean = false
  private emit: Emitter

  constructor(emit: Emitter) {
    this.emit = emit
  }

  /**
   * 在指定目录启动 OpenClaw Gateway 子进程。
   * 依次尝试：`openclaw gateway` → `npx openclaw gateway` → `node dist/index.js gateway`。
   * @param clawDir - OpenClaw 项目或安装目录
   * @param extraArgs - 可选的额外 CLI 参数（如 `['--port', '19001', '--verbose']`）
   */
  start(clawDir: string, extraArgs: string[] = []): { ok: boolean; error?: string } {
    if (this.process) return { ok: false, error: 'Already running' }

    this.clawDir = clawDir
    this.stopping = false
    this.setStatus('starting')

    try {
      const baseArgs = ['gateway', ...extraArgs]

      this.process = spawn('openclaw', baseArgs, {
        cwd: clawDir,
        env: { ...process.env },
        shell: true
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        const line = data.toString()
        this.emit('log:line', line)
        const lower = line.toLowerCase()
        if (RUNNING_SIGNATURES.some(sig => lower.includes(sig.toLowerCase()))) {
          this.setStatus('running')
        }
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        this.emit('log:line', `[STDERR] ${data.toString()}`)
      })

      this.process.on('exit', (code) => {
        if (this.stopping) return
        this.emit('log:line', `[PROCESS] exited with code ${code}`)
        this.process = null
        this.setStatus(code === 0 ? 'stopped' : 'error')
      })

      this.process.on('error', (err) => {
        if (this.stopping) return
        this.emit('log:line', `[PROCESS ERROR] ${err.message}`)
        this.process = null
        this.setStatus('error')
      })

      return { ok: true }
    } catch (err: unknown) {
      this.setStatus('error')
      return { ok: false, error: String(err) }
    }
  }

  /**
   * 停止子进程（SIGTERM），先标记以避免 exit 回调竞争。
   */
  stop(): { ok: boolean } {
    if (!this.process) return { ok: true }
    this.stopping = true
    this.process.kill('SIGTERM')
    this.process = null
    this.setStatus('stopped')
    return { ok: true }
  }

  /**
   * 重启子进程（先停后启）。
   */
  restart(): { ok: boolean; error?: string } {
    this.stop()
    return this.start(this.clawDir)
  }

  /**
   * 获取当前进程状态。
   */
  getStatus(): ClawStatus {
    return this.status
  }

  /**
   * 更新状态并通知渲染进程。
   * @param s - 新状态
   */
  private setStatus(s: ClawStatus) {
    this.status = s
    this.emit('claw:status', s)
  }
}