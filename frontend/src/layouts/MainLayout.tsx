import { Component, Show, For } from 'solid-js';
import { A, useNavigate, useLocation } from '@solidjs/router';
import { useAuth } from '@/context/AuthContext';
import { RoleLabel } from '@/types';

interface MenuItem {
  key: string;
  label: string;
  path: string;
  icon: string;
  group?: string;
}

const menuItems: MenuItem[] = [
  { key: 'plans', label: '患者档案', path: '/plans', icon: '📋', group: '业务模块' },
  { key: 'plans', label: '治疗计划', path: '/plans', icon: '📝', group: '业务模块' },
  { key: 'plans', label: '复诊提醒', path: '/plans', icon: '⏰', group: '业务模块' },
  { key: 'warning', label: '到期预警', path: '/warning', icon: '⚠️', group: '其他' },
  { key: 'stats', label: '统计概览', path: '/stats', icon: '📊', group: '其他' },
];

const MainLayout: Component<{ children: any }> = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSwitchUser = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside
        style={{
          width: '220px',
          background: '#001529',
          color: '#fff',
          display: 'flex',
          'flex-direction': 'column',
          'flex-shrink': 0,
        }}
      >
        <div
          style={{
            padding: '20px 16px',
            'font-size': '15px',
            'font-weight': '600',
            'border-bottom': '1px solid rgba(255,255,255,0.1)',
            'line-height': '1.4',
          }}
        >
          口腔门诊<br />治疗计划系统
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          <For each={['业务模块', '其他']}>
            {(group) => (
              <div style={{ margin: '8px 0' }}>
                <div
                  style={{
                    padding: '6px 16px',
                    'font-size': '12px',
                    color: 'rgba(255,255,255,0.45)',
                  }}
                >
                  {group}
                </div>
                <For each={menuItems.filter((m) => m.group === group)}>
                  {(item) => (
                    <A
                      href={item.path}
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        gap: '10px',
                        padding: '10px 16px',
                        color: isActive(item.path) ? '#fff' : 'rgba(255,255,255,0.65)',
                        background: isActive(item.path) ? '#1890ff' : 'transparent',
                        transition: 'all 0.2s',
                      }}
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </A>
                  )}
                </For>
              </div>
            )}
          </For>
        </nav>
      </aside>

      <div style={{ flex: 1, display: 'flex', 'flex-direction': 'column', overflow: 'hidden' }}>
        <header
          style={{
            height: '56px',
            background: '#fff',
            'box-shadow': '0 1px 4px rgba(0,21,41,0.08)',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'space-between',
            padding: '0 24px',
            'flex-shrink': 0,
          }}
        >
          <div style={{ 'font-size': '16px', 'font-weight': '600', color: '#333' }}>
            口腔连锁门诊-月底集中处理治疗计划单系统
          </div>
          <div style={{ display: 'flex', 'align-items': 'center', gap: '16px' }}>
            <Show when={user()}>
              <span style={{ color: '#666', 'font-size': '14px' }}>
                角色：<span class="tag tag-blue">{RoleLabel[user()!.role]}</span>
              </span>
              <span style={{ color: '#666', 'font-size': '14px' }}>
                欢迎，{user()!.name}
              </span>
            </Show>
            <button class="btn btn-sm" onClick={handleSwitchUser}>
              切换用户
            </button>
            <button class="btn btn-sm btn-danger" onClick={handleLogout}>
              退出
            </button>
          </div>
        </header>

        <main
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px',
            background: '#f5f7fa',
          }}
        >
          {props.children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
