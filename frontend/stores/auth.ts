import { defineStore } from 'pinia'
import type { User, UserRole } from '~/types/order'

interface AuthState {
  user: User | null
  currentRole: UserRole
  availableRoles: UserRole[]
  isLoggedIn: boolean
}

const mockUsers: Record<UserRole, User> = {
  GROUPON_REGISTRAR: {
    id: 'user-registrar',
    name: '张登记',
    role: 'GROUPON_REGISTRAR',
  },
  AUDIT_SUPERVISOR: {
    id: 'user-audit-supervisor',
    name: '李主管',
    role: 'AUDIT_SUPERVISOR',
  },
  REVIEW_LEADER: {
    id: 'user-review-leader',
    name: '王复核',
    role: 'REVIEW_LEADER',
  },
  LEADER_OPERATOR: {
    id: 'user-leader-operator',
    name: '赵团长',
    role: 'LEADER_OPERATOR',
  },
  FULFILLMENT_SPECIALIST: {
    id: 'user-fulfillment',
    name: '钱履约',
    role: 'FULFILLMENT_SPECIALIST',
  },
  CITY_MANAGER: {
    id: 'user-city-manager',
    name: '孙经理',
    role: 'CITY_MANAGER',
  },
}

const roleLabels: Record<UserRole, string> = {
  GROUPON_REGISTRAR: '团购登记员',
  AUDIT_SUPERVISOR: '团购审核主管',
  REVIEW_LEADER: '复核负责人',
  LEADER_OPERATOR: '团长运营',
  FULFILLMENT_SPECIALIST: '履约专员',
  CITY_MANAGER: '城市经理',
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    currentRole: 'GROUPON_REGISTRAR',
    availableRoles: [
      'GROUPON_REGISTRAR',
      'AUDIT_SUPERVISOR',
      'REVIEW_LEADER',
      'LEADER_OPERATOR',
      'FULFILLMENT_SPECIALIST',
      'CITY_MANAGER',
    ],
    isLoggedIn: false,
  }),

  getters: {
    roleLabel: (state): string => roleLabels[state.currentRole],
    userName: (state): string => state.user?.name || '',
  },

  actions: {
    login(role: UserRole = 'GROUPON_REGISTRAR') {
      this.user = mockUsers[role]
      this.currentRole = role
      this.isLoggedIn = true
    },

    switchRole(role: UserRole) {
      this.currentRole = role
      this.user = mockUsers[role]
    },

    logout() {
      this.user = null
      this.isLoggedIn = false
      this.currentRole = 'GROUPON_REGISTRAR'
    },

    getRoleLabel(role: UserRole): string {
      return roleLabels[role]
    },
  },

  persist: {
    storage: persistedState.localStorage,
  },
})
