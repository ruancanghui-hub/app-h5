import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/feedback',
    },
    {
      path: '/feedback',
      name: 'feedback',
      component: () => import('@/views/FeedbackView.vue'),
      meta: { title: '意见与建议' },
    },
    {
      path: '/feedback/history',
      name: 'feedback-history',
      component: () => import('@/views/FeedbackHistoryView.vue'),
      meta: { title: '历史反馈' },
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const title = (to.meta.title as string) || 'App H5'
  document.title = title
})

export default router
