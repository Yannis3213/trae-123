import React, { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import OrderList from './pages/OrderList.jsx'
import OrderDetail from './pages/OrderDetail.jsx'
import api from './api.js'

const AuthContext = createContext(null)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

function PrivateRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppLayout({ children }) {
  const { user, logout, mockUsers, switchUser } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-container">
      <div className="header">
        <div className="logo">眼科诊所 - 配镜订单处理系统</div>
        <div className="user-info">
          <span className="role-badge">{user?.role_display}</span>
          <span>{user?.real_name}</span>
          <button className="logout-btn" onClick={handleLogout}>退出</button>
        </div>
      </div>
      <div className="main-content">
        <div className="role-switch-bar">
          <span className="label">🧪 模拟角色切换（测试用）：</span>
          <select value={user?.username} onChange={(e) => switchUser(e.target.value)}>
            {mockUsers.map(u => (
              <option key={u.username} value={u.username}>
                {u.real_name} - {u.role_display}
              </option>
            ))}
          </select>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mockUsers, setMockUsers] = useState([])

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
    loadMockUsers()
  }, [])

  const loadMockUsers = async () => {
    try {
      const res = await api.get('/users')
      if (Array.isArray(res.data)) setMockUsers(res.data)
    } catch (e) {}
  }

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password })
    const { token: t, user: u } = res.data
    setToken(t)
    setUser(u)
    localStorage.setItem('token', t)
    localStorage.setItem('user', JSON.stringify(u))
    loadMockUsers()
    return u
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  const switchUser = async (username) => {
    try {
      const res = await api.post('/auth/login', { username, password: '123456' })
      const { token: t, user: u } = res.data
      setToken(t)
      setUser(u)
      localStorage.setItem('token', t)
      localStorage.setItem('user', JSON.stringify(u))
    } catch (e) {
      alert('切换失败：' + (e.response?.data?.detail || e.message))
    }
  }

  if (loading) return <div style={{ padding: 40 }}>加载中...</div>

  return (
    <AuthContext.Provider value={{ user, token, login, logout, mockUsers, switchUser, refreshUser: loadMockUsers }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><AppLayout><OrderList /></AppLayout></PrivateRoute>} />
          <Route path="/orders" element={<PrivateRoute><AppLayout><OrderList /></AppLayout></PrivateRoute>} />
          <Route path="/orders/:id" element={<PrivateRoute><AppLayout><OrderDetail /></AppLayout></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/orders" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
