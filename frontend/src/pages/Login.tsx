import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request, User } from '../api';
import { showToast } from '../App';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('jiaowu01');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);

  const doLogin = async () => {
    if (!username || !password) {
      showToast('请输入账号和密码', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await request<{ code: number; msg?: string; data?: { token: string; user: User } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (res.code === 0 && res.data) {
        localStorage.setItem('token', res.data.token);
        showToast(`欢迎回来，${res.data.user.name}`, 'success');
        navigate('/', { replace: true });
      } else {
        showToast(res.msg || '登录失败', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (u: string) => {
    setUsername(u);
    setPassword('123456');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>课程服务单系统</h2>
        <div className="sub">K12培训机构 · 月底集中处理台账</div>
        <div className="form-item">
          <label>账号</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="请输入账号" />
        </div>
        <div className="form-item">
          <label>密码</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码" />
        </div>
        <button className="btn btn-primary" disabled={loading} onClick={doLogin}>
          {loading ? '登录中...' : '登录'}
        </button>
        <div className="role-hints">
          <div><b>演示账号（密码均为 123456）：</b></div>
          <div>
            教务老师：<button className="link-btn" onClick={() => quickLogin('jiaowu01')}>jiaowu01</button>　
            班主任：<button className="link-btn" onClick={() => quickLogin('banzhuren01')}>banzhuren01</button>　
            校长：<button className="link-btn" onClick={() => quickLogin('xiaozhang01')}>xiaozhang01</button>
          </div>
        </div>
      </div>
    </div>
  );
}
