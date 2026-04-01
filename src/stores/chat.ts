import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { ChatMessage } from '@/types'
import { useAppStore } from '@/stores/app'

/**
 * 从 Gateway 返回的 JSON 中提取助手回复文本。
 * 优先按 OpenAI Chat Completions 标准格式解析 `choices[0].message.content`，
 * 其次尝试 OpenResponses 格式 `output[].content[].text`，
 * 最后回退到通用字段名猜测。
 * @param raw - `api.request` 返回体中的 `data` 或整段对象
 */
export function extractAssistantText(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'string') return raw.trim() || raw
  if (typeof raw !== 'object') return String(raw)
  const o = raw as Record<string, unknown>

  if (o.choices && Array.isArray(o.choices) && o.choices[0]) {
    const c = o.choices[0] as Record<string, unknown>
    const msg = c.message as Record<string, unknown> | undefined
    if (msg && typeof msg.content === 'string') return msg.content
    if (c.delta && typeof (c.delta as Record<string, unknown>).content === 'string') {
      return (c.delta as Record<string, unknown>).content as string
    }
  }

  if (o.output && Array.isArray(o.output)) {
    const texts: string[] = []
    for (const item of o.output) {
      const it = item as Record<string, unknown>
      if (it.type === 'message' && Array.isArray(it.content)) {
        for (const part of it.content) {
          const p = part as Record<string, unknown>
          if (p.type === 'output_text' && typeof p.text === 'string') texts.push(p.text)
        }
      }
    }
    if (texts.length > 0) return texts.join('\n')
  }

  const keys = ['reply', 'message', 'content', 'text', 'answer', 'output', 'result']
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v
  }

  if (o.data !== undefined) return extractAssistantText(o.data)
  return JSON.stringify(o, null, 2)
}

/**
 * 聊天消息与发送逻辑，通过主进程 HTTP 转发至 Gateway。
 */
export const useChatStore = defineStore('chat', () => {
  const messages = shallowRef<ChatMessage[]>([])
  /** 多轮对话可选：若 Gateway 返回 sessionId 可写入以便下次携带 */
  const sessionId = ref<string>('')
  const sending = ref(false)

  /**
   * 追加一条本地消息。
   */
  function pushMessage(msg: Omit<ChatMessage, 'id' | 'at'> & { id?: string; at?: string }): void {
    const id = msg.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const at = msg.at ?? new Date().toISOString()
    messages.value = [...messages.value, { ...msg, id, at }]
  }

  /**
   * 清空聊天记录与可选的远端会话标识。
   */
  function clearChat(): void {
    messages.value = []
    sessionId.value = ''
  }

  /**
   * 将用户文本 POST 到 Gateway，并把回复追加为 assistant 消息。
   * @param text - 用户输入
   */
  async function send(text: string): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed || sending.value) return

    const app = useAppStore()
    app.loadSettings()

    pushMessage({ role: 'user', content: trimmed })
    sending.value = true

    const path = app.settings.chatApiPath?.trim() || '/v1/chat/completions'
    const isOpenAIPath = path.includes('/v1/chat/completions')
    const isResponsesPath = path.includes('/v1/responses')

    const historyMessages = messages.value
      .filter(m => m.role === 'user' || (m.role === 'assistant' && !m.error))
      .map(m => ({ role: m.role, content: m.content }))

    let body: Record<string, unknown>

    if (isOpenAIPath) {
      body = {
        model: app.settings.chatAgentId?.trim() || 'openclaw/default',
        messages: [...historyMessages, { role: 'user', content: trimmed }]
      }
      if (sessionId.value) body.user = sessionId.value
    } else if (isResponsesPath) {
      body = {
        model: app.settings.chatAgentId?.trim() || 'openclaw',
        input: trimmed
      }
      if (sessionId.value) body.user = sessionId.value
    } else {
      body = { message: trimmed, content: trimmed }
      const aid = app.settings.chatAgentId?.trim()
      if (aid) { body.agentId = aid; body.agent_id = aid }
      if (sessionId.value) { body.sessionId = sessionId.value; body.session_id = sessionId.value }
    }

    try {
      const res = (await window.tclaw.api.request('POST', path, body)) as {
        status?: number
        data?: unknown
      }
      const status = res.status ?? 0
      const payload = res.data

      if (status >= 400) {
        pushMessage({
          role: 'assistant',
          content: `请求失败 (HTTP ${status})：${typeof payload === 'string' ? payload : JSON.stringify(payload)}`,
          error: true
        })
        return
      }

      const reply = extractAssistantText(payload)
      pushMessage({
        role: 'assistant',
        content: reply || '（空回复）',
        error: false
      })

      if (payload && typeof payload === 'object') {
        const sid = (payload as Record<string, unknown>).sessionId ?? (payload as Record<string, unknown>).session_id
        if (typeof sid === 'string' && sid) sessionId.value = sid
      }
    } catch (e) {
      pushMessage({
        role: 'assistant',
        content: e instanceof Error ? e.message : String(e),
        error: true
      })
    } finally {
      sending.value = false
    }
  }

  return {
    messages,
    sessionId,
    sending,
    pushMessage,
    clearChat,
    send
  }
})
