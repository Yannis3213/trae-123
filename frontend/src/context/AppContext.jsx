import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api'

const AppContext = createContext()

const ROLE_MAP = {
  dispatcher: { name: '现场调度-小王', label: '现场调度' },
  ticketing: { name: '票务专员-小李', label: '票务专员' },
  manager: { name: '景区经理-张总', label: '景区经理' }
}

export function AppProvider({ children }) {
  const [userRole, setUserRole] = useState(() => localStorage.getItem('user_role') || 'dispatcher')
  const [userName, setUserName] = useState(() => localStorage.getItem('user_name') || ROLE_MAP.dispatcher.name)
  const [bookings, setBookings] = useState([])
  const [stats, setStats] = useState({ total: 0, normal: 0, approaching: 0, overdue: 0, by_status: {} })
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    localStorage.setItem('user_role', userRole)
    localStorage.setItem('user_name', userName)
  }, [userRole, userName])

  const switchRole = useCallback((role) => {
    setUserRole(role)
    setUserName(ROLE_MAP[role]?.name || role)
  }, [])

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
  }, [])

  const fetchBookings = useCallback(async (filters = {}) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.urgency) params.append('urgency', filters.urgency)

      const res = await api.get(`/bookings?${params.toString()}`)
      if (res.data.success) {
        setBookings(res.data.data)
      }
    } catch (err) {
      showNotification(err.response?.data?.error || '获取列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showNotification])

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/statistics/dashboard')
      if (res.data.success) {
        setStats(res.data.data)
      }
    } catch (err) {
      console.error('获取统计失败:', err)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchBookings(), fetchStats()])
  }, [fetchBookings, fetchStats])

  const value = {
    userRole,
    userName,
    userLabel: ROLE_MAP[userRole]?.label || userRole,
    switchRole,
    bookings,
    stats,
    loading,
    fetchBookings,
    fetchStats,
    refreshAll,
    notification,
    showNotification,
    ROLE_MAP
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  return useContext(AppContext)
}
