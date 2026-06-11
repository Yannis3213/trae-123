import { createSignal, createEffect } from 'solid-js';
import { api, setAuthCredentials, clearAuthCredentials } from './api';
import Login from './components/Login';
import ApplicationList from './components/ApplicationList';
import ApplicationDetail from './components/ApplicationDetail';
import BatchProcessModal from './components/BatchProcessModal';
import CreateApplicationModal from './components/CreateApplicationModal';

const ROLE_ACCOUNTS = {
  community_worker: { username: 'community_worker', password: 'demo123456' },
  street_clerk: { username: 'street_clerk', password: 'demo123456' },
  leader: { username: 'leader', password: 'demo123456' },
};

export default function App() {
  const [user, setUser] = createSignal(null);
  const [detailId, setDetailId] = createSignal(null);
  const [batchConfig, setBatchConfig] = createSignal(null);
  const [showCreate, setShowCreate] = createSignal(false);
  const [refreshTrigger, setRefreshTrigger] = createSignal(0);
  const [error, setError] = createSignal('');

  const handleLogin = (userData) => {
    setUser(userData);
    setError('');
  };

  const handleLogout = () => {
    clearAuthCredentials();
    setUser(null);
    setDetailId(null);
    setBatchConfig(null);
    setShowCreate(false);
  };

  const handleRoleSwitch = async (newRole) => {
    const account = ROLE_ACCOUNTS[newRole];
    if (!account) return;

    try {
      setAuthCredentials(account.username, account.password);
      const userData = await api.login(account.username, account.password);
      setUser(userData);
      setDetailId(null);
      setBatchConfig(null);
      setRefreshTrigger((prev) => prev + 1);
      setError('');
    } catch (err) {
      setError(err.error_message || '角色切换失败');
      setAuthCredentials('', '');
    }
  };

  const handleViewDetail = (id) => {
    setDetailId(id);
  };

  const handleBatchProcess = (applications, action) => {
    setBatchConfig({ applications, action });
  };

  const handleDataUpdated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  if (!user()) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div class="app-container">
      <header class="header">
        <h1>街道办事处-月底集中处理帮扶申请系统</h1>
        <div class="user-info">
          <span class="user-role">{user().role_name}</span>
          <span>{user().username}</span>
          <div class="role-switcher">
            <select
              value={user().role}
              onChange={(e) => handleRoleSwitch(e.target.value)}
            >
              <option value="community_worker">社区专干</option>
              <option value="street_clerk">街道科员</option>
              <option value="leader">分管领导</option>
            </select>
          </div>
          <button class="btn btn-default btn-sm" onClick={handleLogout}>
            退出
          </button>
        </div>
      </header>

      <main class="main-content">
        {error() && <div class="error-message">{error()}</div>}

        <ApplicationList
          user={user()}
          onViewDetail={handleViewDetail}
          onBatchProcess={handleBatchProcess}
          onCreate={() => setShowCreate(true)}
        />
      </main>

      {detailId() && (
        <ApplicationDetail
          applicationId={detailId()}
          onClose={() => setDetailId(null)}
          onUpdated={handleDataUpdated}
        />
      )}

      {batchConfig() && (
        <BatchProcessModal
          applications={batchConfig().applications}
          action={batchConfig().action}
          onClose={() => setBatchConfig(null)}
          onSuccess={handleDataUpdated}
        />
      )}

      {showCreate() && (
        <CreateApplicationModal
          onClose={() => setShowCreate(false)}
          onSuccess={handleDataUpdated}
        />
      )}
    </div>
  );
}
