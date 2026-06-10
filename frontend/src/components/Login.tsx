import { useState } from 'react'
import type { User } from '../types'
import { ROLE_LABELS } from '../types'
import * as api from '../api'

interface LoginProps {
  onLogin: (user: User) => void
}

const DEMO_ACCOUNTS = [
  { username: 'ziliaoyuan', password: '123456', role: 'document_clerk' },
  { username: 'shigongfzr', password: '123456', role: 'construction_manager' },
  { username: 'xiangmujl', password: '123456', role: 'project_manager' },
]

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login(username, password)
      onLogin(data.user)
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = async (account: typeof DEMO_ACCOUNTS[0]) => {
    setError('')
    setLoading(true)
    try {
      const data = await api.login(account.username, account.password)
      onLogin(data.user)
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>建筑施工项目部</h1>
        <p className="subtitle">月底集中处理分包进场单系统</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 12, color: '#8c8c8c', textAlign: 'center', marginBottom: 12 }}>
            演示账号（点击快速登录）
          </p>
          <div className="account-cards">
            {DEMO_ACCOUNTS.map(acc => (
              <div
                key={acc.username}
                className="account-card"
                onClick={() => handleQuickLogin(acc)}
              >
                <div className="account-role">{ROLE_LABELS[acc.role]}</div>
                <div className="account-name">{acc.username === 'ziliaoyuan' ? '张资料' : acc.username === 'shigongfzr' ? '李施工' : '王项目'}</div>
                <div className="account-user">{acc.username}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
