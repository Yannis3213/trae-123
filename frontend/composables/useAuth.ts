import { ref, computed } from 'vue'

const currentRole = ref('planner')
const currentUserName = ref('张伟')

const roleOptions = [
  { value: 'planner', label: '生产计划员', name: '张伟' },
  { value: 'workshop_director', label: '车间主任', name: '李明' },
  { value: 'factory_manager', label: '厂务经理', name: '王强' }
]

export function useAuth() {
  const currentRoleLabel = computed(() => {
    const role = roleOptions.find(r => r.value === currentRole.value)
    return role ? role.label : ''
  })

  function setRole(role: string) {
    const roleOption = roleOptions.find(r => r.value === role)
    if (roleOption) {
      currentRole.value = role
      currentUserName.value = roleOption.name
    }
  }

  function setUserName(name: string) {
    currentUserName.value = name
  }

  return {
    currentRole,
    currentUserName,
    currentRoleLabel,
    roleOptions,
    setRole,
    setUserName
  }
}
