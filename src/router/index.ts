import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/agents'
    },
    {
      path: '/agents',
      name: 'Agents',
      component: () => import('@/views/AgentPanel.vue'),
      meta: { title: 'Agent 管理', icon: 'Robot' }
    },
    {
      path: '/channels',
      name: 'Channels',
      component: () => import('@/views/ChannelBindings.vue'),
      meta: { title: '渠道绑定', icon: 'Connection' }
    },
    {
      path: '/sessions',
      name: 'Sessions',
      component: () => import('@/views/SessionMonitor.vue'),
      meta: { title: '会话监控', icon: 'ChatDotRound' }
    },
    {
      path: '/logs',
      name: 'Logs',
      component: () => import('@/views/LogViewer.vue'),
      meta: { title: '日志', icon: 'Document' }
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/Settings.vue'),
      meta: { title: '设置', icon: 'Setting' }
    }
  ]
})

export default router