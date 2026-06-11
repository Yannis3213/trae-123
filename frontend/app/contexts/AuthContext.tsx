import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import * as authApi from '../lib/auth'

const ROLE_DISPLAY: Record<string, string> = {
  CONSULTANT: '车源顾问',
  EVALUATOR: '评估师',
  MANAGER: '门店经理',
}

interface User {
  username: string
  display_name: string
  role: string
}

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  login: (username: string) => Promise<void>
  logout: () => Promise<void>
  getRoleDisplay: (role: string) => string
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function getRoleDisplay(role: string) {
  return ROLE_DISPLAY[role] || role
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
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

  const login = useCallback(async (username: string) => {
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
    <AuthContext.Provider
      value={{ currentUser, loading, login, logout, getRoleDisplay }}
    >
      {children}
    </AuthContext.Provider>
  )
}
