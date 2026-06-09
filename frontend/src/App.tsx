import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import OrderList from './pages/OrderList';
import OrderDetail from './pages/OrderDetail';
import { request, User, ROLE_LABEL } from './api';

export function showToast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function Header({ user, onLogout, onRefresh }: { user: User; onLogout: () => void; onRefresh: () => void }) {
  return (
    <div className="header">
      <div className="title">K12培训机构 · 月底集中处理课程服务单系统</div>
      <div className="user-box">
        <span>{user.name}</span>
        <span className="role-tag">{ROLE_LABEL[user.role]}</span>
        <button className="btn btn-ghost" onClick={onRefresh}>刷新</button>
        <button className="btn btn-ghost" onClick={onLogout}>切换账号 / 退出</button>
      </div>
    </div>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  const loadUser = async () => {
    const res = await request<{ code: number; data: User }>('/auth/me');
    if (res.code === 0) setUser(res.data);
    else {
      localStorage.removeItem('token');
      navigate('/login', { replace: true });
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  };

  if (!user) {
    return <div className="page"><div style={{ padding: 40, textAlign: 'center' }}>加载中...</div></div>;
  }

  return (
    <div className="page">
      <Header user={user} onLogout={logout} onRefresh={() => window.location.reload()} />
      <Routes>
        <Route path="/" element={<OrderList user={user} />} />
        <Route path="/orders/:id" element={<OrderDetail user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<AppShell />} />
    </Routes>
  );
}
