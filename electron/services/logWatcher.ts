import fs from 'fs'
import { EventEmitter } from 'events'

type Emitter = (channel: string, data: unknown) => void

/**
 * 监听外部日志文件变更，将增量内容以 `log:line` 推送到渲染进程（简化版 tail）。
 */
export class LogWatcherService {
  private watcher: fs.FSWatcher | null = null
  private stream: fs.ReadStream | null = null
  private emit: Emitter

  constructor(emit: Emitter) {
    this.emit = emit
  }

  watch(logPath: string): { ok: boolean; error?: string } {
    if (!fs.existsSync(logPath)) {
      return { ok: false, error: `Log file not found: ${logPath}` }
    }

    try {
      // Tail the last 100 lines on start
      const content = fs.readFileSync(logPath, 'utf-8')
      const lines = content.split('\n').slice(-100)
      lines.forEach(line => this.emit('log:line', line))

      // Watch for new writes
      this.watcher = fs.watch(logPath, () => {
        // Re-read and emit new tail
        const updated = fs.readFileSync(logPath, 'utf-8')
        const newLines = updated.split('\n').slice(-10)
        newLines.forEach(line => this.emit('log:line', line))
      })

      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }

  unwatch(): { ok: boolean } {
    this.watcher?.close()
    this.stream?.destroy()
    this.watcher = null
    this.stream = null
    return { ok: true }
  }
}