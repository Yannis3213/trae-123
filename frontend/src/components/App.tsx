import { useState, useEffect } from 'react';
import { api, type User } from '../lib/api';
import Login from './Login';
import Header from './Header';
import ApplicationList from './ApplicationList';
import ApplicationDetail from './ApplicationDetail';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [detailId, setDetailId] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

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
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
  };

  const handleRoleSwitch = (u: User) => {
    setUser(u);
    setView('list');
    setDetailId('');
    setRefreshKey((k) => k + 1);
  };

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const handleViewDetail = (id: string) => {
    setDetailId(id);
    setView('detail');
  };

  const handleBack = () => {
    setView('list');
    setDetailId('');
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
        onRefresh={handleRefresh}
      />
      {view === 'list' ? (
        <ApplicationList
          key={refreshKey + '-' + user.id}
          user={user}
          onViewDetail={handleViewDetail}
        />
      ) : (
        <ApplicationDetail
          key={detailId + '-' + refreshKey}
          applicationId={detailId}
          user={user}
          onBack={handleBack}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}
