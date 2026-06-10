import { useEffect, useState } from 'react';
import { useAuthStore } from './store/auth';
import LoginView from './components/LoginView';
import AppShell from './components/AppShell';
import ApplicationList from './components/ApplicationList';
import ApplicationDetail from './components/ApplicationDetail';
import BatchProcessPanel from './components/BatchProcessPanel';
import type { ReplenishmentApplication } from './types';

export default function App() {
  const { user, fetchAllUsers, allUsers, token } = useAuthStore();
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'batch'>('list');
  const [selectedApp, setSelectedApp] = useState<ReplenishmentApplication | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (token && user) {
      fetchAllUsers();
    }
  }, [token, user, fetchAllUsers]);

  useEffect(() => {
    if (user) {
      import('./api/client').then(({ applicationApi }) => {
        applicationApi.list({ mine: true }).then((apps) => {
          setPendingCount(apps.filter((a) => a.status !== 'archived').length);
        });
      });
    }
  }, [user, currentView]);

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
        <ApplicationList users={allUsers} onSelect={handleSelect} />
      )}
      {currentView === 'detail' && selectedApp && (
        <ApplicationDetail
          application={selectedApp}
          users={allUsers}
          onUpdated={refreshPending}
        />
      )}
      {currentView === 'batch' && <BatchProcessPanel users={allUsers} />}
    </AppShell>
  );
}
