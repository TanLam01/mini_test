import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

import { resolveAuthRedirect } from './guard'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: { name: 'tasks' } },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { guestOnly: true, title: 'Sign in' },
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: () => import('@/views/TasksView.vue'),
      meta: { requiresAuth: true, title: 'Tasks' },
    },
    {
      path: '/tasks/:id(\\d+)',
      name: 'task-detail',
      component: () => import('@/views/TaskDetailView.vue'),
      props: (route) => ({ id: Number(route.params.id) }),
      meta: { requiresAuth: true, title: 'Task details' },
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'tasks' } },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()

  return resolveAuthRedirect(to, auth.isAuthenticated) ?? true
})

export default router
