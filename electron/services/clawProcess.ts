import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'

type Emitter = (channel: string, data: unknown) => void

export type ClawStatus = 'stopped' | 'starting' | 'running' | 'error'

/**
 * 在子进程中启动 OpenClaw（`node index.js`），并将 stdout/stderr 转发为日志与状态事件。
 */
export class ClawProcessService {
  private process: ChildProcess | null = null
  private status: ClawStatus = 'stopped'
  private clawDir: string = ''
  private emit: Emitter

  constructor(emit: Emitter) {
    this.emit = emit
  }

  start(clawDir: string): { ok: boolean; error?: string } {
    if (this.process) return { ok: false, error: 'Already running' }

    this.clawDir = clawDir
    this.setStatus('starting')

    try {
      // Try node index.js first, fallback to npm start
      const entryFile = join(clawDir, 'index.js')
      this.process = spawn('node', [entryFile], {
        cwd: clawDir,
        env: { ...process.env }
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        const line = data.toString()
        this.emit('log:line', line)
        if (line.includes('Gateway running') || line.includes('listening')) {
          this.setStatus('running')
        }
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        this.emit('log:line', `[STDERR] ${data.toString()}`)
      })

      this.process.on('exit', (code) => {
        this.emit('log:line', `[PROCESS] exited with code ${code}`)
        this.process = null
        this.setStatus(code === 0 ? 'stopped' : 'error')
      })

      this.process.on('error', (err) => {
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

  stop(): { ok: boolean } {
    if (!this.process) return { ok: true }
    this.process.kill('SIGTERM')
    this.process = null
    this.setStatus('stopped')
    return { ok: true }
  }

  restart(): { ok: boolean; error?: string } {
    this.stop()
    return this.start(this.clawDir)
  }

  getStatus(): ClawStatus {
    return this.status
  }

  private setStatus(s: ClawStatus) {
    this.status = s
    this.emit('claw:status', s)
  }
}