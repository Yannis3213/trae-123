<template>
  <header class="header">
    <div class="header-inner">
      <div class="header-title">
        <span>📞 客服呼叫中心</span>
        <span class="badge">月底集中处理客服工单系统</span>
      </div>
      <div class="header-right">
        <div class="role-switcher" v-if="allUsers.length > 0">
          <label>切换身份：</label>
          <select :value="currentUser?.id" @change="onSwitchRole">
            <option v-for="u in allUsers" :key="u.id" :value="u.id">
              {{ u.role_display }} - {{ u.name }}
            </option>
          </select>
        </div>
        <div class="user-info">
          <span class="user-avatar">{{ currentUser?.name?.[0] || 'U' }}</span>
          <span>{{ currentUser?.name }}</span>
          <span style="opacity: 0.7;">({{ currentUser?.role_display }})</span>
        </div>
        <button class="logout-btn" @click="onLogout">退出</button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentUser, setCurrentUser, clearCurrentUser } from '../stores/auth.js'
import { api } from '../api/index.js'

const router = useRouter()
const currentUser = ref(getCurrentUser())
const allUsers = ref([])

onMounted(async () => {
  try {
    allUsers.value = await api.listUsers()
  } catch (e) {
    console.error('用户列表加载失败', e)
  }
})

watch(currentUser, (u) => {
  if (u) setCurrentUser(u)
}, { deep: true })

function onSwitchRole(e) {
  const userId = e.target.value
  const u = allUsers.value.find(x => x.id === userId)
  if (u) {
    currentUser.value = u
    setCurrentUser(u)
    window.location.reload()
  }
}

function onLogout() {
  clearCurrentUser()
  router.push('/login')
}
</script>
