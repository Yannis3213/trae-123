import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const DEMO_ACCOUNTS = [
  { role: '运营专员', username: 'ops01', password: 'ops123' },
  { role: '仓配主管', username: 'warehouse01', password: 'wh123' },
  { role: '店铺负责人', username: 'shop01', password: 'shop123' },
];

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    setError('');
    try {
      await login(values.username, values.password);
      navigate('/orders');
    } catch (e: any) {
      setError(e?.response?.data?.error || '登录失败，请检查账号密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 24,
      }}
    >
      <Card
        style={{
          width: 420,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          borderRadius: 12,
        }}
        bodyStyle={{ padding: 40 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <ShoppingOutlined style={{ fontSize: 48, color: '#1677ff' }} />
          <Title level={3} style={{ marginTop: 16, marginBottom: 4 }}>
            跨境电商订单系统
          </Title>
          <Text type="secondary">月底集中处理跨境订单</Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form name="login" onFinish={onFinish} autoComplete="off" size="large">
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
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #f0f0f0' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            演示账号（点击快速填入）：
          </Text>
          <Space direction="vertical" style={{ width: '100%', marginTop: 12 }}>
            {DEMO_ACCOUNTS.map((a) => (
              <div
                key={a.username}
                style={{
                  padding: '8px 12px',
                  background: '#fafafa',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  border: '1px solid #f0f0f0',
                }}
                onClick={() => {
                  const form = document.querySelector('form') as HTMLFormElement;
                  if (form) {
                    (form.elements.namedItem('username') as HTMLInputElement).value = a.username;
                    (form.elements.namedItem('password') as HTMLInputElement).value = a.password;
                  }
                }}
              >
                <strong>{a.role}：</strong>
                {a.username} / {a.password}
              </div>
            ))}
          </Space>
        </div>
      </Card>
    </div>
  );
}

export default Login;
