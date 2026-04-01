<template>
  <div class="tclaw-page tclaw-page--scroll">
    <PageHeader
      title="渠道绑定"
      description="一键式配置 OpenClaw 消息渠道 — 填写凭证、选择 Agent、自动写入 openclaw.json（Gateway 热重载生效）。"
    >
      <template #actions>
        <el-button size="small" @click="reload">
          <el-icon><Refresh /></el-icon> 刷新状态
        </el-button>
      </template>
    </PageHeader>

    <!-- 已绑定渠道列表 -->
    <div v-if="boundChannels.length > 0" class="section-title">已绑定渠道</div>
    <div v-if="boundChannels.length > 0" class="bound-list">
      <div
        v-for="bc in boundChannels"
        :key="bc.key"
        class="bound-card tclaw-panel"
      >
        <div class="bound-card__head">
          <span class="bound-card__icon">{{ bc.def.icon }}</span>
          <span class="bound-card__name">{{ bc.def.label }}</span>
          <el-tag size="small" type="success" effect="dark">已启用</el-tag>
        </div>
        <div class="bound-card__info">
          <span v-if="bc.agentId">Agent: <code>{{ bc.agentId }}</code></span>
          <span v-if="bc.dmPolicy">策略: <code>{{ bc.dmPolicy }}</code></span>
        </div>
        <div class="bound-card__actions">
          <el-button v-if="bc.def.needsQR" size="small" @click="startLogin(bc.key, bc.def.label)">重新配对</el-button>
          <el-button size="small" type="danger" @click="unbind(bc.key)">解除绑定</el-button>
        </div>
      </div>
    </div>

    <!-- 可绑定渠道列表 -->
    <div class="section-title">{{ boundChannels.length > 0 ? '添加更多渠道' : '选择要绑定的渠道' }}</div>
    <div class="channel-grid">
      <div
        v-for="ch in availableChannels"
        :key="ch.key"
        class="channel-card tclaw-panel"
        :class="{ 'channel-card--selected': selected === ch.key }"
        @click="selectChannel(ch)"
      >
        <span class="channel-card__icon">{{ ch.icon }}</span>
        <span class="channel-card__label">{{ ch.label }}</span>
        <span class="channel-card__desc">{{ ch.shortDesc }}</span>
      </div>
    </div>

    <!-- 绑定表单对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="`绑定 ${currentDef?.label ?? ''}`"
      width="520px"
      destroy-on-close
      @closed="resetForm"
    >
      <div v-if="currentDef" class="bind-form">
        <el-alert
          v-if="currentDef.tip"
          :title="currentDef.tip"
          type="info"
          show-icon
          :closable="false"
          class="bind-tip"
        />

        <el-form label-width="110px">
          <el-form-item
            v-for="field in currentDef.fields"
            :key="field.key"
            :label="field.label"
            :required="field.required"
          >
            <el-select
              v-if="field.type === 'select'"
              v-model="formData[field.key]"
              style="width: 100%"
            >
              <el-option
                v-for="opt in field.options"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <el-input
              v-else
              v-model="formData[field.key]"
              :placeholder="field.placeholder ?? ''"
              :type="field.secret ? 'password' : 'text'"
              :show-password="field.secret"
            />
            <div v-if="field.hint" class="tclaw-hint">{{ field.hint }}</div>
          </el-form-item>

          <el-form-item label="绑定 Agent">
            <el-select v-model="bindAgentId" style="width: 100%" placeholder="可选 — 留空使用默认 Agent">
              <el-option label="（默认 Agent）" value="" />
              <el-option
                v-for="a in agentList"
                :key="a.id"
                :label="`${a.name || a.id} (${a.id})`"
                :value="String(a.id)"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="binding" @click="doBind">
          一键绑定
        </el-button>
      </template>
    </el-dialog>

    <!-- QR 扫码配对对话框 -->
    <el-dialog
      v-model="qrDialogVisible"
      :title="`${qrChannelLabel} — 扫码配对`"
      width="440px"
      :close-on-click-modal="false"
      @closed="stopLogin"
    >
      <div class="qr-body">
        <div v-if="qrStatus === 'waiting'" class="qr-waiting">
          <el-icon class="qr-spin"><Loading /></el-icon>
          <span>正在启动登录流程，等待 QR 码…</span>
          <span class="qr-sub">进程执行: <code>openclaw channels login --channel {{ qrChannelKey }}</code></span>
        </div>

        <!-- 方式 1：从原始 QR 数据渲染的高清图片 -->
        <div v-else-if="qrStatus === 'showing' && qrDataUrl" class="qr-display">
          <img :src="qrDataUrl" class="qr-image" alt="Scan QR" />
          <p class="qr-hint">请用手机扫描上方二维码完成配对</p>
        </div>

        <!-- 方式 2：终端方块画 QR（CLI 直接输出的 Unicode 方块字符，同样可扫描） -->
        <div v-else-if="qrStatus === 'showing' && terminalQR" class="qr-display">
          <div class="qr-terminal-art">{{ terminalQR }}</div>
          <p class="qr-hint">请用手机扫描上方二维码完成配对（终端方块画模式）</p>
        </div>

        <div v-else-if="qrStatus === 'success'" class="qr-success">
          <el-icon class="qr-ok"><SuccessFilled /></el-icon>
          <span>配对成功！渠道已上线。</span>
        </div>

        <div v-else-if="qrStatus === 'error'" class="qr-error">
          <span>{{ qrErrorMsg }}</span>
        </div>

        <!-- 进程输出日志 -->
        <div ref="qrLogRef" class="qr-log" :class="{ 'qr-log--expanded': qrStatus === 'waiting' }">
          <div v-for="(line, i) in qrLogLines" :key="i" class="qr-log-line">{{ line }}</div>
          <div v-if="qrLogLines.length === 0" class="qr-log-empty">等待进程输出…</div>
        </div>
      </div>

      <template #footer>
        <el-button @click="stopLogin(); qrDialogVisible = false">关闭</el-button>
        <el-button v-if="qrStatus !== 'waiting'" @click="restartLogin">重新获取</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, nextTick } from 'vue'
import { Refresh, Loading, SuccessFilled } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAgentsStore } from '@/stores/agents'

// ── 渠道定义 ─────────────────────────────────────────────────────

interface FieldDef {
  key: string
  label: string
  required?: boolean
  placeholder?: string
  hint?: string
  secret?: boolean
  type?: 'text' | 'select'
  options?: { label: string; value: string }[]
  defaultValue?: string
}

interface ChannelDef {
  key: string
  label: string
  icon: string
  shortDesc: string
  tip?: string
  /** 绑定后是否需要扫码配对（如 WhatsApp） */
  needsQR?: boolean
  fields: FieldDef[]
}

const DM_POLICY_OPTIONS = [
  { label: 'pairing（首次配对审批）', value: 'pairing' },
  { label: 'allowlist（白名单）', value: 'allowlist' },
  { label: 'open（开放）', value: 'open' },
  { label: 'disabled（关闭）', value: 'disabled' }
]

/**
 * 各渠道的配置模板，字段定义对齐 OpenClaw 官方配置格式。
 */
const CHANNEL_DEFS: ChannelDef[] = [
  {
    key: 'telegram',
    label: 'Telegram',
    icon: '✈️',
    shortDesc: 'Bot API（BotFather 创建）',
    tip: '在 Telegram 中 @BotFather → /newbot，获取 Bot Token。',
    fields: [
      { key: 'botToken', label: 'Bot Token', required: true, placeholder: '123456:ABC-DEF...', secret: true, hint: '从 @BotFather 获取' },
      { key: 'dmPolicy', label: 'DM 策略', type: 'select', options: DM_POLICY_OPTIONS, defaultValue: 'pairing' },
      { key: 'allowFrom', label: '允许的用户', placeholder: 'tg:123456（逗号分隔多个）', hint: 'Telegram 数字用户 ID，可加 tg: 前缀' }
    ]
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: '💬',
    shortDesc: 'WhatsApp Web（QR 配对）',
    needsQR: true,
    tip: '绑定后将在页面内显示 QR 码，用手机扫描即可完成配对。',
    fields: [
      { key: 'dmPolicy', label: 'DM 策略', type: 'select', options: DM_POLICY_OPTIONS, defaultValue: 'pairing' },
      { key: 'allowFrom', label: '允许的号码', placeholder: '+8613800138000（逗号分隔）', hint: '国际格式手机号（E.164）' }
    ]
  },
  {
    key: 'discord',
    label: 'Discord',
    icon: '🎮',
    shortDesc: 'Discord Bot',
    tip: '在 Discord Developer Portal 创建应用和 Bot，获取 Token。',
    fields: [
      { key: 'botToken', label: 'Bot Token', required: true, placeholder: 'MTIz...', secret: true, hint: 'Discord Developer Portal → Bot → Token' },
      { key: 'dmPolicy', label: 'DM 策略', type: 'select', options: DM_POLICY_OPTIONS, defaultValue: 'pairing' }
    ]
  },
  {
    key: 'slack',
    label: 'Slack',
    icon: '💼',
    shortDesc: 'Slack Bot（Socket Mode）',
    tip: '在 Slack API 创建应用，启用 Socket Mode，获取 App Token 和 Bot Token。',
    fields: [
      { key: 'appToken', label: 'App Token', required: true, placeholder: 'xapp-1-...', secret: true, hint: 'Slack App → Socket Mode → App Token' },
      { key: 'botToken', label: 'Bot Token', required: true, placeholder: 'xoxb-...', secret: true, hint: 'OAuth & Permissions → Bot User OAuth Token' },
      { key: 'dmPolicy', label: 'DM 策略', type: 'select', options: DM_POLICY_OPTIONS, defaultValue: 'pairing' }
    ]
  },
  {
    key: 'signal',
    label: 'Signal',
    icon: '🔒',
    shortDesc: 'Signal（signal-cli）',
    tip: '需先安装并配置 signal-cli，然后在此填写号码。',
    fields: [
      { key: 'number', label: 'Signal 号码', required: true, placeholder: '+8613800138000', hint: '已在 signal-cli 注册的号码' },
      { key: 'dmPolicy', label: 'DM 策略', type: 'select', options: DM_POLICY_OPTIONS, defaultValue: 'pairing' }
    ]
  },
  {
    key: 'msteams',
    label: 'MS Teams',
    icon: '🟦',
    shortDesc: 'Microsoft Teams Bot',
    tip: '在 Azure Portal 创建 Bot Framework 资源，获取 App ID 和密钥。',
    fields: [
      { key: 'appId', label: 'App ID', required: true, placeholder: 'xxxxxxxx-xxxx-...', hint: 'Azure Bot → Configuration → App ID' },
      { key: 'appPassword', label: 'App Password', required: true, placeholder: '...', secret: true },
      { key: 'dmPolicy', label: 'DM 策略', type: 'select', options: DM_POLICY_OPTIONS, defaultValue: 'pairing' }
    ]
  },
  {
    key: 'googlechat',
    label: 'Google Chat',
    icon: '📧',
    shortDesc: 'Google Workspace Chat',
    fields: [
      { key: 'dmPolicy', label: 'DM 策略', type: 'select', options: DM_POLICY_OPTIONS, defaultValue: 'pairing' }
    ]
  },
  {
    key: 'mattermost',
    label: 'Mattermost',
    icon: '🔵',
    shortDesc: 'Mattermost Bot',
    fields: [
      { key: 'botToken', label: 'Bot Token', required: true, placeholder: '...', secret: true },
      { key: 'url', label: '服务器 URL', required: true, placeholder: 'https://mattermost.example.com' },
      { key: 'dmPolicy', label: 'DM 策略', type: 'select', options: DM_POLICY_OPTIONS, defaultValue: 'pairing' }
    ]
  },
  {
    key: 'feishu',
    label: '飞书',
    icon: '🐦',
    shortDesc: '飞书机器人（Lark Bot）',
    tip: '在飞书开放平台创建应用，获取 App ID 和 App Secret；需启用机器人能力并配置事件订阅。',
    fields: [
      { key: 'appId', label: 'App ID', required: true, placeholder: 'cli_xxxxx', hint: '飞书开放平台 → 应用凭证 → App ID' },
      { key: 'appSecret', label: 'App Secret', required: true, placeholder: '...', secret: true, hint: '飞书开放平台 → 应用凭证 → App Secret' },
      { key: 'verificationToken', label: 'Verification Token', placeholder: '...', secret: true, hint: '事件订阅 → Verification Token（如有）' },
      { key: 'encryptKey', label: 'Encrypt Key', placeholder: '...', secret: true, hint: '事件订阅 → Encrypt Key（如有）' },
      { key: 'dmPolicy', label: 'DM 策略', type: 'select', options: DM_POLICY_OPTIONS, defaultValue: 'pairing' },
      { key: 'allowFrom', label: '允许的用户', placeholder: 'ou_xxxxx（逗号分隔）', hint: '飞书用户 Open ID，留空允许所有已配对用户' }
    ]
  },
  {
    key: 'wechat',
    label: '微信',
    icon: '🟢',
    shortDesc: '微信公众号 / 企业微信',
    tip: '支持微信公众号（服务号）或企业微信应用。填写对应平台的凭证。',
    fields: [
      { key: 'appId', label: 'AppID', required: true, placeholder: 'wx1234567890', hint: '公众号/企微应用的 AppID' },
      { key: 'appSecret', label: 'AppSecret', required: true, placeholder: '...', secret: true, hint: '公众号/企微应用的 AppSecret' },
      { key: 'token', label: 'Token', required: true, placeholder: '...', secret: true, hint: '服务器配置中的 Token（消息验证）' },
      { key: 'encodingAESKey', label: 'EncodingAESKey', placeholder: '...', secret: true, hint: '消息加解密密钥（如启用加密）' },
      { key: 'type', label: '类型', type: 'select', options: [
        { label: '公众号（服务号）', value: 'official' },
        { label: '企业微信', value: 'work' }
      ], defaultValue: 'official' },
      { key: 'dmPolicy', label: 'DM 策略', type: 'select', options: DM_POLICY_OPTIONS, defaultValue: 'allowlist' },
      { key: 'allowFrom', label: '允许的用户', placeholder: 'OpenID 或 UserID（逗号分隔）', hint: '留空则遵循 DM 策略默认规则' }
    ]
  },
  {
    key: 'qq',
    label: 'QQ Bot',
    icon: '🐧',
    shortDesc: 'QQ 官方机器人',
    tip: '在 QQ 开放平台（q.qq.com）创建机器人，获取 AppID 和 Token。支持 QQ 频道和 QQ 群。',
    fields: [
      { key: 'appId', label: 'AppID', required: true, placeholder: '102001234', hint: 'QQ 开放平台 → 应用管理 → AppID' },
      { key: 'token', label: 'Token', required: true, placeholder: '...', secret: true, hint: 'QQ 开放平台 → 应用管理 → Token' },
      { key: 'appSecret', label: 'AppSecret', required: true, placeholder: '...', secret: true, hint: 'QQ 开放平台 → 应用管理 → AppSecret' },
      { key: 'sandbox', label: '沙箱模式', type: 'select', options: [
        { label: '正式环境', value: 'false' },
        { label: '沙箱环境', value: 'true' }
      ], defaultValue: 'false' },
      { key: 'dmPolicy', label: 'DM 策略', type: 'select', options: DM_POLICY_OPTIONS, defaultValue: 'pairing' }
    ]
  }
]

// ── 状态 ─────────────────────────────────────────────────────────

const agents = useAgentsStore()
const agentList = computed(() => agents.list)

const selected = ref<string>('')
const dialogVisible = ref(false)
const binding = ref(false)
const currentDef = ref<ChannelDef | null>(null)
const formData = reactive<Record<string, string>>({})
const bindAgentId = ref('')

/** 从 openclaw.json 中读取到的当前配置 */
const openclawConfig = ref<Record<string, unknown> | null>(null)

/** 已绑定的渠道 */
const boundChannels = computed(() => {
  const cfg = openclawConfig.value
  if (!cfg) return []
  const channels = (cfg.channels ?? {}) as Record<string, unknown>
  const bindings = (cfg.bindings ?? []) as Record<string, unknown>[]

  return Object.keys(channels)
    .filter(k => {
      const ch = channels[k] as Record<string, unknown> | undefined
      return ch && ch.enabled !== false
    })
    .map(k => {
      const ch = channels[k] as Record<string, unknown>
      const def = CHANNEL_DEFS.find(d => d.key === k) ?? { key: k, label: k, icon: '📡', shortDesc: '', fields: [] }
      const matchedBinding = bindings.find(b => {
        const match = b.match as Record<string, unknown> | undefined
        return match?.channel === k
      })
      return {
        key: k,
        def,
        dmPolicy: ch.dmPolicy as string | undefined,
        agentId: (matchedBinding?.agentId as string) ?? ''
      }
    })
})

/** 尚未绑定的可选渠道 */
const availableChannels = computed(() => {
  const boundKeys = new Set(boundChannels.value.map(b => b.key))
  return CHANNEL_DEFS.filter(d => !boundKeys.has(d.key))
})

// ── 方法 ─────────────────────────────────────────────────────────

/**
 * 从 openclaw.json 加载当前配置。
 */
async function reload() {
  try {
    openclawConfig.value = await window.tclaw.config.getOpenClawConfig()
    await agents.fetchAgents()
  } catch {
    ElMessage.error('读取配置失败')
  }
}

/**
 * 选中一个渠道并打开绑定表单。
 * @param ch - 渠道定义
 */
function selectChannel(ch: ChannelDef) {
  selected.value = ch.key
  currentDef.value = ch
  Object.keys(formData).forEach(k => delete formData[k])
  for (const f of ch.fields) {
    formData[f.key] = f.defaultValue ?? ''
  }
  bindAgentId.value = ''
  dialogVisible.value = true
}

/** 重置表单 */
function resetForm() {
  selected.value = ''
  currentDef.value = null
  Object.keys(formData).forEach(k => delete formData[k])
}

/**
 * 执行一键绑定：将渠道配置与绑定写入 openclaw.json。
 */
async function doBind() {
  if (!currentDef.value) return

  const def = currentDef.value
  for (const f of def.fields) {
    if (f.required && !formData[f.key]?.trim()) {
      ElMessage.warning(`请填写 ${f.label}`)
      return
    }
  }

  binding.value = true
  try {
    const channelConfig: Record<string, unknown> = { enabled: true }
    for (const f of def.fields) {
      const val = formData[f.key]?.trim()
      if (!val) continue
      if (f.key === 'allowFrom') {
        channelConfig.allowFrom = val.split(/[,，\s]+/).filter(Boolean)
      } else {
        channelConfig[f.key] = val
      }
    }

    const patch: Record<string, unknown> = {
      channels: { [def.key]: channelConfig }
    }

    if (bindAgentId.value) {
      const existingBindings = ((openclawConfig.value?.bindings ?? []) as Record<string, unknown>[])
        .filter(b => {
          const match = b.match as Record<string, unknown> | undefined
          return match?.channel !== def.key
        })
      existingBindings.push({
        agentId: bindAgentId.value,
        match: { channel: def.key }
      })
      patch.bindings = existingBindings
    }

    const res = await window.tclaw.config.patchConfig(patch)
    if (!res.ok) {
      ElMessage.error(res.error ?? '写入配置失败')
      return
    }

    dialogVisible.value = false

    if (def.needsQR) {
      ElMessage.success(`${def.label} 配置已写入，正在启动扫码配对…`)
      await reload()
      await startLogin(def.key, def.label)
    } else {
      ElMessage.success(`${def.label} 绑定成功！Gateway 将自动热重载。`)
      await reload()
    }
  } finally {
    binding.value = false
  }
}

/**
 * 解除指定渠道的绑定（从 openclaw.json 中移除）。
 * @param channelKey - 渠道标识
 */
async function unbind(channelKey: string) {
  const def = CHANNEL_DEFS.find(d => d.key === channelKey)
  const name = def?.label ?? channelKey

  await ElMessageBox.confirm(
    `确定要解除 ${name} 的绑定吗？将从 openclaw.json 中移除该渠道配置。`,
    '解除绑定',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
  )

  const cfg = openclawConfig.value
  if (!cfg) return

  const channels = { ...((cfg.channels ?? {}) as Record<string, unknown>) }
  delete channels[channelKey]

  const bindings = ((cfg.bindings ?? []) as Record<string, unknown>[])
    .filter(b => {
      const match = b.match as Record<string, unknown> | undefined
      return match?.channel !== channelKey
    })

  const res = await window.tclaw.config.patchConfig({ channels, bindings })
  if (!res.ok) {
    ElMessage.error(res.error ?? '解除绑定失败')
    return
  }
  ElMessage.success(`${name} 已解除绑定`)
  await reload()
}

// ── QR 扫码配对 ─────────────────────────────────────────────────

const qrDialogVisible = ref(false)
const qrChannelLabel = ref('')
const qrChannelKey = ref('')
const qrStatus = ref<'waiting' | 'showing' | 'success' | 'error'>('waiting')
const qrDataUrl = ref<string | null>(null)
const qrRaw = ref('')
/** 终端方块画 QR（CLI 输出的 Unicode 方块字符拼成的 QR） */
const terminalQR = ref('')
const qrErrorMsg = ref('')
const qrLogLines = ref<string[]>([])
const qrLogRef = ref<HTMLElement | null>(null)

let unsubQR: (() => void) | null = null
let unsubTerminalQR: (() => void) | null = null
let unsubStatus: (() => void) | null = null
let unsubLog: (() => void) | null = null

/**
 * 启动扫码配对流程。
 * @param channelKey - 渠道标识
 * @param label - 渠道显示名
 */
async function startLogin(channelKey: string, label: string) {
  qrChannelKey.value = channelKey
  qrChannelLabel.value = label
  qrStatus.value = 'waiting'
  qrDataUrl.value = null
  qrRaw.value = ''
  terminalQR.value = ''
  qrErrorMsg.value = ''
  qrLogLines.value = []
  qrDialogVisible.value = true

  unsubQR = window.tclaw.on.channelLoginQR((data) => {
    qrRaw.value = data.raw
    qrDataUrl.value = data.dataUrl
    qrStatus.value = 'showing'
  })

  unsubTerminalQR = window.tclaw.on.channelLoginTerminalQR((art) => {
    terminalQR.value = art
    if (qrStatus.value !== 'showing' || !qrDataUrl.value) {
      qrStatus.value = 'showing'
    }
  })

  unsubStatus = window.tclaw.on.channelLoginStatus((data) => {
    if (data.status === 'success') {
      qrStatus.value = 'success'
      ElMessage.success(`${label} 配对成功！`)
    } else if (data.status === 'error') {
      qrStatus.value = 'error'
      qrErrorMsg.value = data.error ?? '配对过程出错'
    }
    qrLogLines.value.push(`[状态] ${data.status}`)
  })

  unsubLog = window.tclaw.on.channelLoginLog((msg) => {
    qrLogLines.value.push(msg.trimEnd())
    if (qrLogLines.value.length > 200) qrLogLines.value.splice(0, 50)
    nextTick(() => {
      qrLogRef.value?.scrollTo({ top: qrLogRef.value.scrollHeight })
    })
  })

  const res = await window.tclaw.channelLogin.start(channelKey)
  if (!res.ok) {
    qrStatus.value = 'error'
    qrErrorMsg.value = res.error ?? '启动登录进程失败'
  }
}

/**
 * 停止当前登录进程并清理事件监听。
 */
function stopLogin() {
  window.tclaw.channelLogin.stop()
  unsubQR?.()
  unsubTerminalQR?.()
  unsubStatus?.()
  unsubLog?.()
  unsubQR = null
  unsubTerminalQR = null
  unsubStatus = null
  unsubLog = null
}

/**
 * 重新获取 QR 码。
 */
async function restartLogin() {
  stopLogin()
  await startLogin(qrChannelKey.value, qrChannelLabel.value)
}

onMounted(reload)

onUnmounted(() => {
  stopLogin()
})
</script>

<style scoped>
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--tclaw-text-muted);
  margin-bottom: 12px;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── 已绑定 ─────────────────────────── */

.bound-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
}

.bound-card {
  padding: 14px 18px;
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bound-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bound-card__icon {
  font-size: 20px;
}

.bound-card__name {
  font-weight: 600;
  font-size: 14px;
  color: var(--tclaw-text);
  flex: 1;
}

.bound-card__info {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: 12px;
  color: var(--tclaw-text-muted);
}

.bound-card__info code {
  color: var(--tclaw-accent);
  background: var(--tclaw-accent-muted);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.bound-card__actions {
  margin-top: 2px;
}

/* ── 渠道卡片网格 ─────────────────────── */

.channel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.channel-card {
  cursor: pointer;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  transition: all 0.15s;
  border: 1px solid var(--tclaw-border);
}

.channel-card:hover {
  border-color: var(--tclaw-accent);
  background: var(--tclaw-accent-muted);
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(123, 157, 255, 0.12);
}

.channel-card--selected {
  border-color: var(--tclaw-accent);
  background: var(--tclaw-accent-muted);
}

.channel-card__icon {
  font-size: 28px;
  line-height: 1;
}

.channel-card__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--tclaw-text);
}

.channel-card__desc {
  font-size: 11px;
  color: var(--tclaw-text-muted);
  line-height: 1.4;
}

/* ── 表单 ─────────────────────── */

.bind-form {
  padding: 0 4px;
}

.bind-tip {
  margin-bottom: 16px;
}

/* ── QR 扫码 ─────────────────────── */

.qr-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.qr-waiting,
.qr-success,
.qr-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 0;
  font-size: 14px;
  color: var(--tclaw-text-muted);
}

.qr-spin {
  font-size: 28px;
  animation: spin 1.2s linear infinite;
  color: var(--tclaw-accent);
}

.qr-ok {
  font-size: 40px;
  color: var(--tclaw-success);
}

.qr-error {
  color: var(--tclaw-danger);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.qr-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.qr-image {
  width: 260px;
  height: 260px;
  border-radius: 12px;
  background: #fff;
  padding: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

.qr-sub {
  font-size: 11px;
  color: var(--tclaw-text-muted);
  opacity: 0.7;
}

.qr-sub code {
  background: var(--tclaw-accent-muted);
  color: var(--tclaw-accent);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
}

.qr-hint {
  font-size: 13px;
  color: var(--tclaw-text-muted);
}

.qr-terminal-art {
  background: #fff;
  color: #000;
  padding: 12px;
  border-radius: 12px;
  font-family: 'Courier New', 'Menlo', monospace;
  font-size: 4px;
  line-height: 4.5px;
  letter-spacing: 0;
  white-space: pre;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  user-select: none;
}

.qr-fallback {
  text-align: center;
  font-size: 12px;
  color: var(--tclaw-text-muted);
}

.qr-raw {
  display: block;
  margin-top: 8px;
  padding: 8px;
  background: var(--tclaw-bg-deep);
  border-radius: 6px;
  font-size: 10px;
  word-break: break-all;
  max-width: 360px;
}

.qr-log {
  width: 100%;
  max-height: 120px;
  overflow-y: auto;
  background: var(--tclaw-bg-deep);
  border-radius: 8px;
  padding: 8px 10px;
  font-family: ui-monospace, 'Cascadia Code', monospace;
  font-size: 11px;
  line-height: 1.5;
  color: var(--tclaw-text-muted);
}

.qr-log--expanded {
  max-height: 200px;
}

.qr-log-line {
  white-space: pre-wrap;
  word-break: break-all;
}

.qr-log-empty {
  color: var(--tclaw-text-muted);
  opacity: 0.5;
  font-style: italic;
}
</style>
