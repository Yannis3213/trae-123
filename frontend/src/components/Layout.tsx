import React, { useState } from 'react';
import { Layout as AntLayout, Menu, Dropdown, Avatar, Space, Tag, Button, Modal } from 'antd';
import {
  UserOutlined,
  ShoppingOutlined,
  LogoutOutlined,
  SwapOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../types';
import RoleSwitcher from './RoleSwitcher';

const { Header, Content, Sider } = AntLayout;

const ROLE_LABELS: Record<Role, string> = {
  ops_specialist: '运营专员',
  warehouse_manager: '仓配主管',
  shop_owner: '店铺负责人',
};

const ROLE_COLORS: Record<Role, string> = {
  ops_specialist: 'blue',
  warehouse_manager: 'purple',
  shop_owner: 'green',
};

function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [roleModalOpen, setRoleModalOpen] = useState(false);

  const menuItems = [
    {
      key: '/orders',
      icon: <ShoppingOutlined />,
      label: '跨境订单',
    },
  ];

  const userMenu = {
    items: [
      {
        key: 'switch',
        icon: <SwapOutlined />,
        label: '切换角色',
        onClick: () => setRoleModalOpen(true),
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: () => {
          logout();
          navigate('/login');
        },
      },
    ],
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark" style={{ position: 'sticky', top: 0, height: '100vh' }}>
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          跨境订单系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,21,41,.08)',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600, color: '#262626' }}>
            月底集中处理跨境订单系统
          </div>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer', padding: '0 8px', borderRadius: 4 }}>
              <Avatar icon={<UserOutlined />} />
              <Space direction="vertical" size={0} style={{ lineHeight: 1.2 }}>
                <span style={{ color: '#262626', fontSize: 14, fontWeight: 500 }}>
                  {user?.name}
                </span>
                <Tag color={ROLE_COLORS[user?.role || 'ops_specialist']} style={{ margin: 0 }}>
                  <TeamOutlined /> {ROLE_LABELS[user?.role || 'ops_specialist']}
                </Tag>
              </Space>
            </Space>
          </Dropdown>
        </Header>
        <Content className="page-container">{children}</Content>
      </AntLayout>
      <RoleSwitcher open={roleModalOpen} onClose={() => setRoleModalOpen(false)} />
    </AntLayout>
  );
}

export default Layout;
