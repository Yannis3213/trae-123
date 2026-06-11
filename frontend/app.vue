<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="header-left">
        <h1 class="app-title">社区健身房 - 月底集中处理会员入会单系统</h1>
      </div>
      <div class="header-right">
        <div v-if="auth.isLoggedIn.value" class="user-info">
          <span class="user-name">{{ auth.currentUser.value?.full_name }}</span>
          <span class="user-role tag tag-pending">{{ ROLE_LABELS[auth.currentUser.value?.role || 'registration_clerk'] }}</span>
          <button class="btn btn-sm" @click="showRoleSwitcher = true">切换角色</button>
          <button class="btn btn-sm" @click="handleLogout">退出</button>
        </div>
      </div>
    </header>
    <main class="app-main">
      <NuxtPage />
    </main>

    <div v-if="showRoleSwitcher" class="modal-mask" @click.self="showRoleSwitcher = false">
      <div class="modal">
        <div class="modal-header">
          <span>切换角色（演示用）</span>
          <button class="close-btn" @click="showRoleSwitcher = false">×</button>
        </div>
        <div class="modal-body">
          <p class="text-secondary mb-4">选择不同角色登录，体验不同岗位的操作权限：</p>
          <div class="role-list">
            <div
              v-for="account in demoAccounts"
              :key="account.username"
              class="role-item"
              @click="switchRole(account.username)"
            >
              <div class="role-name">{{ account.full_name }}</div>
              <div class="role-tag tag" :class="getRoleTagClass(account.role)">
                {{ ROLE_LABELS[account.role] }}
              </div>
              <div class="role-username text-sm text-tertiary">{{ account.username }} / 123456</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { ROLE_LABELS, type RoleEnum } from '~/types'

const auth = useAuth()
const showRoleSwitcher = ref(false)

const demoAccounts = [
  { username: 'clerk1', full_name: '张登记', role: 'registration_clerk' as RoleEnum },
  { username: 'clerk2', full_name: '李文员', role: 'registration_clerk' as RoleEnum },
  { username: 'supervisor1', full_name: '王审核', role: 'audit_supervisor' as RoleEnum },
  { username: 'lead1', full_name: '赵复核', role: 'review_lead' as RoleEnum },
]

onMounted(() => {
  auth.initAuth()
  if (!auth.isLoggedIn.value) {
    auth.login('clerk1', '123456').catch(() => {})
  }
})

const getRoleTagClass = (role: RoleEnum) => {
  switch (role) {
    case 'registration_clerk':
      return 'tag-pending'
    case 'audit_supervisor':
      return 'tag-normal'
    case 'review_lead':
      return 'tag-approaching'
    default:
      return ''
  }
}

const switchRole = async (username: string) => {
  try {
    await auth.login(username, '123456')
    showRoleSwitcher.value = false
    navigateTo('/')
  } catch (e) {
    console.error('切换角色失败', e)
  }
}

const handleLogout = () => {
  auth.logout()
  navigateTo('/')
}
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background-color: white;
  border-bottom: 1px solid #f0f0f0;
  padding: 0 24px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
}

.app-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-name {
  font-weight: 500;
}

.app-main {
  flex: 1;
  padding: 20px 24px;
}

.role-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.role-item {
  padding: 12px 16px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 12px;
}

.role-item:hover {
  border-color: var(--primary-color);
  background-color: #e6f7ff;
}

.role-name {
  font-weight: 500;
  min-width: 80px;
}
</style>
