<template>
  <div class="tclaw-page tclaw-page--scroll">
    <PageHeader
      title="设置"
      description="Gateway 可指向本机或远程服务器；OpenClaw 目录与侧栏「启动」仅用于在本机拉起 openclaw gateway。"
    />

    <el-form label-width="150px" class="form tclaw-panel form-card">
      <el-form-item label="OpenClaw 目录">
        <div class="row">
          <el-input v-model="appStore.settings.clawDir" placeholder="包含 openclaw.json 或 agents/ 的目录（也可以是 ~/.openclaw）" readonly />
          <el-button @click="pickDir">浏览</el-button>
        </div>
      </el-form-item>
      <el-form-item label="Gateway 地址">
        <el-input
          v-model="appStore.settings.gatewayUrl"
          placeholder="http://localhost:18789"
        />
        <div class="tclaw-hint">
          OpenClaw Gateway 默认端口 <code>18789</code>。聊天、状态查询等请求均由主进程 HTTP 转发（无浏览器 CORS）。远程部署时填写完整 URL 并确保网络可达。
        </div>
      </el-form-item>
      <el-form-item label="Gateway Token">
        <el-input
          v-model="appStore.settings.gatewayToken"
          placeholder="gateway.auth.token 或 OPENCLAW_GATEWAY_TOKEN 的值"
          show-password
          clearable
        />
        <div class="tclaw-hint">
          对应 OpenClaw 的 <code>gateway.auth.token</code> 配置。留空则不发送 Authorization 头（仅 loopback 且 auth 关闭时可省略）。
        </div>
      </el-form-item>
      <el-form-item label="状态查询路径">
        <el-input v-model="appStore.settings.sessionsApiPath" placeholder="/v1/models" />
        <div class="tclaw-hint">Gateway 状态页对此路径 GET 轮询。默认 <code>/v1/models</code>（需在 Gateway 启用 OpenAI 兼容端点）。</div>
      </el-form-item>
      <el-form-item label="聊天 API 路径">
        <el-input v-model="appStore.settings.chatApiPath" placeholder="/v1/chat/completions" />
        <div class="tclaw-hint">聊天页 POST 此路径。默认 <code>/v1/chat/completions</code>（OpenAI 兼容），也可使用 <code>/v1/responses</code>（OpenResponses）。</div>
      </el-form-item>
      <el-form-item label="聊天 Agent 目标">
        <el-input v-model="appStore.settings.chatAgentId" placeholder="openclaw/default" clearable />
        <div class="tclaw-hint">
          填入 OpenAI model 字段值：<code>openclaw/default</code>（默认 Agent）或 <code>openclaw/&lt;agentId&gt;</code>（指定 Agent）。
        </div>
      </el-form-item>
      <el-form-item label="日志文件路径">
        <div class="row">
          <el-input v-model="appStore.settings.logPath" placeholder="可选：外部日志文件绝对路径" />
          <el-button @click="pickLogFile">选择文件</el-button>
        </div>
      </el-form-item>
      <el-form-item label="启动时自动拉起">
        <el-switch v-model="appStore.settings.autoStart" />
        <div class="tclaw-hint">打开后，应用启动时会自动在 OpenClaw 目录执行 <code>openclaw gateway</code>。</div>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="saveAll">保存</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
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
 * 持久化本地设置并同步 Gateway 基地址、Token 与配置目录。
 */
async function saveAll() {
  saving.value = true
  try {
    appStore.saveSettings()
    if (appStore.settings.gatewayUrl) {
      await window.tclaw.api.setBase(appStore.settings.gatewayUrl)
    }
    await window.tclaw.api.setToken(appStore.settings.gatewayToken ?? '')
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
  if (appStore.settings.gatewayToken) {
    void window.tclaw.api.setToken(appStore.settings.gatewayToken)
  }
  if (appStore.settings.clawDir) {
    void window.tclaw.config.setDir(appStore.settings.clawDir)
  }
})
</script>

<style scoped>
.form {
  max-width: 680px;
  padding: 1.25rem 1.35rem 1rem;
}

.form-card {
  border-radius: var(--tclaw-radius-md);
}

.row { display: flex; gap: 8px; width: 100%; }
.row .el-input { flex: 1; }
</style>
