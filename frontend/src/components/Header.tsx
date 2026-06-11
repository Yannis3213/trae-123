import React, { useEffect, useState } from 'react';
import { Dropdown, Avatar, Modal } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { getUser, clearAuth, getRoleName } from '../utils/auth';
import type { User } from '../../types';

const Header: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

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

  if (!user) {
    return null;
  }

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: (
        <div>
          <div>{user.real_name}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>{getRoleName(user.role)}</div>
        </div>
      ),
      disabled: true,
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
            <span>{user.real_name}</span>
            <DownOutlined style={{ fontSize: '12px' }} />
          </div>
        </Dropdown>
      </div>
    </header>
  );
};

export default Header;
