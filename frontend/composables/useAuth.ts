import { ref, computed, onMounted } from 'vue'

const STORAGE_KEY_ROLE = 'workorder_current_role'
const STORAGE_KEY_NAME = 'workorder_current_name'

const currentRole = ref('planner')
const currentUserName = ref('张伟')
const isInitialized = ref(false)

const roleOptions = [
  { value: 'planner', label: '生产计划员', name: '张伟' },
  { value: 'planner_2', label: '生产计划员', name: '刘芳' },
  { value: 'workshop_director', label: '车间主任', name: '李明' },
  { value: 'workshop_director_2', label: '车间主任', name: '陈刚' },
  { value: 'factory_manager', label: '厂务经理', name: '王强' }
]

const roleMap: Record<string, string> = {
  'planner': 'planner',
  'planner_2': 'planner',
  'workshop_director': 'workshop_director',
  'workshop_director_2': 'workshop_director',
  'factory_manager': 'factory_manager'
}

export function useAuth() {
  const baseRole = computed(() => roleMap[currentRole.value] || currentRole.value)

  const currentRoleLabel = computed(() => {
    const role = roleOptions.find(r => r.value === currentRole.value)
    return role ? role.label : ''
  })

  function initFromStorage() {
    if (typeof window === 'undefined' || isInitialized.value) return

    const savedRole = localStorage.getItem(STORAGE_KEY_ROLE)
    const savedName = localStorage.getItem(STORAGE_KEY_NAME)

    if (savedRole && savedName) {
      const roleOption = roleOptions.find(r => r.value === savedRole)
      if (roleOption) {
        currentRole.value = savedRole
        currentUserName.value = savedName
      }
    }
    isInitialized.value = true
  }

  function setRole(role: string) {
    const roleOption = roleOptions.find(r => r.value === role)
    if (roleOption) {
      currentRole.value = role
      currentUserName.value = roleOption.name

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_ROLE, role)
        localStorage.setItem(STORAGE_KEY_NAME, roleOption.name)
      }
    }
  }

  function setUserName(name: string) {
    currentUserName.value = name
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_NAME, name)
    }
  }

  onMounted(() => {
    initFromStorage()
  })

  if (typeof window !== 'undefined' && !isInitialized.value) {
    initFromStorage()
  }

  return {
    currentRole,
    baseRole,
    currentUserName,
    currentRoleLabel,
    roleOptions,
    isInitialized,
    setRole,
    setUserName,
    roleMap
  }
}
