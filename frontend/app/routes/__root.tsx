import {
  Outlet,
  createRootRoute,
  Scripts,
  HeadContent,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

const DEMO_USERS = [
  { username: 'consultant1', label: '张伟（车源顾问）' },
  { username: 'consultant2', label: '李娜（车源顾问）' },
  { username: 'evaluator1', label: '王强（评估师）' },
  { username: 'manager1', label: '赵敏（门店经理）' },
]

const ROLE_DISPLAY: Record<string, string> = {
  CONSULTANT: '车源顾问',
  EVALUATOR: '评估师',
  MANAGER: '门店经理',
}

function getRoleBadgeClass(role: string | undefined) {
  if (role === 'CONSULTANT') return 'role-badge-consultant'
  if (role === 'EVALUATOR') return 'role-badge-evaluator'
  if (role === 'MANAGER') return 'role-badge-manager'
  return ''
}

function AppContent() {
  const { currentUser, logout, login, loading } = useAuth()
  const navigate = useNavigate()
  const location = useRouterState({ select: (s) => s.location })
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    if (!loading && !currentUser && location.pathname !== '/login') {
      navigate({ to: '/login', replace: true })
    }
    if (!loading && currentUser && location.pathname === '/login') {
      navigate({ to: '/listings', replace: true })
    }
  }, [loading, currentUser, location.pathname, navigate])

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
        加载中...
      </div>
    )
  }

  if (!currentUser) {
    return <Outlet />
  }

  const handleSwitchUser = async (username: string) => {
    setSwitching(true)
    try {
      await login(username)
      navigate({ to: '/listings' })
    } catch {
      // ignore
    } finally {
      setSwitching(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate({ to: '/login' })
  }

  return (
    <div>
      <header className="header-bar">
        <div className="header-title">
          二手车交易平台 · 月底集中处理车源上架单系统
        </div>
        <div className="header-right">
          <span style={{ fontSize: 14 }}>{currentUser?.display_name}</span>
          <span
            className={`role-badge ${getRoleBadgeClass(currentUser?.role)}`}
          >
            {ROLE_DISPLAY[currentUser?.role] || currentUser?.role}
          </span>
          <select
            value=""
            onChange={(e) => handleSwitchUser(e.target.value)}
            disabled={switching}
            style={{ fontSize: 13, padding: '4px 8px' }}
          >
            <option value="">切换角色</option>
            {DEMO_USERS.map((u) => (
              <option key={u.username} value={u.username}>
                {u.label}
              </option>
            ))}
          </select>
          <button
            className="btn-outline btn-sm"
            onClick={handleLogout}
            style={{ color: '#fff', borderColor: '#6b7280' }}
          >
            退出
          </button>
        </div>
      </header>
      <nav className="nav-bar">
        <div
          className="nav-link"
          onClick={() => navigate({ to: '/listings' })}
        >
          车源上架单列表
        </div>
        <div
          className="nav-link"
          onClick={() =>
            navigate({ to: '/listings', search: { tab: 'warnings' } })
          }
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

function RootComponent() {
  return (
    <RootDocument>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: '二手车交易平台 · 车源上架单系统',
      },
    ],
  }),
  component: RootComponent,
})
