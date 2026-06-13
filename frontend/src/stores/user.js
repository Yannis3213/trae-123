import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginApi, getCurrentUserApi } from '../api/auth'
import { ROLES, ROLE_NAMES } from '../types'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const role = computed(() => user.value?.role)
  const roleName = computed(() => user.value?.roleName)
  const isTriageNurse = computed(() => role.value === ROLES.TRIAGE_NURSE)
  const isGeneralDoctor = computed(() => role.value === ROLES.GENERAL_DOCTOR)
  const isMedicalDirector = computed(() => role.value === ROLES.MEDICAL_DIRECTOR)

  async function login(username, password) {
    const res = await loginApi({ username, password })
    token.value = res.token
    user.value = res.user
    localStorage.setItem('token', res.token)
    localStorage.setItem('user', JSON.stringify(res.user))
    return res
  }

  async function fetchCurrentUser() {
    try {
      const res = await getCurrentUserApi()
      user.value = res.user
      localStorage.setItem('user', JSON.stringify(res.user))
      return res.user
    } catch (err) {
      logout()
      throw err
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  function hasPermission(permission) {
    const permissions = {
      [ROLES.TRIAGE_NURSE]: ['create', 'edit', 'submit', 'resubmit', 'view_draft', 'view_pending', 'view_returned'],
      [ROLES.GENERAL_DOCTOR]: ['process', 'return', 'view_pending', 'view_resubmitted', 'view_processing'],
      [ROLES.MEDICAL_DIRECTOR]: ['review', 'complete', 'archive', 'return', 'view_processing', 'view_review', 'view_completed', 'view_archived']
    }
    return permissions[role.value]?.includes(permission) || false
  }

  return {
    token,
    user,
    isLoggedIn,
    role,
    roleName,
    isTriageNurse,
    isGeneralDoctor,
    isMedicalDirector,
    login,
    fetchCurrentUser,
    logout,
    hasPermission
  }
})
