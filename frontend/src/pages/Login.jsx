import React from 'react'
import { Form, Input, Button, message } from 'antd'
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const navigate = useNavigate()
  const { login, loading, demoAccounts } = useAuth()

  const handleSubmit = async (values) => {
    const success = await login(values.username, values.password)
    if (success) {
      navigate('/')
    }
  }

  const handleQuickLogin = (username) => {
    handleSubmit({ username, password: 'test123456' })
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <SafetyOutlined style={{ fontSize: 48, color: '#1677ff', display: 'block', margin: '0 auto 16px' }} />
        <h1 className="login-title">需求交付单管理系统</h1>
        <p className="login-subtitle">Requirement Delivery Management System</p>

        <Form onFinish={handleSubmit} layout="vertical" size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>

        <div className="demo-accounts">
          <div className="demo-accounts-title">演示账号（密码均为：test123456）</div>
          {demoAccounts.map((account) => (
            <div
              key={account.username}
              className="demo-account-item"
              onClick={() => handleQuickLogin(account.username)}
            >
              {account.username} - {account.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
