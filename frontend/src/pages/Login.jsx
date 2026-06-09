import { h, useState } from 'preact';
import { useNavigate } from 'react-router-dom';
import api, { setToken, setUser } from '../api.js';

const DEMO_ACCOUNTS = [
  { username: 'registrar', password: '123456', name: '李登记', role: '晨检登记员' },
  { username: 'supervisor', password: '123456', name: '王主管', role: '晨检审核主管' },
  { username: 'principal', password: '123456', name: '张园长', role: '幼儿园复核负责人' }
];

export default function Login({ setUser, showToast }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const doLogin = async (u, p) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.login(u, p);
      setToken(res.token);
      setUser(res.user);
      showToast(`欢迎，${res.user.name}`, 'success');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }
    doLogin(username, password);
  };

  const handleDemoLogin = (acc) => {
    setUsername(acc.username);
    setPassword(acc.password);
    doLogin(acc.username, acc.password);
  };

  return (
    <div class="login-page">
      <div class="login-card">
        <h2>晨检记录系统</h2>
        <div class="subtitle">幼儿园月底集中处理平台</div>
        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onInput={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onInput={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>
          {error && <div class="error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        <div class="demo-accounts">
          <h4>演示账号（点击快速登录）：</h4>
          <ul>
            {DEMO_ACCOUNTS.map(acc => (
              <li key={acc.username}>
                <strong>{acc.role}</strong> — {acc.name}（{acc.username} / {acc.password}）
                <button type="button" onClick={() => handleDemoLogin(acc)}>登录</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
