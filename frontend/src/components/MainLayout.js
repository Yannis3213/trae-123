'use client';

import { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge, Button, Space, Modal, Select, Typography } from 'antd';
import { useRouter, usePathname } from 'next/navigation';
import {
  ShopOutlined,
  FileSearchOutlined,
  FormOutlined,
  AlertOutlined,
  LogoutOutlined,
  UserSwitchOutlined,
  BellOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { authApi, alertsApi } from '../lib/api';
import { getRoleLabel } from '../lib/utils';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: '工作台',
    path: '/dashboard',
  },
  {
    key: 'forms-entry',
    icon: <ShopOutlined />,
    label: '商家入驻',
    path: '/forms?node=entry_registration',
  },
  {
    key: 'forms-qualification',
    icon: <FileSearchOutlined />,
    label: '资质审核',
    path: '/forms?node=qualification_audit',
  },
  {
    key: 'forms-registration',
    icon: <FormOutlined />,
    label: '商家入驻单登记',
    path: '/forms?node=entry_form_registration',
  },
  {
    key: 'forms-all',
    icon: <FileSearchOutlined />,
    label: '全部入驻单',
    path: '/forms',
  },
  {
    key: 'alerts',
    icon: <AlertOutlined />,
    label: '到期预警',
    path: '/alerts',
  },
];

export default function MainLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [users, setUsers] = useState([]);
  const [switchUserModalVisible, setSwitchUserModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [alertCount, setAlertCount] = useState(0);
  const { user, logout, switchUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchUsers();
      fetchAlertCount();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      const response = await authApi.getUsers();
      if (response.success) {
        setUsers(response.data.users);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchAlertCount = async () => {
    try {
      const response = await alertsApi.getDeadlineAlerts({ group: 'overdue' });
      if (response.success) {
        setAlertCount(response.data.stats?.overdue || 0);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  };

  const handleMenuClick = ({ key }) => {
    const item = menuItems.find(m => m.key === key);
    if (item?.path) {
      router.push(item.path);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleSwitchUser = async () => {
    if (!selectedUser) return;
    try {
      await switchUser(selectedUser.username, '123456');
      setSwitchUserModalVisible(false);
      setSelectedUser(null);
      router.refresh();
    } catch (err) {
      console.error('Failed to switch user:', err);
    }
  };

  const getSelectedKey = () => {
    if (pathname === '/dashboard') return 'dashboard';
    if (pathname === '/alerts') return 'alerts';
    if (pathname === '/forms' || pathname.startsWith('/forms/')) {
      const params = new URLSearchParams(window.location.search);
      const node = params.get('node');
      if (node === 'entry_registration') return 'forms-entry';
      if (node === 'qualification_audit') return 'forms-qualification';
      if (node === 'entry_form_registration') return 'forms-registration';
      return 'forms-all';
    }
    return '';
  };

  if (loading || !user) {
    return <div style={{ padding: 24 }}>加载中...</div>;
  }

  const userMenuItems = [
    {
      key: 'switch',
      icon: <UserSwitchOutlined />,
      label: '切换角色',
      onClick: () => setSwitchUserModalVisible(true),
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

  const filteredMenuItems = menuItems.filter(item => {
    if (item.key === 'dashboard') return true;
    if (item.key === 'alerts') return true;
    if (item.key === 'forms-all') return true;
    if (item.key === 'forms-entry' && user.role === 'merchant_registrar') return true;
    if (item.key === 'forms-qualification' && user.role === 'audit_supervisor') return true;
    if (item.key === 'forms-registration' && user.role === 'merchant_registrar') return true;
    if (item.key === 'forms-final' && user.role === 'platform_leader') return true;
    return false;
  });

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ background: '#001529' }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: '0 16px',
          color: '#fff',
          fontSize: collapsed ? 20 : 18,
          fontWeight: 'bold',
          borderBottom: '1px solid #002140'
        }}>
          {collapsed ? 'B2B' : 'B2B批发平台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={filteredMenuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <div>
            <Text strong style={{ fontSize: 16 }}>
              月底集中处理商家入驻单系统
            </Text>
          </div>
          <Space size="large">
            <Badge count={alertCount} offset={[0, 2]}>
              <Button
                type="text"
                icon={<BellOutlined style={{ fontSize: 18 }} />}
                onClick={() => router.push('/alerts')}
              />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar style={{ backgroundColor: '#1677ff' }}>
                  {user.realName?.[0]}
                </Avatar>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{user.realName}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{getRoleLabel(user.role)}</div>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: 0, padding: 24, background: '#f5f7fa' }}>
          {children}
        </Content>
      </Layout>

      <Modal
        title="切换角色"
        open={switchUserModalVisible}
        onOk={handleSwitchUser}
        onCancel={() => setSwitchUserModalVisible(false)}
        okText="切换"
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">选择要切换的角色账号（密码均为123456）：</Text>
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder="选择账号"
          value={selectedUser?.username}
          onChange={(value) => {
            const u = users.find(us => us.username === value);
            setSelectedUser(u);
          }}
          options={users.map(u => ({
            value: u.username,
            label: `${u.realName} - ${getRoleLabel(u.role)}`,
          }))}
        />
      </Modal>
    </Layout>
  );
}
