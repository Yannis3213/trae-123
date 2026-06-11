import React, { useEffect, useState } from 'react';
import { Dropdown, Avatar, Button, Modal, message } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  SwapOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { getUser, clearAuth, getRoleName } from '../utils/auth';
import type { User, UserRole } from '../../types';

const Header: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const [switchLoading, setSwitchLoading] = useState(false);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出',
      content: '确定要退出登录吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        clearAuth();
        window.location.href = '/';
      },
    });
  };

  const handleSwitchRole = async (role: UserRole) => {
    setSwitchLoading(true);
    try {
      const response = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('legal_service_token')}`,
        },
        body: JSON.stringify({ role }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('legal_service_user', JSON.stringify(data.user));
        message.success('角色切换成功');
        setSwitchModalVisible(false);
        window.location.reload();
      } else {
        const error = await response.json();
        message.error(error.detail || '角色切换失败');
      }
    } catch {
      message.error('角色切换失败');
    } finally {
      setSwitchLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  const availableRoles: UserRole[] = [user.role];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: (
        <div>
          <div>{user.realName}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>{getRoleName(user.role)}</div>
        </div>
      ),
      disabled: true,
    },
    {
      key: 'switch',
      icon: <SwapOutlined />,
      label: '切换角色',
      onClick: () => setSwitchModalVisible(true),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <header className="header">
      <div className="user-info">
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Avatar icon={<UserOutlined />} />
            <span>{user.realName}</span>
            <DownOutlined style={{ fontSize: '12px' }} />
          </div>
        </Dropdown>
      </div>

      <Modal
        title="切换角色"
        open={switchModalVisible}
        onCancel={() => setSwitchModalVisible(false)}
        footer={null}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {availableRoles.map((role) => (
            <Button
              key={role}
              type={role === user.role ? 'primary' : 'default'}
              onClick={() => handleSwitchRole(role)}
              loading={switchLoading}
              block
            >
              {getRoleName(role)}
              {role === user.role && ' (当前)'}
            </Button>
          ))}
        </div>
      </Modal>
    </header>
  );
};

export default Header;
