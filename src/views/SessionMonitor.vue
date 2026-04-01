<template>
  <div class="page">
    <div class="page-header">
      <h2>会话监控</h2>
      <div class="actions">
        <el-button v-if="!polling" type="primary" size="small" @click="start">开始轮询</el-button>
        <el-button v-else type="warning" size="small" @click="stop">停止</el-button>
        <el-button size="small" @click="sessions.clearEvents">清空显示</el-button>
      </div>
    </div>

    <div class="meta">
      <span>路径：{{ pathLabel }}</span>
      <span v-if="sessions.lastError" class="err">{{ sessions.lastError }}</span>
    </div>

    <el-table
      v-loading="sessions.loading"
      :data="tableRows"
      style="width: 100%"
      height="calc(100vh - 200px)"
      empty-text="暂无数据，请确认 Gateway 已启动且路径正确"
    >
      <el-table-column prop="at" label="时间" width="200" />
      <el-table-column prop="preview" label="内容摘要" show-overflow-tooltip />
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useSessionsStore } from '@/stores/sessions'
import type { SessionEventItem } from '@/types'

const appStore = useAppStore()
const sessions = useSessionsStore()

const POLL_MS = 4000

const pollActive = ref(false)

const pathLabel = computed(() => appStore.settings.sessionsApiPath || '/api/sessions')

const polling = computed(() => pollActive.value)

/**
 * 将事件压缩为表格行展示。
 */
const tableRows = computed(() =>
  sessions.events.map((e: SessionEventItem) => ({
    at: e.at,
    preview: typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload)
  }))
)

/**
 * 开始按设置中的路径轮询 Gateway。
 */
function start() {
  appStore.loadSettings()
  const p = appStore.settings.sessionsApiPath || '/api/sessions'
  sessions.startPolling(p, POLL_MS)
  pollActive.value = true
}

/**
 * 停止轮询。
 */
function stop() {
  sessions.stopPolling()
  pollActive.value = false
}

onMounted(() => {
  appStore.loadSettings()
})

onUnmounted(() => {
  stop()
})
</script>

<style scoped>
.page { padding: 24px; height: 100%; display: flex; flex-direction: column; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.page-header h2 { font-size: 18px; color: #e0e0e0; }
.actions { display: flex; gap: 8px; }
.meta { font-size: 12px; color: #888; margin-bottom: 8px; display: flex; gap: 16px; }
.err { color: #f56c6c; }
</style>
