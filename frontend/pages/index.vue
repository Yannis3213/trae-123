<script setup lang="ts">
const router = useRouter()
onMounted(() => {
  router.replace('/orders')
})
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
  </div>
</template>
