import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App.jsx'

export default function Login() {
  const [username, setUsername] = useState('opt1')
  const [password, setPassword] = useState('123456')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(username, password)
      navigate('/orders')
    } catch (err) {
      setError(err.response?.data?.detail || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>👓 眼科诊所配镜订单系统</h2>
        <p className="subtitle">月底集中处理 · 角色接力流转</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名" required />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码" required />
          </div>
          {error && <div className="alert-box error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>
        <div className="login-hint">
          <p><strong>测试账号（密码均为 123456）：</strong></p>
          <p>验光师：opt1（王验光）、opt2（李验光）</p>
          <p>眼科医生：oph1（张眼科）、oph2（刘眼科）</p>
          <p>运营主管：ops1（陈运营）、ops2（赵运营）</p>
        </div>
      </div>
    </div>
  )
}
