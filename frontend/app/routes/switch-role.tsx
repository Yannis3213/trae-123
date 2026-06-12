import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { api, getUser, setAuth } from '~/app/api'
import { useState } from 'react'

export const Route = createFileRoute('/switch-role')({
  component: SwitchRole,
})

function SwitchRole() {
  const users = [
    { username: 'consultant', full_name: '张老师', role_name: '课程顾问（培训项目登记员）', password: '123456' },
    { username: 'trainer_ops', full_name: '李运营', role_name: '讲师运营（培训项目审核主管）', password: '123456' },
    { username: 'project_mgr', full_name: '王经理', role_name: '项目经理（企业培训公司复核负责人）', password: '123456' },
  ]
  const current = getUser()
  const nav = useNavigate()
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const switchUser = async (u: any) => {
    if (u.username === current?.username) {
      setMsg('已是当前角色')
      return
    }
    setLoading(true)
    setMsg('')
    try {
      const res = await api.login({ username: u.username, password: u.password })
      setAuth(res.token!, { ...res, token: undefined })
      setMsg(`已切换至 ${u.role_name}`)
      setTimeout(() => nav({ to: '/' }), 500)
    } catch (e: any) {
      setMsg(e.message || '切换失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto card p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-4">🔄 快速切换角色</h1>
      <p className="text-sm text-gray-500 mb-4">
        演示环境支持快速切换账号角色，无需重复输入密码。正式环境请使用正常登录流程。
      </p>
      {msg && <div className="mb-4 p-2 rounded bg-green-50 text-green-700 border border-green-200 text-sm">{msg}</div>}
      <div className="space-y-3">
        {users.map((u) => {
          const active = u.username === current?.username
          return (
            <div
              key={u.username}
              className={`p-4 rounded border flex items-center justify-between transition-colors ${
                active
                  ? 'bg-primary-50 border-primary-300'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div>
                <div className="font-semibold text-gray-800">{u.full_name}</div>
                <div className="text-sm text-gray-600">{u.role_name}</div>
                <div className="text-xs text-gray-400 mt-1">账号：{u.username}</div>
              </div>
              {active ? (
                <span className="badge bg-primary-100 text-primary-700 border-primary-200">当前</span>
              ) : (
                <button onClick={() => switchUser(u)} disabled={loading} className="btn btn-primary !py-1.5">
                  切换
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-6">
        <button onClick={() => nav({ to: '/' })} className="btn">← 返回工作台</button>
      </div>
    </div>
  )
}
