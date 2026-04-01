<template>
  <div class="tclaw-page tclaw-page--scroll">
    <PageHeader
      title="Agent 管理"
      description="读取 OpenClaw 目录下 agents/*.yaml，编辑后保存到对应文件。"
    >
      <template #actions>
        <el-button size="small" @click="openCreate">
          <el-icon><Plus /></el-icon> 新建
        </el-button>
        <el-button type="primary" size="small" :loading="agents.loading" @click="refresh">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </template>
    </PageHeader>

    <div class="table-wrap">
      <el-table :data="agents.list" class="agent-table" style="width: 100%" empty-text="暂无 Agent，请先配置 OpenClaw 目录">
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
    </div>

    <el-dialog v-model="dialogVisible" :title="isCreateMode ? '新建 Agent' : '编辑 Agent'" width="560px" destroy-on-close @closed="resetForm">
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
import { Refresh, Plus } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
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
let isCreateMode = false

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
 * 打开新建 Agent 对话框（表单清空）。
 */
function openCreate() {
  isCreateMode = true
  sourceRow = null
  form.value = { name: '', id: '', model: '', description: '' }
  dialogVisible.value = true
}

/**
 * 打开编辑对话框并填充表单。
 * @param row - 当前行
 */
function openEdit(row: AgentConfig) {
  isCreateMode = false
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
  isCreateMode = false
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
.table-wrap {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.agent-table {
  min-height: 260px;
}
</style>
