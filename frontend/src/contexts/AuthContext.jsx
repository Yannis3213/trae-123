import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as authApi from '../api/auth'

const ROLE_DISPLAY = {
  CONSULTANT: '车源顾问',
  EVALUATOR: '评估师',
  MANAGER: '门店经理',
}

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function getRoleDisplay(role) {
  return ROLE_DISPLAY[role] || role
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const checkSession = useCallback(async () => {
    try {
      const res = await authApi.getMe()
      if (res.status === 200) {
        setCurrentUser(res.data)
      } else {
        setCurrentUser(null)
      }
    } catch {
      setCurrentUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const login = useCallback(async (username) => {
    const res = await authApi.login(username)
    if (res.status === 200) {
      setCurrentUser(res.data)
    } else {
      throw new Error(res.data?.detail || '登录失败')
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setCurrentUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout, getRoleDisplay }}>
      {children}
    </AuthContext.Provider>
  )
}
