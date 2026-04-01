import fs from 'fs'

type Emitter = (channel: string, data: unknown) => void

/**
 * 监听外部日志文件变更，将增量内容以 `log:line` 推送到渲染进程。
 * 通过追踪文件偏移量实现准确的增量读取，避免重复或遗漏。
 */
export class LogWatcherService {
  private watcher: fs.FSWatcher | null = null
  /** 已读取到的文件字节偏移，用于只读取新增内容 */
  private offset: number = 0
  /** 跨次读取时可能截断的不完整行缓冲 */
  private partialLine: string = ''
  private emit: Emitter

  constructor(emit: Emitter) {
    this.emit = emit
  }

  /**
   * 开始监听日志文件，先读取尾部最近 100 行，之后只推送增量。
   * @param logPath - 日志文件绝对路径
   */
  watch(logPath: string): { ok: boolean; error?: string } {
    this.unwatch()

    if (!fs.existsSync(logPath)) {
      return { ok: false, error: `Log file not found: ${logPath}` }
    }

    try {
      const content = fs.readFileSync(logPath, 'utf-8')
      const lines = content.split('\n').slice(-100)
      lines.forEach(line => {
        if (line) this.emit('log:line', line)
      })

      const stat = fs.statSync(logPath)
      this.offset = stat.size
      this.partialLine = ''

      this.watcher = fs.watch(logPath, () => {
        this.readIncrement(logPath)
      })

      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }

  /**
   * 停止文件监听并重置状态。
   */
  unwatch(): { ok: boolean } {
    this.watcher?.close()
    this.watcher = null
    this.offset = 0
    this.partialLine = ''
    return { ok: true }
  }

  /**
   * 从上次偏移量开始读取新增内容并逐行推送。
   * @param logPath - 日志文件路径
   */
  private readIncrement(logPath: string): void {
    try {
      const stat = fs.statSync(logPath)

      if (stat.size < this.offset) {
        this.offset = 0
        this.partialLine = ''
      }

      if (stat.size === this.offset) return

      const fd = fs.openSync(logPath, 'r')
      const buf = Buffer.alloc(stat.size - this.offset)
      fs.readSync(fd, buf, 0, buf.length, this.offset)
      fs.closeSync(fd)

      this.offset = stat.size

      const chunk = this.partialLine + buf.toString('utf-8')
      const lines = chunk.split('\n')

      this.partialLine = lines.pop() ?? ''

      for (const line of lines) {
        if (line) this.emit('log:line', line)
      }
    } catch {
      /* 文件可能被外部截断或删除，静默忽略 */
    }
  }
}