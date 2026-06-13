import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    meta: { requiresAuth: true },
    redirect: '/followup',
    children: [
      {
        path: 'followup',
        name: 'FollowupList',
        component: () => import('../views/FollowupList.vue')
      },
      {
        path: 'followup/:id',
        name: 'FollowupDetail',
        component: () => import('../views/FollowupDetail.vue')
      },
      {
        path: 'followup/create',
        name: 'FollowupCreate',
        component: () => import('../views/FollowupCreate.vue')
      },
      {
        path: 'batch-result',
        name: 'BatchResult',
        component: () => import('../views/BatchResult.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next('/login')
  } else if (to.path === '/login' && userStore.isLoggedIn) {
    next('/')
  } else {
    next()
  }
})

export default router
