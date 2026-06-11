import { useState, useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { api, setToken, setCurrentUser, getCurrentUser, clearToken } from '../utils/api';
import { ROLE_NAMES, DEMO_ACCOUNTS } from '../constants';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const switchTo = localStorage.getItem('switchTo');
    if (switchTo) {
      const acc = JSON.parse(switchTo);
      localStorage.removeItem('switchTo');
      handleDoLogin(acc.username, acc.password);
    } else {
      const user = getCurrentUser();
      if (user) navigate('/');
    }
  }, [navigate]);

  const handleDoLogin = async (u, p) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.login(u, p);
      if (res.success) {
        setToken(res.data.token);
        setCurrentUser(res.data.user);
        const role = res.data.user.role;
        const redirectMap = {
          registrar: '/registration',
          supervisor: '/verification',
          reviewer: '/archiving'
        };
        navigate(redirectMap[role] || '/ledger');
      } else {
        setError(res.message || '登录失败');
      }
    } catch (e) {
      setError('登录异常，请检查后端服务是否启动');
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
    handleDoLogin(username, password);
  };

  const handleQuickLogin = (acc) => {
    handleDoLogin(acc.username, acc.password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">旁站记录单系统</h1>
          <p className="text-sm text-gray-500 mt-2">工程监理公司 - 月底集中处理</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">用户名</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="请输入用户名"
            />
          </div>
          <div>
            <label className="form-label">密码</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2.5 rounded border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <div className="divider" />

        <div>
          <div className="text-sm text-gray-500 mb-2">演示账号快速登录：</div>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map(acc => (
              <div
                key={acc.username}
                onClick={() => handleQuickLogin(acc)}
                className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition"
              >
                <div className="font-medium text-sm text-gray-800">{acc.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {ROLE_NAMES[acc.role]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
