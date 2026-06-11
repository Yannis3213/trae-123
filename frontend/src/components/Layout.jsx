import React from 'react'
import { Layout as AntLayout, Menu, Avatar, Dropdown, Space } from 'antd'
import {
  DashboardOutlined,
  UnorderedListOutlined,
  UserOutlined,
  LogoutOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const { Header, Sider, Content } = AntLayout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '工作台' },
  { key: '/orders', icon: <UnorderedListOutlined />, label: '订单管理' }
]

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  const handleMenuClick = ({ key }) => {
    navigate(key)
  }

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: `${user?.role_display || '用户'} (${user?.username || ''})`
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: logout
    }
  ]

  return (
    <AntLayout className="layout-container">
      <Sider width={220} className="layout-sider">
        <div className="logo">需求交付单管理系统</div>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[location.pathname.startsWith('/orders') ? '/orders' : '/']}
          onClick={handleMenuClick}
          items={menuItems}
          style={{ height: 'calc(100% - 64px)', borderRight: 0 }}
        />
      </Sider>
      <AntLayout>
        <Header className="layout-header">
          <div></div>
          <div className="header-user-info">
            <div style={{ marginRight: 16, color: 'rgba(0,0,0,0.65)', fontSize: 13 }}>
              角色：<span style={{ color: '#1677ff', fontWeight: 500 }}>{user?.role_display || '-'}</span>
            </div>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.username || '用户'}</span>
              </Space>
            </Dropdown>
          </div>
        </Header>
        <Content className="layout-content">
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  )
}
