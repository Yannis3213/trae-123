import React, { useState } from 'react';
import { authApi } from '../lib/api';
import { setUser } from '../lib/auth';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login({ username, password });
      if (res.success) {
        setUser(res.user);
        window.location.href = '/';
      } else {
        setError(res.message || '登录失败');
      }
    } catch (err) {
      setError(err.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (u) => {
    setUsername(u);
    setPassword('123456');
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-box">{error}</div>}
      <div className="form-group" style={{ marginBottom: 14 }}>
        <label className="required">用户名</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="请输入用户名"
          autoFocus
        />
      </div>
      <div className="form-group" style={{ marginBottom: 18 }}>
        <label className="required">密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="请输入密码"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
        disabled={loading}
      >
        {loading ? '登录中...' : '登 录'}
      </button>
      <div className="login-tips">
        <div style={{ marginBottom: 6, fontWeight: 500 }}>演示账号（密码均为 123456）：</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>前台护士：<code>nurse01</code></span>
            <button type="button" className="btn btn-sm" onClick={() => quickLogin('nurse01')}>快速登录</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>兽医师：<code>doctor01</code></span>
            <button type="button" className="btn btn-sm" onClick={() => quickLogin('doctor01')}>快速登录</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>院长：<code>director01</code></span>
            <button type="button" className="btn btn-sm" onClick={() => quickLogin('director01')}>快速登录</button>
          </div>
        </div>
      </div>
    </form>
  );
}
