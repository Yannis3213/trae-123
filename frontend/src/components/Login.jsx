import { createSignal } from 'solid-js';
import { api, setAuthCredentials } from '../api';

export default function Login({ onLogin }) {
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      setAuthCredentials(username(), password());
      const user = await api.login(username(), password());
      onLogin(user);
    } catch (err) {
      setError(err.error_message || '登录失败，请检查用户名和密码');
      setAuthCredentials('', '');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { username: 'community_worker', role: '社区专干', desc: '创建和补正申请' },
    { username: 'street_clerk', role: '街道科员', desc: '处理申请' },
    { username: 'leader', role: '分管领导', desc: '复核申请' },
  ];

  const quickLogin = async (account) => {
    setUsername(account.username);
    setPassword('demo123456');
    setError('');
    setLoading(true);

    try {
      setAuthCredentials(account.username, 'demo123456');
      const user = await api.login(account.username, 'demo123456');
      onLogin(user);
    } catch (err) {
      setError(err.error_message || '登录失败');
      setAuthCredentials('', '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="login-container">
      <div class="login-card">
        <h2>街道办事处-月底集中处理帮扶申请系统</h2>

        {error() && <div class="error-message">{error()}</div>}

        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username()}
              onInput={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
            />
          </div>

          <div class="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>

          <button
            type="submit"
            class="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '16px' }}
            disabled={loading()}
          >
            {loading() ? '登录中...' : '登 录'}
          </button>
        </form>

        <div style={{ marginTop: '24px' }}>
          <p style={{ fontSize: '14px', color: '#8c8c8c', marginBottom: '12px' }}>演示账号（密码均为 demo123456）：</p>
          {demoAccounts.map((account) => (
            <button
              key={account.username}
              type="button"
              class="btn btn-default"
              style={{ width: '100%', marginBottom: '8px', textAlign: 'left' }}
              onClick={() => quickLogin(account)}
              disabled={loading()}
            >
              <strong>{account.role}</strong> - {account.username}
              <span style={{ color: '#8c8c8c', fontSize: '12px', marginLeft: '8px' }}>
                {account.desc}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
