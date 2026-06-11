import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space, Select } from 'antd';
import { SafetyOutlined, UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROLE_DISPLAY, Role } from '../types';

const { Title, Text } = Typography;
const { Option } = Select;

interface LoginFormData {
  username: string;
  password: string;
  role: Role;
}

const demoAccounts: Record<Role, { username: string; password: string; name: string }> = {
  dispatcher: { username: 'dispatcher', password: '123456', name: '张登记' },
  police_officer: { username: 'officer', password: '123456', name: '李主管' },
  reviewer: { username: 'reviewer', password: '123456', name: '王所长' },
};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>('dispatcher');

  const handleRoleChange = (role: Role) => {
    setSelectedRole(role);
    form.setFieldsValue({
      username: demoAccounts[role].username,
      password: demoAccounts[role].password,
    });
  };

  const [form] = Form.useForm<LoginFormData>();

  const handleSubmit = async (values: LoginFormData) => {
    setLoading(true);
    setError(null);
    try {
      await login({ username: values.username, password: values.password });
      navigate('/cases');
    } catch (err: any) {
      const message = err.response?.data?.message || '登录失败，请检查用户名和密码';
      setError(message);
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
        background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        padding: 24,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          borderRadius: 12,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <SafetyOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
          <Title level={3} style={{ marginBottom: 8 }}>
            派出所警情处置系统
          </Title>
          <Text type="secondary">月底集中处理警情处置单系统</Text>
        </div>

        <Alert
          message="演示账号"
          description={
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Text strong>登记员：</Text>dispatcher / 123456
              </div>
              <div>
                <Text strong>民警：</Text>officer / 123456
              </div>
              <div>
                <Text strong>所长：</Text>reviewer / 123456
              </div>
            </Space>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            role: 'dispatcher',
            username: demoAccounts.dispatcher.username,
            password: demoAccounts.dispatcher.password,
          }}
        >
          <Form.Item
            label="登录角色"
            name="role"
            rules={[{ required: true, message: '请选择登录角色' }]}
          >
            <Select
              value={selectedRole}
              onChange={handleRoleChange}
              placeholder="选择登录角色"
            >
              <Option value="dispatcher">{ROLE_DISPLAY.dispatcher} (张登记)</Option>
              <Option value="police_officer">{ROLE_DISPLAY.police_officer} (李主管)</Option>
              <Option value="reviewer">{ROLE_DISPLAY.reviewer} (王所长)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              登录系统
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
