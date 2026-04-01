<template>
  <div class="page">
    <div class="page-header">
      <h2>设置</h2>
    </div>

    <el-form label-width="140px" class="form">
      <el-form-item label="OpenClaw 目录">
        <div class="row">
          <el-input v-model="appStore.settings.clawDir" placeholder="包含 agents/、gateway.yaml 的根目录" readonly />
          <el-button @click="pickDir">浏览</el-button>
        </div>
      </el-form-item>
      <el-form-item label="Gateway 地址">
        <el-input v-model="appStore.settings.gatewayUrl" placeholder="http://localhost:3000" />
      </el-form-item>
      <el-form-item label="会话 API 路径">
        <el-input v-model="appStore.settings.sessionsApiPath" placeholder="/api/sessions" />
        <div class="hint">会话监控页会对此路径发起 GET，请与 Gateway 实际路由一致。</div>
      </el-form-item>
      <el-form-item label="日志文件路径">
        <div class="row">
          <el-input v-model="appStore.settings.logPath" placeholder="可选：外部日志文件绝对路径" />
          <el-button @click="pickLogFile">选择文件</el-button>
        </div>
      </el-form-item>
      <el-form-item label="启动时自动拉起">
        <el-switch v-model="appStore.settings.autoStart" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="saveAll">保存</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { ElMessage } from 'element-plus'

const appStore = useAppStore()
const saving = ref(false)

/**
 * 打开目录选择并将结果写入主进程配置目录监听。
 */
async function pickDir() {
  const dir = await window.tclaw.dialog.openDir()
  if (dir) {
    appStore.settings.clawDir = dir
    const r = await window.tclaw.config.setDir(dir)
    if (!r.ok) ElMessage.error('设置配置目录失败')
  }
}

/**
 * 通过系统对话框选择日志文件并写入设置。
 */
async function pickLogFile() {
  const p = await window.tclaw.dialog.openFile()
  if (p) appStore.settings.logPath = p
}

/**
 * 持久化本地设置并同步 Gateway 与配置目录。
 */
async function saveAll() {
  saving.value = true
  try {
    appStore.saveSettings()
    if (appStore.settings.gatewayUrl) {
      await window.tclaw.api.setBase(appStore.settings.gatewayUrl)
    }
    if (appStore.settings.clawDir) {
      const r = await window.tclaw.config.setDir(appStore.settings.clawDir)
      if (!r.ok) {
        ElMessage.error('同步配置目录失败')
        return
      }
    }
    ElMessage.success('已保存')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  appStore.loadSettings()
  if (appStore.settings.gatewayUrl) {
    void window.tclaw.api.setBase(appStore.settings.gatewayUrl)
  }
  if (appStore.settings.clawDir) {
    void window.tclaw.config.setDir(appStore.settings.clawDir)
  }
})
</script>

<style scoped>
.page { padding: 24px; height: 100%; overflow-y: auto; }
.page-header { margin-bottom: 16px; }
.page-header h2 { font-size: 18px; color: #e0e0e0; }
.form { max-width: 640px; }
.row { display: flex; gap: 8px; width: 100%; }
.row .el-input { flex: 1; }
.hint { font-size: 12px; color: #888; margin-top: 4px; }
</style>
