import type { Ref } from 'vue'

const currentRole: Ref<string> = ref('')
const currentUserName: Ref<string> = ref('TestUser')
const roleList = ref<Array<{ code: string; name: string }>>([
  { code: 'clerk', name: '外贸登记员' },
  { code: 'supervisor', name: '外贸审核主管' },
  { code: 'reviewer', name: '外贸公司复核负责人' }
])

export const useUserStore = () => {
  const setRole = (role: string) => {
    currentRole.value = role
    if (process.client) {
      localStorage.setItem('current_role', role)
    }
  }

  const setUserName = (name: string) => {
    currentUserName.value = name
    if (process.client) {
      localStorage.setItem('current_user_name', name)
    }
  }

  const initFromStorage = () => {
    if (process.client) {
      const savedRole = localStorage.getItem('current_role')
      const savedName = localStorage.getItem('current_user_name')
      if (savedRole) currentRole.value = savedRole
      if (savedName) currentUserName.value = savedName
    }
  }

  const getRoleDisplayName = (code: string) => {
    const r = roleList.value.find(x => x.code === code)
    return r ? r.name : code
  }

  return {
    currentRole,
    currentUserName,
    roleList,
    setRole,
    setUserName,
    initFromStorage,
    getRoleDisplayName
  }
}
