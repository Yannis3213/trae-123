import { ref, computed } from 'vue'
import type { User } from '~/types'

const token = ref<string | null>(null)
const currentUser = ref<User | null>(null)

export const useAuth = () => {
  const isLoggedIn = computed(() => !!token.value && !!currentUser.value)
  const userRole = computed(() => currentUser.value?.role || null)

  const initAuth = () => {
    if (process.client) {
      const savedToken = localStorage.getItem('access_token')
      const savedUser = localStorage.getItem('current_user')
      if (savedToken) {
        token.value = savedToken
      }
      if (savedUser) {
        try {
          currentUser.value = JSON.parse(savedUser)
        } catch (e) {
          console.error('Failed to parse saved user', e)
        }
      }
    }
  }

  const login = async (username: string, password: string) => {
    const config = useRuntimeConfig()
    const data = await $fetch<{ access_token: string; token_type: string; user: User }>(
      `${config.public.apiBase}/auth/login`,
      {
        method: 'POST',
        body: { username, password },
      }
    )

    token.value = data.access_token
    currentUser.value = data.user

    if (process.client) {
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('current_user', JSON.stringify(data.user))
    }

    return data.user
  }

  const logout = () => {
    token.value = null
    currentUser.value = null
    if (process.client) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('current_user')
    }
  }

  const getToken = () => token.value

  const getAuthHeaders = () => {
    if (!token.value) return {}
    return { Authorization: `Bearer ${token.value}` }
  }

  return {
    token,
    currentUser,
    isLoggedIn,
    userRole,
    initAuth,
    login,
    logout,
    getToken,
    getAuthHeaders,
  }
}
