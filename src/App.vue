<template>
  <div class="tclaw-app flex h-screen min-h-0">
    <aside
      class="flex w-60 min-w-60 flex-col border-r border-tclaw-border bg-gradient-to-b from-[#0e1020] via-[#0a0c18] to-[#080a14] shadow-[4px_0_24px_rgba(0,0,0,0.25)]"
    >
      <div class="flex items-center gap-3 border-b border-tclaw-border px-[18px] pb-[18px] pt-[22px]">
        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-tclaw-border-strong bg-gradient-to-br from-tclaw-accent/25 to-[rgba(30,36,80,0.9)] shadow-[0_4px_16px_rgba(123,157,255,0.12)]"
          aria-hidden="true"
        >
          <span class="text-2xl leading-none">🦀</span>
        </div>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span
            class="bg-gradient-to-r from-[#c5d4ff] from-0% via-tclaw-accent via-55% to-[#6b8cff] to-100% bg-clip-text text-[1.15rem] font-extrabold tracking-[0.06em] text-transparent"
          >
            TClaw
          </span>
          <span class="text-[11px] tracking-wide text-tclaw-text-muted">OpenClaw 控制台</span>
        </div>
      </div>

      <nav class="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 py-3.5" aria-label="主导航">
        <router-link
          v-for="route in navRoutes"
          :key="route.path"
          :to="route.path"
          class="tclaw-nav-link"
          active-class="tclaw-nav-link--active"
        >
          <el-icon class="size-[18px] shrink-0">
            <component :is="route.meta?.icon" />
          </el-icon>
          <span class="min-w-0 flex-1">{{ route.meta?.title }}</span>
        </router-link>
      </nav>

      <div class="flex flex-col gap-2.5 border-t border-tclaw-border px-3 pb-[18px] pt-3.5">
        <div class="flex items-center gap-2 text-xs text-tclaw-text-muted">
          <span
            class="size-2 shrink-0 rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.06)]"
            :style="{ background: appStore.statusColor }"
          />
          <span>{{ statusLabel }}</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <el-button
            v-if="!appStore.isRunning"
            size="small"
            type="success"
            round
            :loading="appStore.clawStatus === 'starting'"
            @click="startClaw"
          >
            启动
          </el-button>
          <el-button v-else size="small" type="danger" round @click="stopClaw">停止</el-button>
          <el-button v-if="appStore.isRunning" size="small" round @click="restartClaw">重启</el-button>
        </div>
      </div>
    </aside>

    <main
      class="flex min-h-0 min-w-0 flex-1 flex-col bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(123,157,255,0.12),transparent_55%),linear-gradient(180deg,var(--color-tclaw-bg)_0%,var(--color-tclaw-bg-deep)_100%)]"
    >
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { ElMessage } from 'element-plus'

const appStore = useAppStore()
const router = useRouter()

const navRoutes = computed(() =>
  router.options.routes.filter(r => r.meta?.title)
)

const statusLabel = computed(() => ({
  stopped: '未运行',
  starting: '启动中…',
  running: '运行中',
  error: '异常'
}[appStore.clawStatus]))

let unsubLog: (() => void) | null = null
let unsubStatus: (() => void) | null = null
let unsubConfig: (() => void) | null = null

onMounted(() => {
  appStore.loadSettings()

  if (appStore.settings.clawDir) {
    void window.tclaw.config.setDir(appStore.settings.clawDir)
  }
  if (appStore.settings.gatewayUrl) {
    void window.tclaw.api.setBase(appStore.settings.gatewayUrl)
  }
  if (appStore.settings.gatewayToken) {
    void window.tclaw.api.setToken(appStore.settings.gatewayToken)
  }

  if (appStore.settings.autoStart && appStore.settings.clawDir) {
    void window.tclaw.claw.start(appStore.settings.clawDir)
  }

  unsubLog = window.tclaw.on.log((msg) => {
    appStore.appendLog(msg)
  })

  unsubStatus = window.tclaw.on.clawStatus((status) => {
    appStore.setStatus(status)
  })

  unsubConfig = window.tclaw.on.configChanged((filePath) => {
    appStore.appendLog(`[CONFIG] 文件变更：${filePath}`)
  })
})

onUnmounted(() => {
  unsubLog?.()
  unsubStatus?.()
  unsubConfig?.()
})

async function startClaw() {
  if (!appStore.settings.clawDir) {
    ElMessage.warning('请先在设置中配置 OpenClaw 目录')
    router.push('/settings')
    return
  }
  const res = await window.tclaw.claw.start(appStore.settings.clawDir)
  if (!res.ok) ElMessage.error(`启动失败: ${res.error}`)
}

async function stopClaw() {
  await window.tclaw.claw.stop()
}

async function restartClaw() {
  const res = await window.tclaw.claw.restart()
  if (!res.ok) ElMessage.error(`重启失败: ${res.error}`)
}
</script>
