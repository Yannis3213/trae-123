import React from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userRole, userName, userLabel, switchRole, ROLE_MAP, notification } = useApp()

  const tabs = [
    { key: '/dashboard', label: '首页说明' },
    { key: '/bookings', label: '团队预约单' },
    { key: '/warnings', label: '到期预警队列' }
  ]

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🏔️ 景区运营公司 - 月底集中处理团队预约单系统</h1>
        <div className="header-right">
          <div className="role-selector">
            {Object.entries(ROLE_MAP).map(([key, info]) => (
              <button
                key={key}
                className={`role-btn ${userRole === key ? 'active' : ''}`}
                onClick={() => switchRole(key)}
              >
                {info.label}
              </button>
            ))}
          </div>
          <div className="user-info">
            当前用户：{userName}（{userLabel}）
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="nav-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`nav-tab ${location.pathname.startsWith(tab.key) ? 'active' : ''}`}
              onClick={() => navigate(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Outlet />
      </main>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  )
}
