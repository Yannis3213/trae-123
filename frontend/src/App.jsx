import React, { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import OrderList from './pages/OrderList.jsx'
import OrderDetail from './pages/OrderDetail.jsx'
import CreateOrder from './pages/CreateOrder.jsx'
import Warnings from './pages/Warnings.jsx'
import { ROLES, ROLE_LABEL, getCurrentRole, setCurrentRole, getCurrentUser } from './api.js'

export const AppContext = createContext(null)

function Header({ role, user, onRoleChange }) {
  return (
    <header className="app-header">
      <h1>🛡️ 保险代理公司-月底集中处理投保申请系统</h1>
      <div className="user-panel">
        <select
          className="role-select"
          value={role}
          onChange={(e) => onRoleChange(e.target.value)}
        >
          {ROLES.map(r => (
            <option key={r.value} value={r.value}>角色：{r.label}</option>
          ))}
        </select>
        <div className="user-name">👤 {user.name}（{ROLE_LABEL[role]}）</div>
      </div>
    </header>
  )
}

function Sidebar() {
  const nav = useNavigate()
  const loc = useLocation()
  const items = [
    { key: '/', label: '📊 工作台', exact: true },
    { key: '/orders/register', label: '📝 投保申请登记' },
    { key: '/orders/verify', label: '✅ 过程核验' },
    { key: '/orders/review', label: '📁 复核归档' },
    { key: '/warnings', label: '⏰ 到期预警' },
  ]
  const isActive = (key, exact) => exact ? loc.pathname === key : loc.pathname.startsWith(key)
  return (
    <aside className="app-sidebar">
      {items.map(it => (
        <div
          key={it.key}
          className={'nav-item' + (isActive(it.key, it.exact) ? ' active' : '')}
          onClick={() => nav(it.key)}
        >{it.label}</div>
      ))}
    </aside>
  )
}

export default function App() {
  const [role, setRole] = useState(getCurrentRole())
  const [user, setUser] = useState(getCurrentUser())
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setCurrentRole(role)
    setUser(getCurrentUser())
  }, [role])

  const triggerRefresh = () => setRefreshKey(v => v + 1)

  return (
    <AppContext.Provider value={{ role, user, refreshKey, triggerRefresh }}>
      <div className="app-container">
        <Header role={role} user={user} onRoleChange={setRole} />
        <div className="app-layout">
          <Sidebar />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders/register" element={<OrderList mode="register" />} />
              <Route path="/orders/verify" element={<OrderList mode="verify" />} />
              <Route path="/orders/review" element={<OrderList mode="review" />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/orders/create" element={<CreateOrder />} />
              <Route path="/warnings" element={<Warnings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
