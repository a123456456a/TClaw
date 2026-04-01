import { spawn, ChildProcess } from 'child_process'
import QRCode from 'qrcode'

type Emitter = (channel: string, data: unknown) => void

/**
 * WhatsApp Baileys QR 字符串格式：`2@base64,base64,base64,base64`
 */
const QR_RAW_PATTERNS = [
  /^2@[\w+/=]+,[\w+/=]+,[\w+/=]+,[\w+/=]+$/,
  /^[\w+/=]{50,}$/
]

/** 终端 QR 方块字符（Baileys / qrcode-terminal 输出） */
const QR_BLOCK_CHARS = /[▀▄█▌▐░▒▓■□▪▫⬛⬜\u2580-\u259F\u2588]/

/**
 * 管理渠道登录/配对子进程。
 * 执行 `openclaw channels login --channel <name>` 并实时捕获 QR 数据与日志输出。
 */
export class ChannelLoginService {
  private process: ChildProcess | null = null
  private emit: Emitter
  /** 累积的 stdout 缓冲，用于跨行 QR 检测 */
  private buffer: string = ''

  constructor(emit: Emitter) {
    this.emit = emit
  }

  /**
   * 启动渠道登录流程。
   * @param channelKey - 渠道标识（如 `whatsapp`、`signal`）
   * @param account - 可选的账号标识
   */
  start(channelKey: string, account?: string): { ok: boolean; error?: string } {
    if (this.process) {
      return { ok: false, error: '已有登录进程在运行' }
    }

    this.buffer = ''
    const args = ['channels', 'login', '--channel', channelKey]
    if (account) {
      args.push('--account', account)
    }

    try {
      this.process = spawn('openclaw', args, {
        shell: true,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
      })

      this.emit('channelLogin:status', { status: 'started', channel: channelKey })

      this.process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        this.emit('channelLogin:log', text)
        this.buffer += text
        this.tryExtractQR()
        this.tryDetectTerminalQR(text)
      })

      this.process.stdout?.on('data', (chunk: Buffer) => {
        const text2 = chunk.toString().toLowerCase()
        if (text2.includes('success') || text2.includes('linked') || text2.includes('connected')) {
          this.emit('channelLogin:status', { status: 'success', channel: channelKey })
        }
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        this.emit('channelLogin:log', `[ERR] ${text}`)

        const lower = text.toLowerCase()
        if (lower.includes('success') || lower.includes('linked') || lower.includes('connected')) {
          this.emit('channelLogin:status', { status: 'success', channel: channelKey })
        }
      })

      this.process.on('exit', (code) => {
        const status = code === 0 ? 'success' : 'exited'
        this.emit('channelLogin:status', { status, code, channel: channelKey })
        this.process = null
      })

      this.process.on('error', (err) => {
        this.emit('channelLogin:status', { status: 'error', error: err.message, channel: channelKey })
        this.process = null
      })

      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }

  /**
   * 终止当前登录进程。
   */
  stop(): { ok: boolean } {
    if (this.process) {
      this.process.kill('SIGTERM')
      this.process = null
    }
    this.buffer = ''
    this.terminalQRLines = []
    this.terminalQRSent = false
    return { ok: true }
  }

  /** 累积的终端画行 */
  private terminalQRLines: string[] = []
  /** 是否已发送过终端画 QR */
  private terminalQRSent: boolean = false

  /**
   * 从累积缓冲中尝试提取原始 QR 字符串并生成 Data URL 图片。
   */
  private async tryExtractQR(): Promise<void> {
    const lines = this.buffer.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      for (const pattern of QR_RAW_PATTERNS) {
        if (pattern.test(trimmed)) {
          await this.emitQRImage(trimmed)
          this.buffer = ''
          return
        }
      }
    }

    if (this.buffer.length > 8000) {
      this.buffer = this.buffer.slice(-4000)
    }
  }

  /**
   * 检测终端方块字符画 QR 并推送给渲染进程。
   * CLI 用 Unicode 方块字符（▄▀█ 等）绘制 QR，连续多行含这些字符即为 QR 区域。
   * @param text - 新增的 stdout 文本块
   */
  private tryDetectTerminalQR(text: string): void {
    if (this.terminalQRSent) return

    const lines = text.split('\n')
    for (const line of lines) {
      if (QR_BLOCK_CHARS.test(line)) {
        this.terminalQRLines.push(line)
      } else if (this.terminalQRLines.length > 0 && line.trim() === '') {
        this.terminalQRLines.push('')
      } else if (this.terminalQRLines.length >= 10) {
        this.terminalQRSent = true
        this.emit('channelLogin:terminalQR', this.terminalQRLines.join('\n'))
        this.terminalQRLines = []
        return
      } else {
        this.terminalQRLines = []
      }
    }

    if (this.terminalQRLines.length >= 10) {
      this.terminalQRSent = true
      this.emit('channelLogin:terminalQR', this.terminalQRLines.join('\n'))
      this.terminalQRLines = []
    }
  }

  /**
   * 将 QR 字符串渲染为 Data URL 图片并推送到渲染进程。
   * @param qrData - 原始 QR 字符串
   */
  private async emitQRImage(qrData: string): Promise<void> {
    try {
      const dataUrl = await QRCode.toDataURL(qrData, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      })
      this.emit('channelLogin:qr', { raw: qrData, dataUrl })
    } catch {
      this.emit('channelLogin:qr', { raw: qrData, dataUrl: null })
    }
  }
}
