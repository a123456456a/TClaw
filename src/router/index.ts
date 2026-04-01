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
      meta: { title: 'Gateway 状态', icon: 'Monitor' }
    },
    {
      path: '/chat',
      name: 'Chat',
      component: () => import('@/views/ChatPanel.vue'),
      meta: { title: '聊天', icon: 'ChatLineRound' }
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
    },
    {
      path: '/docs',
      name: 'Manual',
      component: () => import('@/views/ManualView.vue'),
      meta: { title: '使用手册', icon: 'Reading' }
    }
  ]
})

export default router