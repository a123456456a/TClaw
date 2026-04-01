<template>
  <div class="page">
    <div class="page-header">
      <h2>渠道绑定</h2>
      <div class="actions">
        <el-button size="small" @click="reload">重新加载</el-button>
        <el-button type="primary" size="small" :loading="saving" @click="save">保存到 gateway.yaml</el-button>
      </div>
    </div>

    <p v-if="hint" class="hint">{{ hint }}</p>

    <el-table :data="bindings" style="width: 100%" empty-text="暂无绑定，可点击下方添加">
      <el-table-column prop="platform" label="平台" width="120">
        <template #default="{ row }">
          <el-select v-model="row.platform" size="small" style="width: 100px">
            <el-option label="飞书" value="feishu" />
            <el-option label="微信" value="wechat" />
            <el-option label="QQ" value="qq" />
            <el-option label="钉钉" value="dingtalk" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column prop="agentId" label="Agent ID">
        <template #default="{ row }">
          <el-input v-model="row.agentId" size="small" placeholder="对应 agents 中的 id" />
        </template>
      </el-table-column>
      <el-table-column prop="accountId" label="账号 ID">
        <template #default="{ row }">
          <el-input v-model="row.accountId" size="small" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90">
        <template #default="{ $index }">
          <el-button type="danger" link size="small" @click="removeRow($index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="toolbar">
      <el-button size="small" @click="addRow">添加一行</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { ChannelBinding, GatewayConfig } from '@/types'
import { ElMessage } from 'element-plus'

const gateway = ref<GatewayConfig>({})
const bindings = ref<ChannelBinding[]>([])
const saving = ref(false)
const hint = ref('')

/**
 * 从主进程读取 gateway 配置并填充表格。
 */
async function reload() {
  hint.value = ''
  try {
    const g = (await window.tclaw.config.getGateway()) as GatewayConfig | null
    gateway.value = g && typeof g === 'object' ? { ...g } : {}
    const list = gateway.value.bindings
    bindings.value = Array.isArray(list) ? list.map((b) => ({ ...b })) : []
    if (!gateway.value || Object.keys(gateway.value).length === 0) {
      hint.value = '未找到 gateway.yaml，保存将创建新文件。'
    }
  } catch {
    ElMessage.error('加载配置失败')
  }
}

/**
 * 追加一条空绑定行。
 */
function addRow() {
  bindings.value.push({
    platform: 'feishu',
    agentId: '',
    accountId: ''
  })
}

/**
 * 删除指定索引的绑定行。
 * @param index - 表格行索引
 */
function removeRow(index: number) {
  bindings.value.splice(index, 1)
}

/**
 * 将当前表格写回 gateway.yaml。
 */
async function save() {
  saving.value = true
  try {
    const next: GatewayConfig = { ...gateway.value, bindings: bindings.value }
    const res = await window.tclaw.config.saveGateway(next)
    if (!res.ok) {
      ElMessage.error(res.error ?? '保存失败')
      return
    }
    ElMessage.success('已保存')
    await reload()
  } finally {
    saving.value = false
  }
}

onMounted(reload)
</script>

<style scoped>
.page { padding: 24px; height: 100%; overflow-y: auto; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.page-header h2 { font-size: 18px; color: #e0e0e0; }
.actions { display: flex; gap: 8px; }
.hint { font-size: 12px; color: #a78bfa; margin-bottom: 12px; }
.toolbar { margin-top: 12px; }
</style>
