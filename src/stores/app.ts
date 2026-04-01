import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ClawStatus, TClawSettings } from '@/types'

const DEFAULT_SETTINGS: TClawSettings = {
  clawDir: '',
  gatewayUrl: 'http://localhost:3000',
  autoStart: false,
  logPath: '',
  sessionsApiPath: '/api/sessions'
}

export const useAppStore = defineStore('app', () => {
  const clawStatus = ref<ClawStatus>('stopped')
  const settings = ref<TClawSettings>({ ...DEFAULT_SETTINGS })
  const logLines = ref<string[]>([])
  const configDirSet = ref(false)

  const isRunning = computed(() => clawStatus.value === 'running')
  const statusColor = computed(() => ({
    stopped: '#909399',
    starting: '#e6a23c',
    running: '#67c23a',
    error: '#f56c6c'
  }[clawStatus.value]))

  function setStatus(s: ClawStatus) {
    clawStatus.value = s
  }

  function appendLog(line: string) {
    logLines.value.push(`[${new Date().toLocaleTimeString()}] ${line}`)
    if (logLines.value.length > 2000) logLines.value.splice(0, 500)
  }

  function clearLogs() {
    logLines.value = []
  }

  function loadSettings() {
    const saved = localStorage.getItem('tclaw:settings')
    if (saved) {
      try {
        settings.value = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
      } catch { /* ignore */ }
    }
  }

  function saveSettings() {
    localStorage.setItem('tclaw:settings', JSON.stringify(settings.value))
  }

  return {
    clawStatus, settings, logLines, configDirSet,
    isRunning, statusColor,
    setStatus, appendLog, clearLogs, loadSettings, saveSettings
  }
})