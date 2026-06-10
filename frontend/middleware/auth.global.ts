export default defineNuxtRouteMiddleware(() => {
  const authStore = useAuthStore()

  if (!authStore.isLoggedIn) {
    authStore.login('GROUPON_REGISTRAR')
  }
})
