<template>
  <div class="page">
    <div class="page-header">
      <h2>Agent 管理</h2>
      <el-button type="primary" size="small" :loading="agents.loading" @click="refresh">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
    </div>

    <el-table :data="agents.list" style="width: 100%" empty-text="暂无 Agent，请先配置 OpenClaw 目录">
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="id" label="ID" />
      <el-table-column prop="model" label="模型" />
      <el-table-column prop="description" label="描述" show-overflow-tooltip />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="编辑 Agent" width="560px" destroy-on-close @closed="resetForm">
      <el-form label-width="88px">
        <el-form-item label="ID">
          <el-input v-model="form.id" placeholder="与文件名一致，不含扩展名" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="模型">
          <el-input v-model="form.model" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import type { AgentConfig } from '@/types'
import { useAgentsStore } from '@/stores/agents'
import { ElMessage } from 'element-plus'

const agents = useAgentsStore()
const dialogVisible = ref(false)
const saving = ref(false)

const form = ref<AgentConfig>({
  name: '',
  id: '',
  model: '',
  description: ''
})

let sourceRow: AgentConfig | null = null

/**
 * 从表格行解析用于保存的 agentId（优先 id，其次 yaml 文件名）。
 * @param row - 表格行数据
 */
function resolveAgentId(row: AgentConfig): string {
  if (row.id && String(row.id).length > 0) return String(row.id)
  const f = row._file
  if (typeof f === 'string') return f.replace(/\.ya?ml$/i, '')
  return 'agent'
}

/**
 * 重新拉取 Agent 列表。
 */
async function refresh() {
  await agents.fetchAgents()
  if (agents.error) ElMessage.error(agents.error)
}

/**
 * 打开编辑对话框并填充表单。
 * @param row - 当前行
 */
function openEdit(row: AgentConfig) {
  sourceRow = { ...row }
  form.value = {
    ...row,
    id: row.id != null ? String(row.id) : resolveAgentId(row),
    name: typeof row.name === 'string' ? row.name : '',
    model: typeof row.model === 'string' ? row.model : '',
    description: typeof row.description === 'string' ? row.description : ''
  }
  dialogVisible.value = true
}

/**
 * 关闭对话框时重置表单状态。
 */
function resetForm() {
  sourceRow = null
  form.value = { name: '', id: '', model: '', description: '' }
}

/**
 * 合并表单并写回 YAML。
 */
async function submit() {
  const agentId = form.value.id?.trim()
  if (!agentId) {
    ElMessage.warning('请填写 ID')
    return
  }
  saving.value = true
  try {
    const merged: AgentConfig = {
      ...(sourceRow ?? {}),
      ...form.value,
      id: agentId,
      name: form.value.name,
      model: form.value.model,
      description: form.value.description
    }
    const res = await agents.saveAgent(agentId, merged)
    if (!res.ok) {
      ElMessage.error(res.error ?? '保存失败')
      return
    }
    ElMessage.success('已保存')
    dialogVisible.value = false
    await refresh()
  } finally {
    saving.value = false
  }
}

onMounted(refresh)
</script>

<style scoped>
.page { padding: 24px; height: 100%; overflow-y: auto; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-header h2 { font-size: 18px; color: #e0e0e0; }
</style>
