import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { SessionEventItem } from '@/types'

/**
 * 会话监控：通过主进程 HTTP 转发轮询 Gateway，展示最近事件。
 */
export const useSessionsStore = defineStore('sessions', () => {
  const events = shallowRef<SessionEventItem[]>([])
  const loading = ref(false)
  const lastError = ref<string | null>(null)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  /**
   * 将 Gateway 返回解析为事件列表（数组则逐项，否则包装为单条）。
   * @param raw - HTTP 响应中的 `data` 字段
   */
  function normalizePayload(raw: unknown): SessionEventItem[] {
    const now = new Date().toISOString()
    if (Array.isArray(raw)) {
      return raw.map((item, i) => ({
        id: `${now}-${i}`,
        at: now,
        payload: item
      }))
    }
    if (raw && typeof raw === 'object') {
      return [{ id: now, at: now, payload: raw }]
    }
    return [{ id: now, at: now, payload: raw }]
  }

  /**
   * 单次拉取会话数据。
   * @param path - 相对 Gateway 的路径
   */
  async function fetchOnce(path: string): Promise<void> {
    loading.value = true
    lastError.value = null
    try {
      const res = (await window.tclaw.api.request('GET', path)) as {
        status?: number
        data?: unknown
      }
      if (res.status && res.status >= 400) {
        lastError.value = `HTTP ${res.status}`
        return
      }
      events.value = normalizePayload(res.data)
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  /**
   * 开始定时轮询。
   * @param path - API 路径
   * @param intervalMs - 间隔毫秒
   */
  function startPolling(path: string, intervalMs: number): void {
    stopPolling()
    void fetchOnce(path)
    pollTimer = setInterval(() => {
      void fetchOnce(path)
    }, intervalMs)
  }

  /**
   * 停止轮询。
   */
  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  /**
   * 清空展示列表。
   */
  function clearEvents(): void {
    events.value = []
  }

  return {
    events,
    loading,
    lastError,
    fetchOnce,
    startPolling,
    stopPolling,
    clearEvents
  }
})
