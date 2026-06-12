import { createRootRoute, Outlet, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getUser, clearAuth, User, api } from '~/app/api'
import '~/app/styles.css'

function AuthHeader() {
  const [user, setUser] = useState<User | null>(null)
  const nav = useNavigate()
  const router = useRouter()

  useEffect(() => {
    setUser(getUser())
    const handler = () => setUser(getUser())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const refreshUser = () => setUser(getUser())

  useEffect(() => {
    router.subscribe('onResolved', refreshUser)
    return () => router.unsubscribe('onResolved', refreshUser)
  }, [router])

  const doLogout = async () => {
    try {
      await api.logout()
    } catch {}
    clearAuth()
    setUser(null)
    nav({ to: '/login' })
  }

  if (!user) {
    return (
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <Link to="/" className="text-xl font-bold text-primary-700">
          📋 企业培训公司 - 月底集中处理培训项目单系统
        </Link>
        <div className="text-sm text-gray-500">端口 前端 3106 / 后端 8106</div>
      </header>
    )
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <Link to="/" className="text-xl font-bold text-primary-700">
          📋 企业培训公司 - 月底集中处理培训项目单系统
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 rounded-md border border-primary-200">
            <span className="text-gray-600">当前角色：</span>
            <span className="font-semibold text-primary-700">{user.role_name}</span>
          </div>
          <div className="px-3 py-1.5 bg-gray-50 rounded-md border border-gray-200">
            <span className="text-gray-600">账号：</span>
            <span className="font-medium">{user.full_name} ({user.username})</span>
          </div>
          <Link to="/switch-role" className="btn !py-1 !px-2.5 text-xs">
            切换角色
          </Link>
          <button onClick={doLogout} className="btn btn-danger !py-1 !px-2.5 text-xs">
            退出登录
          </button>
        </div>
      </div>
      <nav className="flex gap-1 text-sm">
        <Link to="/" className="px-3 py-1.5 rounded hover:bg-gray-100 text-gray-700">
          📊 工作台
        </Link>
        <Link to="/projects" className="px-3 py-1.5 rounded hover:bg-gray-100 text-gray-700">
          📝 项目单列表
        </Link>
        <Link to="/projects/new" className="px-3 py-1.5 rounded hover:bg-gray-100 text-gray-700">
          ➕ 新建项目单
        </Link>
        <Link to="/deadline" className="px-3 py-1.5 rounded hover:bg-gray-100 text-gray-700">
          ⏰ 到期预警
        </Link>
      </nav>
    </header>
  )
}

function AuthBoundary() {
  const user = getUser()
  const nav = useNavigate()

  useEffect(() => {
    if (!user) {
      const current = window.location.pathname
      if (current !== '/login') {
        nav({ to: '/login' })
      }
    }
  }, [user, nav])

  return null
}

export const Route = createRootRoute({
  component: () => {
    const user = getUser()
    return (
      <div className="min-h-screen flex flex-col">
        {user && <AuthBoundary />}
        <AuthHeader />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
        <footer className="text-center text-xs text-gray-500 py-4 border-t bg-white">
          © 企业培训公司 · 前端端口 3106 · 后端端口 8106 · TanStack Start + FastAPI + SQLite
        </footer>
      </div>
    )
  },
})
