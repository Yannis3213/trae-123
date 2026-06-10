import { useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { ROLE_DISPLAY } from '../types';

interface AppShellProps {
  currentView: 'list' | 'detail' | 'batch';
  onViewChange: (v: 'list' | 'detail' | 'batch') => void;
  onBack: () => void;
  pendingCount: number;
  children: React.ReactNode;
}

export default function AppShell({
  currentView,
  onViewChange,
  onBack,
  pendingCount,
  children,
}: AppShellProps) {
  const { user, allUsers, switchUser, fetchAllUsers, logout } = useAuthStore();

  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]);

  if (!user) return null;

  const navItems = [
    { key: 'list' as const, label: '📋 补货申请列表', badge: pendingCount },
    { key: 'batch' as const, label: '⚡ 批量处理' },
  ];

  return (
    <div>
      <header className="app-header">
        <div className="app-title">便利店连锁-月底集中处理补货申请系统</div>
        <div className="role-switcher">
          <div className="user-info">
            <span>👤 {user.display_name}</span>
            <span style={{ opacity: 0.8 }}>（{ROLE_DISPLAY[user.role]}）</span>
          </div>
          <select
            value={user.id}
            onChange={(e) => switchUser(e.target.value)}
            title="切换角色"
          >
            {allUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name} — {ROLE_DISPLAY[u.role]}
              </option>
            ))}
          </select>
          <button className="btn" onClick={logout} style={{ fontSize: '13px', padding: '5px 12px' }}>
            退出
          </button>
        </div>
      </header>

      <div className="app-container">
        <aside className="sidebar">
          {navItems.map((item) => (
            <div
              key={item.key}
              className={`nav-item ${currentView === item.key ? 'active' : ''}`}
              onClick={() => onViewChange(item.key)}
            >
              <span>{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="nav-badge">{item.badge}</span>
              ) : null}
            </div>
          ))}

          <div style={{ padding: '20px 24px 10px', fontSize: '12px', color: '#9ca3af' }}>
            处理依据
          </div>
          <div style={{ padding: '0 24px', fontSize: '12px', color: '#6b7280', lineHeight: 1.7 }}>
            <div>• 店长提交 → 营运督导签收</div>
            <div>• 营运督导 → 总部运营确认</div>
            <div>• 总部运营 → 复核负责人归档</div>
            <div style={{ marginTop: '8px', color: '#dc2626' }}>
              异常或逾期需逐条补正，不能批量放行
            </div>
          </div>
        </aside>

        <main className="main-content">
          {currentView === 'detail' && (
            <div className="back-link" onClick={onBack}>
              ← 返回列表
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
