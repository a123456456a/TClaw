<template>
  <div class="tclaw-page session-page">
    <PageHeader
      title="Gateway 状态"
      description="轮询 Gateway 的 /v1/models 端点以检查服务状态与可用 Agent 列表。"
    >
      <template #actions>
        <el-button v-if="!polling" type="primary" size="small" @click="start">开始轮询</el-button>
        <el-button v-else type="warning" size="small" @click="stop">停止</el-button>
        <el-button size="small" @click="sessions.clearEvents">清空显示</el-button>
      </template>
    </PageHeader>

    <div class="meta-bar tclaw-panel">
      <span>路径：<code>{{ pathLabel }}</code></span>
      <span v-if="sessions.lastError" class="meta-bar__err">{{ sessions.lastError }}</span>
      <span v-if="gatewayOk" class="meta-bar__ok">Gateway 正常</span>
    </div>

    <div class="session-table-wrap">
      <el-table
        v-loading="sessions.loading"
        :data="tableRows"
        class="session-table"
        style="width: 100%"
        height="100%"
        empty-text="暂无数据，请确认 Gateway 已启动、Auth Token 正确、且 OpenAI 兼容端点已启用"
      >
      <el-table-column prop="at" label="时间" width="200" />
      <el-table-column prop="preview" label="内容摘要" show-overflow-tooltip />
    </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { useAppStore } from '@/stores/app'
import { useSessionsStore } from '@/stores/sessions'
import type { SessionEventItem } from '@/types'

const appStore = useAppStore()
const sessions = useSessionsStore()

const POLL_MS = 5000

const pollActive = ref(false)

const pathLabel = computed(() => appStore.settings.sessionsApiPath || '/v1/models')

const polling = computed(() => pollActive.value)

/** Gateway 最近一次请求是否成功 */
const gatewayOk = computed(() => !sessions.lastError && sessions.events.length > 0)

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
  const p = appStore.settings.sessionsApiPath || '/v1/models'
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
.session-page {
  min-height: 0;
}

.meta-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  padding: 10px 14px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--tclaw-text-muted);
}

.meta-bar code {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--tclaw-accent-muted);
  color: var(--tclaw-accent);
}

.meta-bar__err {
  color: var(--tclaw-danger);
}

.meta-bar__ok {
  color: var(--tclaw-success);
  font-weight: 600;
}

.session-table-wrap {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.session-table {
  border-radius: var(--tclaw-radius-md);
  overflow: hidden;
}
</style>
