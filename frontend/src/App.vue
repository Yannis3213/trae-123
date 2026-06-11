<template>
  <div class="app">
    <Header v-if="isLoggedIn" />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Header from './components/Header.vue'
import { getCurrentUser } from './stores/auth.js'

const router = useRouter()
const route = useRoute()

const isLoggedIn = computed(() => !!getCurrentUser())

onMounted(() => {
  if (!isLoggedIn.value && route.path !== '/login') {
    router.push('/login')
  }
})
</script>
