import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-router';
import { getCurrentUser, setCurrentUser, logout, fetchUsers } from './api/client.js';

const roleOptions = [
  { username: 'store1', role: 'store_manager', name: '张店长(望京店)' },
  { username: 'store2', role: 'store_manager', name: '李店长(国贸店)' },
  { username: 'store3', role: 'store_manager', name: '王店长(中关村店)' },
  { username: 'qc1', role: 'qc_specialist', name: '陈品控' },
  { username: 'ops1', role: 'operations_manager', name: '刘经理' }
];

const roleLabels = {
  store_manager: '门店店长',
  qc_specialist: '品控专员',
  operations_manager: '营运经理'
};

export default function App({ children }) {
  const [user, setUser] = useState(getCurrentUser());
  const [users, setUsers] = useState([]);
  const location = useLocation();

  useEffect(() => {
    if (user) {
      fetchUsers().then(setUsers).catch(() => {});
    }
  }, [user]);

  const handleRoleSwitch = async (roleOpt) => {
    try {
      const { login } = await import('./api/client.js');
      const loggedInUser = await login(roleOpt.username, '123456');
      setUser(loggedInUser);
      window.location.reload();
    } catch (err) {
      alert('角色切换失败: ' + err.message);
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    window.location.reload();
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div class="app-layout">
      <aside class="sidebar">
        <div class="sidebar-header">
          餐饮连锁总部<br/>订货单处理系统
        </div>
        <nav class="sidebar-menu">
          <a href="/" class={`sidebar-menu-item ${isActive('/') ? 'active' : ''}`}>
            📋 订货单队列
          </a>
          <a href="/overdue" class={`sidebar-menu-item ${isActive('/overdue') ? 'active' : ''}`}>
            ⏰ 到期预警队列
          </a>
        </nav>
        <div class="sidebar-user">
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">{user?.name}</div>
            <div class="sidebar-user-role">{roleLabels[user?.role]}</div>
          </div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-role" style={{ marginBottom: '4px' }}>快速角色切换:</div>
            <div class="sidebar-role-switch">
              {roleOptions.map(opt => (
                <span
                  key={opt.username}
                  class={`role-tag ${user?.username === opt.username ? 'active' : ''}`}
                  onClick={() => handleRoleSwitch(opt)}
                  title={`切换为 ${opt.name}`}
                >
                  {opt.name.slice(0, 3)}
                </span>
              ))}
            </div>
          </div>
          <button class="logout-btn" onClick={handleLogout}>退出登录</button>
        </div>
      </aside>
      <main class="main-content">
        {children}
      </main>
    </div>
  );
}
