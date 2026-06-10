'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, setToken, saveUser, User } from '@/lib/api';

const DEMO_ACCOUNTS: { username: string; password: string; role: string; name: string }[] = [
  { username: 'wang_cm', password: '123456', role: '客户经理', name: '王建国' },
  { username: 'li_cm', password: '123456', role: '客户经理', name: '李美丽' },
  { username: 'zhang_os', password: '123456', role: '运营主管', name: '张伟' },
  { username: 'liu_bm', password: '123456', role: '支行行长', name: '刘芳' },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('zhang_os');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(username, password);
      setToken(res.access_token);
      saveUser(res.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (account: typeof DEMO_ACCOUNTS[0]) => {
    setError('');
    setLoading(true);
    try {
      const res = await login(account.username, account.password);
      setToken(res.access_token);
      saveUser(res.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || '登录失败');
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
      background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    }}>
      <div className="card" style={{ width: '420px', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', color: '#1e40af', marginBottom: '8px' }}>
            月底集中处理开户申请系统
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px' }}>银行网点 · 三级审批责任链</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px' }}
            disabled={loading}
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <div style={{ marginTop: '24px' }}>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
            演示账号（点击快速登录）：
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.username}
                type="button"
                className="btn btn-sm"
                onClick={() => quickLogin(acc)}
                disabled={loading}
                style={{ textAlign: 'left' }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{acc.name}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{acc.role}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
