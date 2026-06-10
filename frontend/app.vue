<template>
  <div>
    <header class="header">
      <div class="header-title">制造工厂-月底集中处理生产工单系统</div>
      <div class="user-info">
        <span class="text-sm text-muted">当前角色：</span>
        <select v-model="selectedRole" @change="handleRoleChange" class="role-select">
          <option v-for="role in roleOptions" :key="role.value" :value="role.value">
            {{ role.label }} - {{ role.name }}
          </option>
        </select>
      </div>
    </header>
    <main class="container">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const { currentRole, roleOptions, setRole, setUserName } = useAuth()

const selectedRole = computed({
  get: () => currentRole.value,
  set: (val) => {}
})

function handleRoleChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const role = roleOptions.find(r => r.value === target.value)
  if (role) {
    setRole(role.value)
    setUserName(role.name)
    window.location.reload()
  }
}
</script>
