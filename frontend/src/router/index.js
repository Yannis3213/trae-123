import { createRouter, createWebHashHistory } from 'vue-router'
import { getCurrentUser } from '../stores/auth.js'

const routes = [
  { path: '/login', component: () => import('../views/Login.vue') },
  { path: '/', component: () => import('../views/TicketList.vue') },
  { path: '/tickets/:id', component: () => import('../views/TicketDetail.vue'), props: true },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to) => {
  if (to.path !== '/login' && !getCurrentUser()) {
    return '/login'
  }
  if (to.path === '/login' && getCurrentUser()) {
    return '/'
  }
})

export default router
