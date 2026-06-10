import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import api from '../api'

const ROLE_TIPS = {
  dispatcher: {
    primary: '负责创建预约单、填写团队预约与入园统计、处理待审核、退回后重新提交',
    modules: ['团队预约', '入园统计']
  },
  ticketing: {
    primary: '负责补全票务核销模块，处理待审核单据',
    modules: ['票务核销']
  },
  manager: {
    primary: '负责复核审核通过单据、执行退回与归档、逾期批量推进',
    modules: []
  }
}

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userRole, userName, userLabel, switchRole, ROLE_MAP, notification, showNotification, refreshAll, fetchStats } = useApp()

  const [stats, setStats] = useState(null)
  const [roleSwitchInfo, setRoleSwitchInfo] = useState(null)
  const [showRoleToast, setShowRoleToast] = useState(false)

  const loadStats = async () => {
    try {
      const res = await api.get('/statistics/dashboard')
      if (res.data.success) setStats(res.data.data)
    } catch (e) { console.warn(e) }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const handleSwitchRole = (role) => {
    const prevRole = userRole
    switchRole(role)
    Promise.all([loadStats(), refreshAll()]).then(() => {
      setRoleSwitchInfo({ from: prevRole, to: role })
      setShowRoleToast(true)
      setTimeout(() => setShowRoleToast(false), 6000)
    })
    showNotification(`已切换为：${ROLE_MAP[role]?.label || role}`, 'info')
  }

  const tabs = [
    { key: '/dashboard', label: '首页说明' },
    { key: '/bookings', label: '团队预约单' },
    { key: '/warnings', label: '到期预警队列' }
  ]

  const roleStats = stats?.my_missing_modules || {}
  const myActionable = stats?.my_actionable_count || 0

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🏔️ 景区运营公司 - 月底集中处理团队预约单系统</h1>
        <div className="header-right">
          <div className="role-selector">
            {Object.entries(ROLE_MAP).map(([key, info]) => {
              const missingCount = (key === userRole && stats)
                ? Object.values(stats.my_missing_modules || {}).reduce((s, m) => s + (m.count || 0), 0)
                : 0
              return (
                <button
                  key={key}
                  className={`role-btn ${userRole === key ? 'active' : ''}`}
                  onClick={() => handleSwitchRole(key)}
                  title={ROLE_TIPS[key]?.primary}
                >
                  {info.label}
                  {missingCount > 0 && (
                    <span style={{
                      marginLeft: 6, background: '#dc3545', color: '#fff',
                      padding: '0 6px', borderRadius: 10, fontSize: 11
                    }}>{missingCount}</span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="user-info">
            当前用户：{userName}（{userLabel}）
            {myActionable > 0 && (
              <span style={{
                marginLeft: 8, background: 'rgba(255,255,255,0.2)', padding: '2px 8px',
                borderRadius: 4
              }}>待我处理：<strong>{myActionable}</strong> 张</span>
            )}
          </div>
        </div>
      </header>

      {showRoleToast && roleSwitchInfo && stats && (
        <div className="role-switch-toast">
          <div className="alert-banner info" style={{ boxShadow: '0 8px 24px rgba(0,0,0,.15)' }}>
            <div className="alert-icon">🔄</div>
            <div className="alert-body">
              <div className="alert-title">
                已切换角色：{ROLE_MAP[roleSwitchInfo.from]?.label} → {ROLE_MAP[roleSwitchInfo.to]?.label}
              </div>
              <div>
                <strong>职责：</strong>{ROLE_TIPS[roleSwitchInfo.to]?.primary}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>待我处理：</strong>{stats.my_actionable_count || 0} 张单据
                {Object.keys(stats.my_missing_modules || {}).length > 0 && (
                  <div className="missing-chip-list" style={{ marginTop: 4 }}>
                    {Object.values(stats.my_missing_modules).map((m, i) => (
                      <span key={i} className="missing-chip">
                        ⛔ 我负责补正【{m.label}】 × {m.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {ROLE_TIPS[roleSwitchInfo.to]?.modules.length > 0 && (
                <div style={{ marginTop: 4, fontSize: 12, opacity: .9 }}>
                  💡 你负责的证据模块：{ROLE_TIPS[roleSwitchInfo.to].modules.join('、')}
                </div>
              )}
              {roleSwitchInfo.to === 'ticketing' && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#b54708' }}>
                  ⚠️ 票务专员不可越权操作团队预约与入园统计模块
                </div>
              )}
              {roleSwitchInfo.to === 'manager' && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#b54708' }}>
                  ⚠️ 景区经理不能替现场调度归档前的处理环节，状态冲突时会保留原值
                </div>
              )}
              {roleSwitchInfo.to === 'dispatcher' && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#b54708' }}>
                  ⚠️ 现场调度不能跳过景区经理直接归档
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
