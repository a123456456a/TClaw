import http from 'http'
import https from 'https'

/** 默认请求超时（毫秒） */
const DEFAULT_TIMEOUT_MS = 15_000

/**
 * 通过主进程向 OpenClaw Gateway 发起 HTTP 请求，避免渲染进程 CORS。
 * 支持 Bearer Token 认证（与 OpenClaw `gateway.auth.token` 对齐），内置超时保护。
 */
export class ApiClientService {
  private baseUrl: string = 'http://localhost:18789'
  /** Gateway Bearer Token，为空则不发送 Authorization 头 */
  private token: string = ''

  /**
   * 设置 Gateway 根地址。
   * @param baseUrl - 无尾部 `/`，例如 `http://192.168.1.10:18789`、`https://openclaw.example.com`
   */
  setBase(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /**
   * 设置 Gateway 认证令牌。
   * @param token - Bearer Token 值（对应 `gateway.auth.token` 或 `OPENCLAW_GATEWAY_TOKEN`）
   */
  setToken(token: string): void {
    this.token = token.trim()
  }

  /**
   * 向 Gateway 发送 HTTP 请求并返回解析后的响应。
   * @param method - HTTP 方法（GET / POST 等）
   * @param path - 以 `/` 开头的相对路径
   * @param body - 可选 JSON 请求体
   * @returns `{ status, data }` 对象
   */
  request(method: string, path: string, body?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${path}`)
      const isHttps = url.protocol === 'https:'
      const lib = isHttps ? https : http

      const bodyStr = body !== undefined && body !== null ? JSON.stringify(body) : ''
      const headers: http.OutgoingHttpHeaders = {}
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`
      }
      if (bodyStr.length > 0) {
        headers['Content-Type'] = 'application/json'
        headers['Content-Length'] = Buffer.byteLength(bodyStr)
      }

      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method.toUpperCase(),
        headers,
        timeout: DEFAULT_TIMEOUT_MS
      }

      const req = lib.request(options, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) })
          } catch {
            resolve({ status: res.statusCode, data })
          }
        })
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error(`请求超时（${DEFAULT_TIMEOUT_MS / 1000}s）: ${method} ${path}`))
      })
      req.on('error', reject)
      if (bodyStr) req.write(bodyStr)
      req.end()
    })
  }
}