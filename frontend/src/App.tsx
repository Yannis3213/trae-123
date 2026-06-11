import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout, Menu, Button, Dropdown, Avatar } from 'antd';
import { UserOutlined, LogoutOutlined, SwapOutlined } from '@ant-design/icons';
import Login from './pages/Login';
import OrderList from './pages/OrderList';
import OrderDetail from './pages/OrderDetail';
import BatchResult from './pages/BatchResult';
import { UserInfo, ROLE_LABEL, api } from './api';

const { Header, Content } = Layout;

function AppContent() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch {}
    } else if (!window.location.pathname.startsWith('/login')) {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    navigate('/login');
  };

  const switchRole = async (role: string, password: string = '123456') => {
    const usernameMap: Record<string, string> = {
      warehouse_keeper: 'keeper1',
      warehouse_supervisor: 'super1',
      operations_manager: 'manager1',
    };
    try {
      const resp = await api.login(usernameMap[role], password);
      if (resp.data.success && resp.data.data) {
        localStorage.setItem('token', resp.data.data.token);
        localStorage.setItem('user', JSON.stringify(resp.data.data.user));
        setUser(resp.data.data.user);
        navigate('/orders');
      }
    } catch {}
  };

  if (!user && !window.location.pathname.startsWith('/login')) {
    return <Navigate to="/login" />;
  }

  const roleItems = [
    { key: 'warehouse_keeper', label: '切换为：库管员' },
    { key: 'warehouse_supervisor', label: '切换为：仓储主管' },
    { key: 'operations_manager', label: '切换为：运营经理' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>
            📦 仓储配送中心 - 月底集中处理入库单系统
          </div>
          {user && (
            <Menu theme="dark" mode="horizontal" selectedKeys={[window.location.pathname]} style={{ background: 'transparent', minWidth: 300 }}>
              <Menu.Item key="/orders" onClick={() => navigate('/orders')}>入库单列表</Menu.Item>
              <Menu.Item key="/batch-result" onClick={() => navigate('/batch-result')}>批量处理结果</Menu.Item>
            </Menu>
          )}
        </div>
        {user && (
          <div className="user-bar">
            <Dropdown
              menu={{
                items: roleItems,
                onClick: ({ key }) => switchRole(key),
              }}
            >
              <Button type="text" style={{ color: '#fff' }} icon={<SwapOutlined />}>
                切换角色
              </Button>
            </Dropdown>
            <Dropdown
              menu={{
                items: [{ key: 'logout', label: '退出登录', icon: <LogoutOutlined /> }],
                onClick: handleLogout as any,
              }}
            >
              <div style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} style={{ background: '#1677ff' }} />
                <span>{user.name}（{ROLE_LABEL[user.role]}）</span>
              </div>
            </Dropdown>
          </div>
        )}
      </Header>
      <Content style={{ background: '#f0f2f5' }}>
        <Routes>
          <Route path="/login" element={<Login onLogin={(u, t) => { setUser(u); localStorage.setItem('user', JSON.stringify(u)); localStorage.setItem('token', t); navigate('/orders'); }} />} />
          <Route path="/orders" element={<OrderList />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/batch-result" element={<BatchResult />} />
          <Route path="*" element={<Navigate to="/orders" />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export default function App() {
  return <AppContent />;
}
