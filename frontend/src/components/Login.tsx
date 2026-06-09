import { useState, useEffect } from 'react';
import { api, type User } from '../lib/api';

const demoAccounts: { username: string; password: string; name: string; role: string }[] = [
  { username: 'registrar', password: '123456', name: '李登记员', role: '学员报名登记员' },
  { username: 'auditor', password: '123456', name: '王审核主管', role: '学员报名审核主管' },
  { username: 'reviewer', password: '123456', name: '张复核校长', role: '职业技能学校复核负责人' },
];

export default function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('registrar');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (u?: string, p?: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.login(u || username, p || password);
      onLogin(res.user);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <div className="card" style={{ width: '420px', padding: '32px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '8px', color: '#1e3a8a' }}>
          职业技能学校
        </h1>
        <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '24px' }}>
          月底集中处理学员报名单系统
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ width: '100%' }}
              placeholder="请输入用户名"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%' }}
              placeholder="请输入密码"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {error && (
            <div style={{ padding: '10px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={() => handleLogin()}
            disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: '16px' }}
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </div>

        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>快速登录演示账号：</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {demoAccounts.map((acc) => (
              <button
                key={acc.username}
                onClick={() => handleLogin(acc.username, acc.password)}
                style={{
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 500 }}>{acc.name}</span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{acc.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
