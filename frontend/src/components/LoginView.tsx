import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth';
import { ROLE_DISPLAY } from '../types';

export default function LoginView() {
  const { login, fetchAllUsers, allUsers, isLoading, error } = useAuthStore();
  const [username, setUsername] = useState('');

  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      login(username.trim());
    }
  };

  const quickLogin = (uname: string) => {
    setUsername(uname);
    login(uname);
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h2>🏪 便利店连锁-月底集中处理补货申请系统</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
            />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px', fontSize: '15px' }}
            disabled={isLoading}
          >
            {isLoading ? '登录中...' : '登 录'}
          </button>
        </form>
        <div style={{ marginTop: '24px' }}>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '10px' }}>
            演示账号（快速登录）：
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {allUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                className="btn"
                onClick={() => quickLogin(u.username)}
                style={{ fontSize: '12px', padding: '6px 10px' }}
                title={u.username}
              >
                {u.display_name}
                <span style={{ marginLeft: '6px', color: '#6b7280', fontSize: '11px' }}>
                  ({ROLE_DISPLAY[u.role]})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
