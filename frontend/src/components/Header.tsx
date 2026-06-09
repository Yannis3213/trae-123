import { useState, useEffect } from 'react';
import { api, type User } from '../lib/api';

export default function Header({
  user,
  onLogout,
  onRoleSwitch,
  onRefresh,
}: {
  user: User;
  onLogout: () => void;
  onRoleSwitch: (user: User) => void;
  onRefresh: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [showSwitcher, setShowSwitcher] = useState(false);

  useEffect(() => {
    api.listUsers().then(setUsers).catch(() => {});
  }, []);

  const roleLabels: Record<string, string> = {
    registrar: '学员报名登记员',
    auditor: '学员报名审核主管',
    reviewer: '职业技能学校复核负责人',
  };

  const handleSwitch = async (u: User) => {
    try {
      await api.login(u.username, '123456');
      onRoleSwitch(u);
      setShowSwitcher(false);
    } catch {}
  };

  return (
    <header style={{
      background: 'white',
      padding: '12px 24px',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 style={{ fontSize: '18px', color: '#1e3a8a', fontWeight: 700 }}>
          🎓 职业技能学校 - 学员报名单处理系统
        </h1>
        <button className="btn btn-secondary" onClick={onRefresh} style={{ fontSize: '13px', padding: '6px 12px' }}>
          🔄 刷新数据
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>{user.name}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>{roleLabels[user.role]}</div>
        </div>

        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowSwitcher(!showSwitcher)}
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            🔀 切换角色
          </button>
          {showSwitcher && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: '4px',
              background: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 100,
              minWidth: '240px',
              overflow: 'hidden',
            }}>
              {users.map((u) => (
                <div
                  key={u.id}
                  onClick={() => handleSwitch(u)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f3f4f6',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: u.id === user.id ? '#eff6ff' : 'white',
                  }}
                >
                  <span style={{ fontWeight: u.id === user.id ? 600 : 400 }}>
                    {u.name} {u.id === user.id && '(当前)'}
                  </span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {roleLabels[u.role]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="btn btn-danger" onClick={onLogout} style={{ fontSize: '13px', padding: '6px 12px' }}>
          🚪 退出
        </button>
      </div>
    </header>
  );
}
