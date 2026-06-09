import { useState, useEffect } from 'react';
import { api, roleLabels } from '../lib/api';
import type { User } from '../types';

const demoAccounts = [
  { username: 'registrar1', password: '123456', label: '会诊申请登记员（张秘书）' },
  { username: 'registrar2', password: '123456', label: '会诊申请登记员（孙秘书，对照）' },
  { username: 'auditor1', password: '123456', label: '会诊申请审核主管（李质控）' },
  { username: 'auditor2', password: '123456', label: '会诊申请审核主管（周质控，对照）' },
  { username: 'reviewer1', password: '123456', label: '医务部复核负责人（王主任）' },
  { username: 'reviewer2', password: '123456', label: '医务部复核负责人（吴主任，对照）' },
];

export default function LoginIsland() {
  const [username, setUsername] = useState('registrar1');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const saved = localStorage.getItem('user');
    if (token && saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data: any = await api.login(username, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setTimeout(() => { window.location.href = '/'; }, 300);
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (user) {
    return (
      <div className="login-card">
        <h1>已登录</h1>
        <div style={{ textAlign: 'center', margin: '24px 0' }}>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{user.real_name}</div>
          <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
            {roleLabels[user.role]}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="primary" style={{ flex: 1 }} onClick={() => window.location.href = '/'}>
            进入系统
          </button>
          <button style={{ flex: 1 }} onClick={handleLogout}>切换账号</button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-card">
      <h1>三甲医院医务部</h1>
      <div className="subtitle">会诊申请单月底集中处理系统</div>
      <form onSubmit={handleLogin}>
        <div className="form-item" style={{ marginBottom: 16 }}>
          <label>用户名</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="form-item" style={{ marginBottom: 16 }}>
          <label>密码</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="alert error">{error}</div>}
        <button className="primary" type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
      <div className="section-title">演示账号</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {demoAccounts.map((a) => (
          <button
            key={a.username}
            type="button"
            style={{ textAlign: 'left', padding: '10px 12px' }}
            onClick={() => { setUsername(a.username); setPassword(a.password); }}
          >
            {a.label}
            <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 12 }}>
              ({a.username}/{a.password})
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
