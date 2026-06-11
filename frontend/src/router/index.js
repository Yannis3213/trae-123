import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../store/auth';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false, title: '登录' }
  },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/clues'
      },
      {
        path: 'clues',
        name: 'ClueList',
        component: () => import('../views/ClueList.vue'),
        meta: { title: '招商线索单列表', requiresAuth: true }
      },
      {
        path: 'clues/:id',
        name: 'ClueDetail',
        component: () => import('../views/ClueDetail.vue'),
        meta: { title: '招商线索单详情', requiresAuth: true }
      },
      {
        path: 'batch-results/:batchNo',
        name: 'BatchResults',
        component: () => import('../views/BatchResults.vue'),
        meta: { title: '批量处理结果', requiresAuth: true }
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  
  if (to.meta.title) {
    document.title = `${to.meta.title} - 园区招商中心-月底集中处理招商线索单系统`;
  }
  
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    next({ path: '/login', query: { redirect: to.fullPath } });
  } else if (to.path === '/login' && authStore.isLoggedIn) {
    next({ path: '/clues' });
  } else {
    next();
  }
});

export default router;
