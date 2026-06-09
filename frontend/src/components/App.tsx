import React, { useState, useEffect } from 'react';
import './styles.css';
import { api, setCurrentUserId, getCurrentUserId, type User, type DictItem } from '../lib/api';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [dict, setDict] = useState<{
    roles: DictItem[];
    statuses: DictItem[];
    abnormalTypes: DictItem[];
    warningLevels: DictItem[];
    transitions: Record<string, string[]>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = getCurrentUserId();
    if (uid) {
      api.me().then(r => {
        if (r.code === 0 && r.data) setUser(r.data);
        else setCurrentUserId(null);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
    api.getDict().then(r => { if (r.code === 0 && r.data) setDict(r.data); });
  }, []);

  const handleLogin = (u: User) => {
    setCurrentUserId(u.id);
    setUser(u);
  };

  const handleLogout = () => {
    setCurrentUserId(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="app-root" style={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
        <div className="page-title">正在加载...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} dict={dict} />;
  }

  return <Dashboard user={user} dict={dict} onLogout={handleLogout} />;
};

export default App;
