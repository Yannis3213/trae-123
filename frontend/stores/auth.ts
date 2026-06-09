import { defineStore } from 'pinia'
import type { User } from '~/types'
import { ROLE_ACCOUNTS, ROLE_LABELS } from '~/types'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    currentRole: 'director' as 'registrar' | 'supervisor' | 'director',
  }),
  getters: {
    token(): string {
      return ROLE_ACCOUNTS[this.currentRole].token
    },
    displayName(): string {
      return ROLE_ACCOUNTS[this.currentRole].display_name
    },
    roleLabel(): string {
      return ROLE_LABELS[this.currentRole]
    },
    user(): User {
      return {
        id: this.currentRole,
        username: ROLE_ACCOUNTS[this.currentRole].username,
        role: this.currentRole,
        display_name: this.displayName,
        token: this.token,
      }
    },
  },
  actions: {
    switchRole(role: 'registrar' | 'supervisor' | 'director') {
      this.currentRole = role
    },
  },
  persist: true,
})
