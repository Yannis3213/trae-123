import { Component, createSignal, JSX } from 'solid-js';
import { A, useNavigate, useLocation } from '@solidjs/router';
import { user, logout, loginWithDemo } from '../store/auth';
import { getRoleLabel, DEMO_ACCOUNTS } from '../utils/role';
import type { UserRole } from '../types';

interface LayoutProps {
  children: JSX.Element;
}

const Layout: Component<LayoutProps> = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showRoleMenu, setShowRoleMenu] = createSignal(false);
  const [showUserMenu, setShowUserMenu] = createSignal(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSwitchRole = async (role: UserRole) => {
    const account = DEMO_ACCOUNTS.find((a) => a.role === role);
    if (account) {
      await loginWithDemo(role);
      navigate('/applications');
    }
    setShowRoleMenu(false);
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  const switchRoleStyle = {
    position: 'absolute' as const,
    top: '100%',
    right: 0,
    background: '#fff',
    border: '1px solid #e8e8e8',
    borderRadius: '4px',
    padding: '8px 0',
    marginTop: '4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    zIndex: 100,
    minWidth: '180px',
  };

  const menuItemStyle = {
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '14px',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', 'flex-direction': 'column' }}>
      <header
        style={{
          background: '#fff',
          height: '60px',
          padding: '0 24px',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          'box-shadow': '0 1px 4px rgba(0,0,0,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', 'align-items': 'center', gap: '48px' }}>
          <div
            style={{
              'font-size': '18px',
              'font-weight': '700',
              color: '#1890ff',
            }}
          >
            费用报销管理系统
          </div>
          <nav style={{ display: 'flex', gap: '8px' }}>
            <A
              href="/applications"
              style={{
                padding: '8px 16px',
                'border-radius': '4px',
                'font-size': '14px',
                color: isActive('/applications') ? '#1890ff' : '#666',
                background: isActive('/applications') ? '#e6f7ff' : 'transparent',
                'font-weight': isActive('/applications') ? '500' : 'normal',
              }}
            >
              申请列表
            </A>
            <A
              href="/batch"
              style={{
                padding: '8px 16px',
                'border-radius': '4px',
                'font-size': '14px',
                color: isActive('/batch') ? '#1890ff' : '#666',
                background: isActive('/batch') ? '#e6f7ff' : 'transparent',
                'font-weight': isActive('/batch') ? '500' : 'normal',
              }}
            >
              批量处理
            </A>
          </nav>
        </div>

        <div style={{ display: 'flex', 'align-items': 'center', gap: '16px' }}>
          {user() && (
            <>
              <div style={{ position: 'relative' }}>
                <button class="btn" onClick={() => setShowRoleMenu(!showRoleMenu())}>
                  切换角色
                </button>
                {showRoleMenu() && (
                  <div style={switchRoleStyle} onClick={() => setShowRoleMenu(false)}>
                    {DEMO_ACCOUNTS.map((account) => (
                      <div
                        style={{
                          ...menuItemStyle,
                          color: account.role === user()?.role ? '#1890ff' : '#333',
                          'font-weight': account.role === user()?.role ? '500' : 'normal',
                          background: account.role === user()?.role ? '#e6f7ff' : 'transparent',
                        }}
                        onClick={() => handleSwitchRole(account.role)}
                      >
                        {account.name}（{getRoleLabel(account.role)}）
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    'border-radius': '4px',
                  }}
                  onClick={() => setShowUserMenu(!showUserMenu())}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      'border-radius': '50%',
                      background: '#1890ff',
                      color: '#fff',
                      display: 'flex',
                      'align-items': 'center',
                      'justify-content': 'center',
                      'font-weight': '600',
                      'font-size': '14px',
                    }}
                  >
                    {user()?.real_name?.charAt(0)}
                  </div>
                  <div>
                    <div style={{ 'font-size': '14px', 'font-weight': '500', color: '#333' }}>
                      {user()?.real_name}
                    </div>
                    <div style={{ 'font-size': '12px', color: '#999' }}>
                      {getRoleLabel(user()?.role!)}
                    </div>
                  </div>
                </div>
                {showUserMenu() && (
                  <div style={switchRoleStyle}>
                    <div style={{ ...menuItemStyle, color: '#ff4d4f' }} onClick={handleLogout}>
                      退出登录
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <main style={{ flex: 1 }}>{props.children}</main>
    </div>
  );
};

export default Layout;
