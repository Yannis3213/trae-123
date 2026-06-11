import { useState } from 'preact/hooks';
import { login } from '../api/client.js';

const demoAccounts = [
  { username: 'store1', role: '门店店长(望京店)', password: '123456' },
  { username: 'store2', role: '门店店长(国贸店)', password: '123456' },
  { username: 'store3', role: '门店店长(中关村店)', password: '123456' },
  { username: 'qc1', role: '品控专员', password: '123456' },
  { username: 'ops1', role: '营运经理', password: '123456' }
];

export default function Login() {
  const [username, setUsername] = useState('store1');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(username, password);
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (account) => {
    setUsername(account.username);
    setPassword(account.password);
    setError('');
    setLoading(true);
    
    try {
      await login(account.username, account.password);
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="login-container">
      <div class="login-box">
        <h1 class="login-title">餐饮连锁总部-订货单处理系统</h1>
        <p class="login-subtitle">月底集中处理门店订货单</p>
        
        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input
              type="text"
              class="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">密码</label>
            <input
              type="password"
              class="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>
          
          {error && <div class="alert alert-error">{error}</div>}
          
          <button type="submit" class="btn btn-primary btn-block" disabled={loading}>
            {loading ? <span class="spinner" /> : null}
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        
        <div style={{ marginTop: '24px' }}>
          <div class="form-label" style={{ marginBottom: '12px' }}>演示账号登录（点击快速登录）:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {demoAccounts.map(account => (
              <button
                key={account.username}
                type="button"
                class="btn btn-default"
                style={{ fontSize: '12px', padding: '8px 12px' }}
                onClick={() => handleDemoLogin(account)}
                disabled={loading}
              >
                {account.role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
