<template>
  <div>
    <div class="header-bar">
      <h1>🏥 养老护理院 - 月底集中处理护理计划单系统</h1>
      <div class="role-switcher">
        <span>当前角色：</span>
        <select :value="auth.currentRole" @change="onRoleChange">
          <option value="registrar">护理计划登记员 (李登记)</option>
          <option value="supervisor">护理计划审核主管 (王主管)</option>
          <option value="director">养老护理院复核负责人 (张主任)</option>
        </select>
        <span class="tag tag-info" style="margin-left: 8px;">{{ auth.roleLabel }}</span>
      </div>
    </div>
    <div class="container">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
const auth = useAuthStore()
const router = useRouter()

function onRoleChange(e: Event) {
  const target = e.target as HTMLSelectElement
  auth.switchRole(target.value as any)
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
}
</script>
