import { useState } from 'react';
import { Form, Input, Button, Card, Select, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { api, UserInfo } from '../api';

interface Props {
  onLogin: (user: UserInfo, token: string) => void;
}

const DEMO_USERS = [
  { username: 'keeper1', name: '库管员张三', role: '库管员', pwd: '123456' },
  { username: 'keeper2', name: '库管员李四', role: '库管员', pwd: '123456' },
  { username: 'super1', name: '仓储主管王五', role: '仓储主管', pwd: '123456' },
  { username: 'manager1', name: '运营经理赵六', role: '运营经理', pwd: '123456' },
];

export default function Login({ onLogin }: Props) {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const resp = await api.login(values.username, values.password);
      if (resp.data.success && resp.data.data) {
        message.success('登录成功');
        onLogin(resp.data.data.user, resp.data.data.token);
      } else {
        message.error(resp.data.message || '登录失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '网络错误，请确认后端已启动(端口8109)');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (u: typeof DEMO_USERS[0]) => {
    form.setFieldsValue({ username: u.username, password: u.pwd });
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-title">📦 仓储入库单系统</div>
        <div className="login-subtitle">月底集中处理入库单系统</div>
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ password: '123456' }}>
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              登 录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 10 }}>演示账号（密码均为 123456）：</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEMO_USERS.map((u) => (
              <Button key={u.username} size="small" onClick={() => fillDemo(u)}>
                {u.name}（{u.role}）— {u.username}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
