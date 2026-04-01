import http from 'http'
import https from 'https'

/**
 * 通过主进程向 OpenClaw Gateway 发起 HTTP 请求，避免渲染进程 CORS。
 */
export class ApiClientService {
  private baseUrl: string = 'http://localhost:3000'

  /**
   * @param baseUrl - Gateway 根地址，例如 `http://localhost:3000`
   */
  setBase(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /**
   * @param method - HTTP 方法
   * @param path - 以 `/` 开头的路径
   * @param body - 可选 JSON 请求体
   */
  request(method: string, path: string, body?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${path}`)
      const isHttps = url.protocol === 'https:'
      const lib = isHttps ? https : http

      const bodyStr = body !== undefined && body !== null ? JSON.stringify(body) : ''
      const headers: http.OutgoingHttpHeaders = {}
      if (bodyStr.length > 0) {
        headers['Content-Type'] = 'application/json'
        headers['Content-Length'] = Buffer.byteLength(bodyStr)
      }

      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method.toUpperCase(),
        headers
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

      req.on('error', reject)
      if (bodyStr) req.write(bodyStr)
      req.end()
    })
  }
}