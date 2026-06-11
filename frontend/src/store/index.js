import { useState, useEffect, useCallback } from 'preact/hooks'
import { api } from '../api'
import { ROLES, ROLE_NAMES } from '../types'

const DEFAULT_USERS = [
  { id: 'clerk_01', name: '王文员', role: ROLES.FIRE_CLERK, roleName: ROLE_NAMES[ROLES.FIRE_CLERK] },
  { id: 'supervisor_01', name: '李监督', role: ROLES.FIRE_SUPERVISOR, roleName: ROLE_NAMES[ROLES.FIRE_SUPERVISOR] },
  { id: 'chief_01', name: '张站长', role: ROLES.STATION_CHIEF, roleName: ROLE_NAMES[ROLES.STATION_CHIEF] }
]

export function useStore() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser')
    return saved ? JSON.parse(saved) : DEFAULT_USERS[0]
  })
  const [hazards, setHazards] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    status: '',
    warning_level: '',
    priority: '',
    keyword: ''
  })
  const [toast, setToast] = useState(null)

  useEffect(() => {
    localStorage.setItem('currentUser', JSON.stringify(currentUser))
  }, [currentUser])

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const switchRole = useCallback((role) => {
    const user = DEFAULT_USERS.find(u => u.role === role)
    if (user) {
      setCurrentUser(user)
      showToast(`已切换到${user.roleName}：${user.name}`, 'info')
    }
  }, [showToast])

  const fetchHazards = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v
      })
      const res = await api.listHazards(params)
      if (res.success) {
        setHazards(res.data || [])
      }
    } catch (e) {
      showToast(e.message || '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [filters, showToast])

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.getStats()
      if (res.success) {
        setStats(res.data)
      }
    } catch (e) {}
  }, [])

  const refresh = useCallback(() => {
    fetchHazards()
    fetchStats()
  }, [fetchHazards, fetchStats])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchHazards()
  }, [fetchHazards])

  return {
    currentUser,
    setCurrentUser,
    switchRole,
    users: DEFAULT_USERS,
    hazards,
    stats,
    loading,
    filters,
    setFilters,
    refresh,
    toast,
    showToast
  }
}
