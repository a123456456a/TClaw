<template>
  <div class="tclaw-page log-page">
    <PageHeader
      title="日志与告警"
      description="查看进程输出；可订阅外部日志文件并设置过滤与告警关键字。"
    >
      <template #actions>
        <el-input
          v-model="keyword"
          size="small"
          clearable
          placeholder="过滤关键字"
          style="width: 160px"
          @input="applyFilter"
        />
        <el-input
          v-model="alertRule"
          size="small"
          clearable
          placeholder="告警关键字（高亮）"
          style="width: 200px"
        />
        <el-button size="small" @click="useFileWatch">订阅文件日志</el-button>
        <el-button size="small" @click="stopFileWatch">取消订阅</el-button>
        <el-button size="small" @click="clear">清空</el-button>
      </template>
    </PageHeader>

    <div ref="logBox" class="log-box tclaw-panel">
      <div
        v-for="(line, i) in displayLines"
        :key="i"
        class="log-line"
        :class="{ alert: isAlert(line) }"
      >{{ line }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { useAppStore } from '@/stores/app'
import { ElMessage } from 'element-plus'

const appStore = useAppStore()
const keyword = ref('')
const alertRule = ref('')
const filterCache = ref('')

const logBox = ref<HTMLElement | null>(null)

/**
 * 根据关键字过滤后的行列表。
 */
const displayLines = computed(() => {
  const lines = appStore.logLines
  const k = filterCache.value.trim()
  if (!k) return lines
  return lines.filter((l) => l.includes(k))
})

/**
 * 输入防抖后的过滤应用。
 */
function applyFilter() {
  filterCache.value = keyword.value
}

/**
 * 判断一行是否命中告警规则。
 * @param line - 日志行文本
 */
function isAlert(line: string): boolean {
  const r = alertRule.value.trim()
  return r.length > 0 && line.includes(r)
}

/**
 * 根据设置中的 logPath 调用主进程 tail。
 */
async function useFileWatch() {
  appStore.loadSettings()
  const p = appStore.settings.logPath?.trim()
  if (!p) {
    ElMessage.warning('请先在设置中填写日志文件路径')
    return
  }
  const res = await window.tclaw.log.watch(p)
  if (!res.ok) ElMessage.error(res.error ?? '订阅失败')
  else ElMessage.success('已开始订阅文件日志')
}

/**
 * 取消文件 tail 订阅。
 */
async function stopFileWatch() {
  await window.tclaw.log.unwatch()
  ElMessage.info('已取消文件订阅')
}

/**
 * 清空内存中的进程日志缓冲。
 */
function clear() {
  appStore.clearLogs()
}

watch(
  () => appStore.logLines.length,
  async () => {
    await nextTick()
    logBox.value?.scrollTo({ top: logBox.value.scrollHeight, behavior: 'smooth' })
  }
)

onMounted(() => {
  appStore.loadSettings()
})
</script>

<style scoped>
.log-page {
  min-height: 0;
}

.log-box {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 16px;
  font-family: ui-monospace, 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.55;
  color: var(--tclaw-text-muted);
  background: var(--tclaw-bg-deep);
}

.log-line { white-space: pre-wrap; word-break: break-all; }
.log-line.alert { color: var(--tclaw-danger); font-weight: 600; }
</style>
