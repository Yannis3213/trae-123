import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, getRoleDisplay } from '../contexts/AuthContext'
import { useState } from 'react'
import * as authApi from '../api/auth'

const DEMO_USERS = [
  { username: 'consultant1', label: '张伟（车源顾问）' },
  { username: 'consultant2', label: '李娜（车源顾问）' },
  { username: 'evaluator1', label: '王强（评估师）' },
  { username: 'manager1', label: '赵敏（门店经理）' },
]

function getRoleBadgeClass(role) {
  if (role === 'CONSULTANT') return 'role-badge-consultant'
  if (role === 'EVALUATOR') return 'role-badge-evaluator'
  if (role === 'MANAGER') return 'role-badge-manager'
  return ''
}

export default function Layout() {
  const { currentUser, logout, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [switching, setSwitching] = useState(false)

  const handleSwitchUser = async (username) => {
    setSwitching(true)
    try {
      await login(username)
      navigate('/listings')
    } catch (e) {
      // ignore
    } finally {
      setSwitching(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isListings = location.pathname.startsWith('/listings')
  const isWarnings = location.pathname === '/warnings'

  return (
    <div>
      <header className="header-bar">
        <div className="header-title">二手车交易平台 · 月底集中处理车源上架单系统</div>
        <div className="header-right">
          <span style={{ fontSize: 14 }}>{currentUser?.display_name}</span>
          <span className={`role-badge ${getRoleBadgeClass(currentUser?.role)}`}>
            {getRoleDisplay(currentUser?.role)}
          </span>
          <select
            value=""
            onChange={(e) => handleSwitchUser(e.target.value)}
            disabled={switching}
            style={{ fontSize: 13, padding: '4px 8px' }}
          >
            <option value="">切换角色</option>
            {DEMO_USERS.map((u) => (
              <option key={u.username} value={u.username}>{u.label}</option>
            ))}
          </select>
          <button className="btn-outline btn-sm" onClick={handleLogout} style={{ color: '#fff', borderColor: '#6b7280' }}>
            退出
          </button>
        </div>
      </header>
      <nav className="nav-bar">
        <div
          className={`nav-link ${isListings ? 'active' : ''}`}
          onClick={() => navigate('/listings')}
        >
          车源上架单列表
        </div>
        <div
          className={`nav-link ${isWarnings ? 'active' : ''}`}
          onClick={() => navigate('/listings?tab=warnings')}
        >
          到期预警
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
