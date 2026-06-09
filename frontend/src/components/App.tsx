import React, { useState, useEffect, useCallback } from 'react';
import './styles.css';
import {
  api, setCurrentUserId, getCurrentUserId,
  type User, type DictItem, type StatusPermission,
  type WarningQueueMeta, type DictCurrentUser
} from '../lib/api';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';

export interface DictData {
  currentUser: DictCurrentUser | null;
  roles: DictItem[];
  statuses: DictItem[];
  abnormalTypes: DictItem[];
  warningLevels: DictItem[];
  warningQueueMeta: WarningQueueMeta[];
  transitions: Record<string, string[]>;
  statusPermissions: Record<string, StatusPermission>;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [dict, setDict] = useState<DictData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDict = useCallback(async () => {
    const r = await api.getDict();
    if (r.code === 0 && r.data) setDict(r.data);
  }, []);

  useEffect(() => {
    (async () => {
      const uid = getCurrentUserId();
      if (uid) {
        const r = await api.me();
        if (r.code === 0 && r.data) setUser(r.data);
        else setCurrentUserId(null);
      }
      await loadDict();
      setLoading(false);
    })();
  }, [loadDict]);

  useEffect(() => {
    loadDict();
  }, [user, loadDict]);

  const handleLogin = async (u: User) => {
    setCurrentUserId(u.id);
    setUser(u);
  };

  const handleLogout = async () => {
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
