import { createSignal, createEffect } from 'solid-js'
import { Role, RoleNames, RoleResponsibility } from '../utils/constants'

const STORAGE_KEY = 'repair_user'

const DEFAULT_USERS = [
  { username: 'registrar', name: '李管家', role: Role.REGISTRAR },
  { username: 'supervisor', name: '王主管', role: Role.SUPERVISOR },
  { username: 'reviewer', name: '张经理', role: Role.REVIEWER },
]

const loadInitial = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch (e) {}
  return DEFAULT_USERS[0]
}

const [user, setUser] = createSignal(loadInitial())
const [users, setUsers] = createSignal(DEFAULT_USERS)

createEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user()))
})

export const useAuth = () => {
  const switchRole = (role) => {
    const found = users().find(u => u.role === role)
    if (found) setUser(found)
  }

  const isRole = (role) => user()?.role === role
  const isRegistrar = () => isRole(Role.REGISTRAR)
  const isSupervisor = () => isRole(Role.SUPERVISOR)
  const isReviewer = () => isRole(Role.REVIEWER)

  const getRoleName = () => RoleNames[user()?.role] || ''
  const getResponsibility = () => RoleResponsibility[user()?.role] || ''

  const role = () => user()?.role

  return {
    user,
    users,
    setUser,
    role,
    switchRole,
    isRole,
    isRegistrar,
    isSupervisor,
    isReviewer,
    getRoleName,
    getResponsibility,
  }
}
