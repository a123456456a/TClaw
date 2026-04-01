<template>
  <div class="app-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <span class="logo-icon">🦀</span>
        <span class="logo-text">TClaw</span>
      </div>

      <nav class="sidebar-nav">
        <router-link
          v-for="route in navRoutes"
          :key="route.path"
          :to="route.path"
          class="nav-item"
          active-class="nav-item--active"
        >
          <el-icon><component :is="route.meta?.icon" /></el-icon>
          <span>{{ route.meta?.title }}</span>
        </router-link>
      </nav>

      <!-- Status indicator -->
      <div class="sidebar-status">
        <div class="status-dot" :style="{ background: appStore.statusColor }" />
        <span class="status-label">{{ statusLabel }}</span>
        <div class="status-actions">
          <el-button
            v-if="!appStore.isRunning"
            size="small"
            type="success"
            :loading="appStore.clawStatus === 'starting'"
            @click="startClaw"
          >
            启动
          </el-button>
          <el-button
            v-else
            size="small"
            type="danger"
            @click="stopClaw"
          >
            停止
          </el-button>
          <el-button
            v-if="appStore.isRunning"
            size="small"
            @click="restartClaw"
          >
            重启
          </el-button>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
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
  starting: '启动中...',
  running: '运行中',
  error: '异常'
}[appStore.clawStatus]))

// Listen for IPC events
let unsubLog: (() => void) | null = null
let unsubStatus: (() => void) | null = null

onMounted(() => {
  appStore.loadSettings()

  if (appStore.settings.clawDir) {
    void window.tclaw.config.setDir(appStore.settings.clawDir)
  }
  if (appStore.settings.gatewayUrl) {
    void window.tclaw.api.setBase(appStore.settings.gatewayUrl)
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
})

onUnmounted(() => {
  unsubLog?.()
  unsubStatus?.()
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

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #0d0d1a;
  color: #e0e0e0;
  font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  overflow: hidden;
  height: 100vh;
}

#app { height: 100vh; }

.app-layout {
  display: flex;
  height: 100vh;
}

/* ── Sidebar ─────────────────────────────────────── */
.sidebar {
  width: 200px;
  min-width: 200px;
  background: #12122a;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #1e1e3a;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 16px 16px;
  border-bottom: 1px solid #1e1e3a;
}

.logo-icon { font-size: 22px; }
.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: #7b9dff;
  letter-spacing: 1px;
}

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 6px;
  color: #888;
  text-decoration: none;
  font-size: 13px;
  transition: all 0.15s;
}

.nav-item:hover { background: #1a1a38; color: #ccc; }
.nav-item--active { background: #1e2450; color: #7b9dff; }
.nav-item .el-icon { font-size: 16px; }

/* ── Status bar ──────────────────────────────────── */
.sidebar-status {
  padding: 14px 12px;
  border-top: 1px solid #1e1e3a;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 6px;
}

.status-label {
  font-size: 12px;
  color: #aaa;
}

.status-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* ── Main ────────────────────────────────────────── */
.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Element Plus dark overrides ─────────────────── */
.el-button { border-radius: 5px; }
</style>