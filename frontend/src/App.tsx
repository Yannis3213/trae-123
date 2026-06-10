import { useEffect, useState } from 'react';
import { useAuthStore } from './store/auth';
import LoginView from './components/LoginView';
import AppShell from './components/AppShell';
import ApplicationList from './components/ApplicationList';
import ApplicationDetail from './components/ApplicationDetail';
import BatchProcessPanel from './components/BatchProcessPanel';
import type { ReplenishmentApplication } from './types';

export default function App() {
  const { user, fetchAllUsers, allUsers, token, fetchScope, visibleScope } = useAuthStore();
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'batch'>('list');
  const [selectedApp, setSelectedApp] = useState<ReplenishmentApplication | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (token && user) {
      fetchAllUsers();
      fetchScope();
    }
  }, [token, user, fetchAllUsers, fetchScope]);

  useEffect(() => {
    setCurrentView('list');
    setSelectedApp(null);
    setRefreshKey((k) => k + 1);
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      import('./api/client').then(({ applicationApi }) => {
        applicationApi.list({ mine: true }).then((apps) => {
          setPendingCount(apps.filter((a) => a.status !== 'archived').length);
        });
      });
    }
  }, [user, currentView, refreshKey]);

  if (!user) return <LoginView />;

  const handleSelect = (app: ReplenishmentApplication) => {
    setSelectedApp(app);
    setCurrentView('detail');
  };

  const handleViewChange = (v: 'list' | 'detail' | 'batch') => {
    if (v !== 'detail') setSelectedApp(null);
    setCurrentView(v);
  };

  const handleBack = () => {
    setSelectedApp(null);
    setCurrentView('list');
  };

  const refreshPending = () => {
    import('./api/client').then(({ applicationApi }) => {
      applicationApi.list({ mine: true }).then((apps) => {
        setPendingCount(apps.filter((a) => a.status !== 'archived').length);
      });
    });
  };

  return (
    <AppShell
      currentView={currentView}
      onViewChange={handleViewChange}
      onBack={handleBack}
      pendingCount={pendingCount}
    >
      {currentView === 'list' && (
        <ApplicationList key={`list-${refreshKey}`} users={allUsers} onSelect={handleSelect} />
      )}
      {currentView === 'detail' && selectedApp && (
        <ApplicationDetail
          key={`detail-${refreshKey}-${selectedApp.id}`}
          application={selectedApp}
          users={allUsers}
          onUpdated={refreshPending}
        />
      )}
      {currentView === 'batch' && <BatchProcessPanel key={`batch-${refreshKey}`} users={allUsers} />}
    </AppShell>
  );
}
