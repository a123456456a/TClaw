import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AgentConfig } from '@/types'

/**
 * Agent 列表与编辑状态，数据来自主进程读取的 `agents/*.yaml`。
 */
export const useAgentsStore = defineStore('agents', () => {
  const list = ref<AgentConfig[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * 从配置目录重新拉取 Agent 列表。
   */
  async function fetchAgents(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      list.value = await window.tclaw.config.getAgents()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      list.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * 保存 Agent 到 `agents/<agentId>.yaml`。
   * @param agentId - 不含扩展名的文件名
   * @param data - 完整配置（可含 `_file`，主进程会剥离）
   */
  async function saveAgent(agentId: string, data: AgentConfig): Promise<{ ok: boolean; error?: string }> {
    return window.tclaw.config.saveAgent(agentId, data)
  }

  return { list, loading, error, fetchAgents, saveAgent }
})
