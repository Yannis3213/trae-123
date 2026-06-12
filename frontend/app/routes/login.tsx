import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { api, setAuth, LoginRequest } from '~/app/api'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const [form, setForm] = useState<LoginRequest>({ username: 'consultant', password: '123456' })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const accounts = [
    { label: '课程顾问（张老师）', u: 'consultant', p: '123456', role: '培训项目登记员' },
    { label: '讲师运营（李运营）', u: 'trainer_ops', p: '123456', role: '培训项目审核主管' },
    { label: '项目经理（王经理）', u: 'project_mgr', p: '123456', role: '企业培训公司复核负责人' },
  ]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const u = await api.login(form)
      setAuth(u.token!, { ...u, token: undefined })
      nav({ to: '/' })
    } catch (e: any) {
      setErr(e.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = async (u: string, p: string) => {
    setForm({ username: u, password: p })
    setErr('')
    setLoading(true)
    try {
      const user = await api.login({ username: u, password: p })
      setAuth(user.token!, { ...user, token: undefined })
      nav({ to: '/' })
    } catch (e: any) {
      setErr(e.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 card p-8">
      <h1 className="text-2xl font-bold text-center mb-6 text-primary-700">
        培训项目单系统登录
      </h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">账号</label>
          <input
            className="input"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="请输入账号"
          />
        </div>
        <div>
          <label className="label">密码</label>
          <input
            type="password"
            className="input"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="请输入密码"
          />
        </div>
        {err && <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">{err}</div>}
        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? '登录中...' : '登 录'}
        </button>
      </form>
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="text-sm font-medium text-gray-600 mb-3">演示账号（点击一键登录）：</div>
        <div className="space-y-2">
          {accounts.map((a) => (
            <button
              key={a.u}
              type="button"
              onClick={() => quickLogin(a.u, a.p)}
              className="w-full text-left px-3 py-2 rounded border border-gray-200 hover:bg-primary-50 hover:border-primary-300 text-sm transition-colors"
            >
              <div className="font-medium text-gray-800">{a.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                账号 {a.u} / 密码 123456 · {a.role}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
