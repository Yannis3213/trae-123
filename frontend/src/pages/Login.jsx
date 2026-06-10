import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAuth, ROLE_NAMES } from '../store/auth.jsx';

export default function Login() {
  const [username, setUsername] = createSignal('custmgr01');
  const [password, setPassword] = createSignal('123456');
  const [err, setErr] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const { login, users } = useAuth();
  const nav = useNavigate();

  async function doLogin(e) {
    e.preventDefault();
    setErr('');
    setSubmitting(true);
    const r = await login(username(), password());
    setSubmitting(false);
    if (r.ok) nav('/');
    else setErr(r.message || '登录失败');
  }

  function quickLogin(u) {
    setUsername(u.username);
    setPassword(u.password);
  }

  const quickAccounts = [
    { username: 'custmgr01', password: '123456', label: '张伟' },
    { username: 'trade01', password: '123456', label: '李娜' },
    { username: 'risk01', password: '123456', label: '王强' },
    { username: 'admin', password: 'admin', label: '系统管理员' },
  ];

  return (
    <div class="login-page">
      <div class="login-box">
        <div class="login-title">
          <h1>⚡ 售电合同单集中处理系统</h1>
          <p>月底批量处理 · 责任链流转 · 审计轨迹可追溯</p>
        </div>
        <form onSubmit={doLogin}>
          <div class="field-row">
            <label class="required">用户名</label>
            <input value={username()} onInput={e => setUsername(e.target.value)} placeholder="请输入用户名" />
          </div>
          <div class="field-row">
            <label class="required">密码</label>
            <input type="password" value={password()} onInput={e => setPassword(e.target.value)} placeholder="请输入密码" />
          </div>
          {err() && <div class="alert alert-danger mb-3"><span class="alert-icon">⚠️</span>{err()}</div>}
          <button class="btn btn-primary btn-lg" type="submit" style="width:100%" disabled={submitting()}>
            {submitting() ? '登录中...' : '登 录'}
          </button>
        </form>
        <div class="divider"></div>
        <div>
          <div class="label mb-2">快速登录演示账号：</div>
          <div class="flex flex-wrap gap-2">
            {quickAccounts.map(a => (
              <button class="btn btn-default btn-sm" onClick={() => quickLogin(a)}>
                {a.label}（{a.username}）
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
