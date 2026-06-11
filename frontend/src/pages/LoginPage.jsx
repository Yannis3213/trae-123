import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getRoleDisplay } from '../contexts/AuthContext'
import * as authApi from '../api/auth'
import { getErrorMessage } from '../api/client'

const DEMO_USERS = [
  { username: 'consultant1', display: '张伟', role: 'CONSULTANT' },
  { username: 'consultant2', display: '李娜', role: 'CONSULTANT' },
  { username: 'evaluator1', display: '王强', role: 'EVALUATOR' },
  { username: 'manager1', display: '赵敏', role: 'MANAGER' },
]

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [selectedUser, setSelectedUser] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedInfo = DEMO_USERS.find((u) => u.username === selectedUser)

  const handleLogin = async () => {
    if (!selectedUser) return
    setError('')
    setLoading(true)
    try {
      await login(selectedUser)
      navigate('/listings', { replace: true })
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-title">二手车交易平台</div>
        <div className="login-subtitle">月底集中处理车源上架单系统</div>
        {error && <div className="error-message">{error}</div>}
        <select
          className="login-select"
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
        >
          <option value="">请选择用户</option>
          {DEMO_USERS.map((u) => (
            <option key={u.username} value={u.username}>
              {u.display}（{getRoleDisplay(u.role)}）
            </option>
          ))}
        </select>
        <div className="login-user-info">
          {selectedInfo ? `${selectedInfo.display} - ${getRoleDisplay(selectedInfo.role)}` : ''}
        </div>
        <button
          className="btn-primary"
          style={{ width: '100%', padding: '10px' }}
          onClick={handleLogin}
          disabled={!selectedUser || loading}
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </div>
    </div>
  )
}
