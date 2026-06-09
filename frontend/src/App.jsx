import { h, useState, useEffect } from 'preact';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import RecordList from './pages/RecordList.jsx';
import RecordDetail from './pages/RecordDetail.jsx';
import { getToken, getUser, clearToken, clearUser } from './api.js';

function Header({ user, onLogout }) {
  if (!user) return null;
  return (
    <div class="header">
      <h1>🏫 幼儿园月底集中处理晨检记录系统</h1>
      <div class="user-info">
        <span>{user.name}</span>
        <span class="role">{user.role_name}</span>
        <button onClick={onLogout}>退出登录</button>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(getUser());
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const t = getToken();
    const u = getUser();
    if (t && u) {
      setUser(u);
    } else {
      setUser(null);
    }
  }, []);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleLogout = () => {
    clearToken();
    clearUser();
    setUser(null);
    navigate('/login', { replace: true });
  };

  return (
    <div class="app">
      <Header user={user} onLogout={handleLogout} />
      {toast && <div class={`toast toast-${toast.type}`}>{toast.msg}</div>}
      <Routes>
        <Route path="/login" element={<Login setUser={setUser} showToast={showToast} />} />
        {user ? (
          <>
            <Route path="/" element={<RecordList user={user} showToast={showToast} />} />
            <Route path="/record/:id" element={<RecordDetail user={user} showToast={showToast} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </div>
  );
}

export default App;
