<template>
  <div class="tclaw-page chat-page">
    <PageHeader
      title="聊天"
      description="向 Gateway 发送消息并展示回复；路径与 Agent 在「设置」中配置。"
    >
      <template #actions>
        <el-button size="small" :disabled="chat.sending" @click="chat.clearChat">清空记录</el-button>
      </template>
    </PageHeader>

    <p class="chat-hint">
      当前接口：<code>{{ chatPathLabel }}</code>
    </p>

    <div ref="scrollRef" class="chat-messages tclaw-panel">
      <div v-if="chat.messages.length === 0" class="chat-empty">输入内容开始对话（需先启动 OpenClaw 并保证 Gateway 可访问）。</div>
      <div
        v-for="m in chat.messages"
        :key="m.id"
        class="chat-row"
        :class="`chat-row--${m.role}`"
      >
        <div class="chat-bubble" :class="{ 'chat-bubble--err': m.error }">
          <span class="chat-role">{{ roleLabel(m.role) }}</span>
          <div class="chat-text">{{ m.content }}</div>
          <span class="chat-time">{{ formatTime(m.at) }}</span>
        </div>
      </div>
    </div>

    <div class="chat-input-bar">
      <el-input
        v-model="draft"
        type="textarea"
        :rows="3"
        resize="none"
        placeholder="输入消息，Enter 发送（Shift+Enter 换行）"
        :disabled="chat.sending"
        @keydown="onKeydown"
      />
      <el-button
        type="primary"
        class="chat-send"
        :loading="chat.sending"
        :disabled="!draft.trim()"
        @click="submit"
      >
        发送
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { useAppStore } from '@/stores/app'
import { useChatStore } from '@/stores/chat'
import type { ChatMessage } from '@/types'

const appStore = useAppStore()
const chat = useChatStore()
const draft = ref('')
const scrollRef = ref<HTMLElement | null>(null)

const chatPathLabel = computed(() => appStore.settings.chatApiPath || '/api/chat')

/**
 * 角色展示文案。
 * @param role - 消息角色
 */
function roleLabel(role: ChatMessage['role']): string {
  if (role === 'user') return '我'
  if (role === 'assistant') return '助手'
  return '系统'
}

/**
 * ISO 时间格式化为本地短字符串。
 * @param at - ISO 字符串
 */
function formatTime(at: string): string {
  try {
    const d = new Date(at)
    return d.toLocaleString()
  } catch {
    return at
  }
}

/**
 * 提交当前输入框内容。
 */
async function submit() {
  const t = draft.value
  if (!t.trim() || chat.sending) return
  draft.value = ''
  await chat.send(t)
}

/**
 * Enter 发送，Shift+Enter 换行。
 */
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' || e.shiftKey) return
  e.preventDefault()
  void submit()
}

/**
 * 新消息后滚动到底部。
 */
watch(
  () => chat.messages.length,
  async () => {
    await nextTick()
    scrollRef.value?.scrollTo({ top: scrollRef.value.scrollHeight, behavior: 'smooth' })
  }
)

onMounted(() => {
  appStore.loadSettings()
  if (appStore.settings.gatewayUrl) {
    void window.tclaw.api.setBase(appStore.settings.gatewayUrl)
  }
  if (appStore.settings.gatewayToken) {
    void window.tclaw.api.setToken(appStore.settings.gatewayToken)
  }
})
</script>

<style scoped>
.chat-page {
  min-height: 0;
}

.chat-hint {
  font-size: 12px;
  color: var(--tclaw-text-muted);
  margin-bottom: 12px;
  line-height: 1.5;
}

.chat-hint code {
  color: var(--tclaw-accent);
  background: var(--tclaw-accent-muted);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
}

.chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--tclaw-bg-deep);
}

.chat-empty {
  color: var(--tclaw-text-muted);
  opacity: 0.85;
  font-size: 13px;
  text-align: center;
  padding: 32px 16px;
}

.chat-row {
  display: flex;
  width: 100%;
}

.chat-row--user {
  justify-content: flex-end;
}

.chat-row--assistant,
.chat-row--system {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: min(92%, 640px);
  padding: 12px 16px;
  border-radius: 14px;
  background: var(--tclaw-surface-elevated);
  border: 1px solid var(--tclaw-border);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.chat-row--user .chat-bubble {
  background: linear-gradient(145deg, rgba(30, 36, 80, 0.95) 0%, rgba(26, 26, 56, 0.9) 100%);
  border-color: var(--tclaw-border-strong);
}

.chat-bubble--err {
  border-color: rgba(245, 108, 108, 0.45);
  background: rgba(42, 21, 24, 0.85);
}

.chat-role {
  display: block;
  font-size: 11px;
  color: var(--tclaw-accent);
  margin-bottom: 6px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.chat-row--user .chat-role {
  color: var(--tclaw-accent-hover);
}

.chat-text {
  font-size: 14px;
  color: var(--tclaw-text);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.55;
}

.chat-time {
  display: block;
  font-size: 10px;
  color: var(--tclaw-text-muted);
  margin-top: 8px;
  opacity: 0.85;
}

.chat-input-bar {
  flex-shrink: 0;
  margin-top: 14px;
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.chat-input-bar :deep(.el-textarea__inner) {
  border-radius: var(--tclaw-radius-md);
}

.chat-send {
  min-width: 88px;
}
</style>
