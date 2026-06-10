import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import api from '../api'

const AppContext = createContext()

const ROLE_MAP = {
  dispatcher: { name: '现场调度-小王', label: '现场调度' },
  ticketing: { name: '票务专员-小李', label: '票务专员' },
  manager: { name: '景区经理-张总', label: '景区经理' }
}

const DEFAULT_FILTERS = { status: '', urgency: '', missing_module: '' }

function _loadFilters() {
  try {
    const raw = localStorage.getItem('booking_filters')
    if (raw) return { ...DEFAULT_FILTERS, ...JSON.parse(raw) }
  } catch (_) {}
  return { ...DEFAULT_FILTERS }
}

function _saveFilters(f) {
  try {
    localStorage.setItem('booking_filters', JSON.stringify(f))
  } catch (_) {}
}

export function AppProvider({ children }) {
  const [userRole, setUserRole] = useState(() => localStorage.getItem('user_role') || 'dispatcher')
  const [userName, setUserName] = useState(() => localStorage.getItem('user_name') || ROLE_MAP.dispatcher.name)
  const [bookings, setBookings] = useState([])
  const [missingSummary, setMissingSummary] = useState({})
  const [stats, setStats] = useState({ total: 0, normal: 0, approaching: 0, overdue: 0, by_status: {} })
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState(null)

  const filtersRef = useRef(_loadFilters())

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

  const fetchBookings = useCallback(async (filters) => {
    if (filters) {
      filtersRef.current = { ...DEFAULT_FILTERS, ...filters }
      _saveFilters(filtersRef.current)
    }
    const f = filtersRef.current
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (f.status) params.append('status', f.status)
      if (f.urgency) params.append('urgency', f.urgency)
      if (f.missing_module) params.append('missing_module', f.missing_module)

      const res = await api.get(`/bookings?${params.toString()}`)
      if (res.data.success) {
        setBookings(res.data.data)
        setMissingSummary(res.data.missing_summary || {})
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

  const currentFilters = filtersRef.current

  const value = {
    userRole,
    userName,
    userLabel: ROLE_MAP[userRole]?.label || userRole,
    switchRole,
    bookings,
    missingSummary,
    currentFilters,
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
