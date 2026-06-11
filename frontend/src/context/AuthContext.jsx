import React, { createContext, useContext, useState, useEffect } from 'react'
import { message } from 'antd'
import { authApi } from '../api.js'
import { ROLE_LABELS, DEMO_ACCOUNTS } from '../utils/constants.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser)
        setUser(parsedUser)
      } catch (e) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    setInitialized(true)
  }, [])

  const login = async (username, password) => {
    setLoading(true)
    try {
      const result = await authApi.login({ username, password })
      const { token, user: userData } = result
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)
      message.success(`欢迎，${userData.role_display || userData.username}`)
      return true
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || '登录失败'
      message.error(errorMsg)
      return false
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    message.success('已退出登录')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        initialized,
        login,
        logout,
        demoAccounts: DEMO_ACCOUNTS,
        roleLabels: ROLE_LABELS
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
