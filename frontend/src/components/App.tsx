import { useState, useEffect, useCallback } from 'react';
import { api, type User } from '../lib/api';
import Login from './Login';
import Header from './Header';
import ApplicationList from './ApplicationList';
import ApplicationDetail from './ApplicationDetail';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [detailId, setDetailId] = useState<string>('');
  const [globalRefreshCounter, setGlobalRefreshCounter] = useState(0);

  const triggerRefresh = useCallback(() => {
    setGlobalRefreshCounter((k) => k + 1);
  }, []);

  useEffect(() => {
    const savedUser = api.getCurrentUser();
    if (savedUser && api.isAuthenticated()) {
      api.me().then(setUser).catch(() => {
        api.logout();
        setUser(null);
      });
    }
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    setView('list');
    setDetailId('');
    triggerRefresh();
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setView('list');
    setDetailId('');
  };

  const handleRoleSwitch = (u: User) => {
    setUser(u);
    setView('list');
    setDetailId('');
    triggerRefresh();
  };

  const handleViewDetail = (id: string) => {
    setDetailId(id);
    setView('detail');
  };

  const handleBack = () => {
    setView('list');
    setDetailId('');
    triggerRefresh();
  };

  const handleProcessedInDetail = () => {
    triggerRefresh();
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div>
      <Header
        user={user}
        onLogout={handleLogout}
        onRoleSwitch={handleRoleSwitch}
        onRefresh={triggerRefresh}
      />
      {view === 'list' ? (
        <ApplicationList
          key={`list-${user.id}-${globalRefreshCounter}`}
          user={user}
          onViewDetail={handleViewDetail}
          globalRefreshCounter={globalRefreshCounter}
        />
      ) : (
        <ApplicationDetail
          key={`detail-${detailId}-${user.id}-${globalRefreshCounter}`}
          applicationId={detailId}
          user={user}
          onBack={handleBack}
          onRefresh={triggerRefresh}
          onProcessed={handleProcessedInDetail}
        />
      )}
    </div>
  );
}
