<template>
  <div>
    <header class="app-header">
      <div class="app-title">🏭 外贸公司-月底集中处理外贸订单系统</div>
      <div class="app-user-info">
        <input
          v-model="userName"
          @change="onNameChange"
          class="user-name-input"
          placeholder="输入当前用户名"
        />
        <div class="role-selector">
          <button
            v-for="role in roleList"
            :key="role.code"
            :class="['role-btn', currentRole === role.code ? 'active' : '']"
            @click="switchRole(role.code)"
          >
            {{ role.name }}
          </button>
        </div>
      </div>
    </header>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'

const { currentRole, currentUserName, roleList, setRole, setUserName, initFromStorage } = useUserStore()

const userName = ref(currentUserName.value)

const switchRole = (role: string) => {
  setRole(role)
  if (process.client) {
    window.location.reload()
  }
}

const onNameChange = () => {
  setUserName(userName.value)
}

onMounted(() => {
  initFromStorage()
  if (!currentRole.value) {
    setRole('clerk')
  }
  userName.value = currentUserName.value
})
</script>
