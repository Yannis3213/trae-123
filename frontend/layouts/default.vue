<script setup lang="ts">
import type { UserRole } from '~/types/order'

const authStore = useAuthStore()
const route = useRoute()

const menuItems = [
  {
    label: '订单管理',
    icon: 'i-heroicons-rectangle-stack',
    to: '/orders',
  },
]

const roleItems = computed(() =>
  authStore.availableRoles.map((role) => ({
    label: authStore.getRoleLabel(role),
    value: role,
    icon: role === authStore.currentRole ? 'i-heroicons-check' : undefined,
  }))
)

function handleRoleSelect(role: UserRole) {
  authStore.switchRole(role)
  useToast().add({
    title: '角色已切换',
    description: `当前角色：${authStore.getRoleLabel(role)}`,
    color: 'green',
  })
}

const isActive = (to: string) => route.path.startsWith(to)
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50">
    <header class="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div class="h-16 px-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <UIcon name="i-heroicons-building-storefront" class="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 class="font-semibold text-gray-900 leading-tight">团购订单管理系统</h1>
            <p class="text-xs text-gray-500">Group Order Management</p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <UDropdown :items="roleItems" :popper="{ placement: 'bottom-end' }">
            <UButton
              :ui="{ rounded: 'rounded-full', padding: 'px-2 py-1.5' }"
              variant="ghost"
              class="flex items-center gap-2"
            >
              <span class="text-sm text-gray-600">角色：</span>
              <UBadge :ui="{ rounded: 'rounded-full' }" color="primary" variant="subtle">
                {{ authStore.roleLabel }}
              </UBadge>
              <UIcon name="i-heroicons-chevron-down-20" class="w-4 h-4 text-gray-400" />
            </UButton>

            <template #panel="{ open }">
              <div v-show="open" class="w-48 py-1">
                <p class="px-3 py-1.5 text-xs font-medium text-gray-500">切换角色</p>
                <div class="mt-1">
                  <button
                    v-for="item in roleItems"
                    :key="item.value"
                    @click="handleRoleSelect(item.value as UserRole)"
                    class="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
                  >
                    <span>{{ item.label }}</span>
                    <UIcon
                      v-if="item.value === authStore.currentRole"
                      name="i-heroicons-check"
                      class="w-4 h-4 text-primary"
                    />
                  </button>
                </div>
              </div>
            </template>
          </UDropdown>

          <div class="h-6 w-px bg-gray-200"></div>

          <div class="flex items-center gap-3">
            <UAvatar :name="authStore.userName" size="sm" />
            <div class="text-sm">
              <p class="font-medium text-gray-900 leading-tight">{{ authStore.userName }}</p>
              <p class="text-xs text-gray-500">{{ authStore.roleLabel }}</p>
            </div>
          </div>
        </div>
      </div>
    </header>

    <div class="flex flex-1">
      <aside class="w-60 bg-white border-r border-gray-200 shrink-0">
        <nav class="p-3 space-y-1">
          <NuxtLink
            v-for="item in menuItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            :class="
              isActive(item.to)
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            "
          >
            <UIcon :name="item.icon" class="w-5 h-5" />
            {{ item.label }}
          </NuxtLink>
        </nav>
      </aside>

      <main class="flex-1 p-6 overflow-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
