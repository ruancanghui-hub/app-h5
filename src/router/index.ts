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
    {
      path: '/auth/login',
      name: 'auth-login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { title: '登录' },
    },
    {
      path: '/auth/register',
      name: 'auth-register',
      component: () => import('@/views/auth/RegisterView.vue'),
      meta: { title: '邮箱注册' },
    },
    {
      path: '/auth/consent',
      name: 'auth-consent',
      component: () => import('@/views/auth/ConsentView.vue'),
      meta: { title: '授权确认' },
    },
    {
      path: '/auth/forgot',
      name: 'auth-forgot',
      component: () => import('@/views/auth/ForgotPasswordView.vue'),
      meta: { title: '找回密码' },
    },
    {
      path: '/auth/verify',
      name: 'auth-verify',
      component: () => import('@/views/auth/VerifyEmailView.vue'),
      meta: { title: '验证邮箱' },
    },
    {
      path: '/auth/done',
      name: 'auth-done',
      component: () => import('@/views/auth/AuthDoneView.vue'),
      meta: { title: '登录成功' },
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
