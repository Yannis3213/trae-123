import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import request from '../utils/request';
import { setToken, setUser } from '../utils/auth';
import type { LoginResponse } from '../../types';

interface LoginFormProps {
  onSuccess?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { username: string; password: string; remember?: boolean }) => {
    setLoading(true);
    try {
      const result = await request.post<LoginResponse>('/auth/login', {
        username: values.username,
        password: values.password,
      });

      setToken(result.token);
      setUser(result.user);

      if (values.remember) {
        localStorage.setItem('remember_username', values.username);
      } else {
        localStorage.removeItem('remember_username');
      }

      message.success('登录成功');

      if (onSuccess) {
        onSuccess();
      } else {
        window.location.href = '/dashboard';
      }
    } catch (error: any) {
      message.error(error.message || error.response?.data?.detail || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  const rememberedUsername = localStorage.getItem('remember_username');

  return (
    <Form
      name="login"
      initialValues={{ remember: true, username: rememberedUsername || '' }}
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
          autoComplete="username"
        />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="密码"
          autoComplete="current-password"
        />
      </Form.Item>

      <Form.Item>
        <Form.Item name="remember" valuePropName="checked" noStyle>
          <Checkbox>记住我</Checkbox>
        </Form.Item>
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          block
        >
          登录
        </Button>
      </Form.Item>
    </Form>
  );
};

export default LoginForm;
