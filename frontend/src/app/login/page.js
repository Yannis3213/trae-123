'use client';

import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space, Select } from 'antd';
import { UserOutlined, LockOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

const { Title, Text } = Typography;

const demoAccounts = [
  { username: 'registrar', name: '张登记', role: '商家入驻登记员' },
  { username: 'auditor', name: '李审核', role: '商家入驻审核主管' },
  { username: 'leader', name: '王负责', role: 'B2B批发平台复核负责人' },
];

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    try {
      await login(values.username, values.password);
      router.push('/forms');
    } catch (err) {
      setError(err.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (username) => {
    setSelectedAccount(username);
    onFinish({ username, password: '123456' });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: 24
    }}>
      <Card style={{ width: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ margin: 0, color: '#1677ff' }}>
            B2B批发平台
          </Title>
          <Text type="secondary">月底集中处理商家入驻单系统</Text>
        </div>

        {error && (
          <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
        )}

        <Form
          name="login"
          initialValues={{ username: selectedAccount, password: '123456' }}
          onFinish={onFinish}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              登录系统
            </Button>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666' }}>
              <UserSwitchOutlined />
              <Text type="secondary">快捷登录（演示账号）：</Text>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {demoAccounts.map(acc => (
                <Button
                  key={acc.username}
                  onClick={() => handleQuickLogin(acc.username)}
                  loading={loading && selectedAccount === acc.username}
                  style={{ flex: 1, minWidth: 140 }}
                >
                  <div style={{ textAlign: 'left', fontSize: 12 }}>
                    <div style={{ fontWeight: 500 }}>{acc.name}</div>
                    <div style={{ color: '#999', fontSize: 11 }}>{acc.role}</div>
                  </div>
                </Button>
              ))}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              所有演示账号密码均为：123456
            </Text>
          </Space>
        </div>
      </Card>
    </div>
  );
}
