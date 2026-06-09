import { useState, useEffect } from 'react';
import { api, roleLabels } from '../lib/api';
import type { User } from '../types';
import ConsultationList from './ConsultationList';
import ConsultationDetail from './ConsultationDetail';
import ConsultationCreate from './ConsultationCreate';
import WarningPanel from './WarningPanel';
import LedgerPanel from './LedgerPanel';
import Dashboard from './Dashboard';

type TabType = 'dashboard' | 'registration' | 'verification' | 'review' | 'ledger' | 'warnings';

const roleDefaultTab: Record<string, TabType> = {
  registrar: 'registration',
  auditor: 'verification',
  reviewer: 'review',
};

export default function AppIsland() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<TabType>('dashboard');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewKey, setViewKey] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const saved = localStorage.getItem('user');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    try {
      let initial: User | null = null;
      if (saved) {
        initial = JSON.parse(saved);
        setUser(initial);
        setTab(roleDefaultTab[initial.role] || 'dashboard');
      }
      (async () => {
        try {
          const me: any = await api.getMe();
          setUser(me);
          localStorage.setItem('user', JSON.stringify(me));
          if (!initial) {
            setTab(roleDefaultTab[me.role] || 'dashboard');
          }
          setViewKey(k => k + 1);
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        } finally {
          setLoading(false);
        }
      })();
    } catch {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>;
  if (!user) return null;

  const getTabs: { key: TabType; label: string; roles?: string[] }[] = [
    { key: 'dashboard', label: '工作台' },
  ];
  if (user.role === 'registrar') {
    getTabs.push({ key: 'registration', label: '会诊申请单登记', roles: ['registrar'] });
  } else if (user.role === 'auditor') {
    getTabs.push({ key: 'verification', label: '过程核验', roles: ['auditor'] });
  } else if (user.role === 'reviewer') {
    getTabs.push({ key: 'review', label: '复核归档', roles: ['reviewer'] });
  }
  getTabs.push(
    { key: 'warnings', label: '到期预警' },
    { key: 'ledger', label: '会诊申请单台账' },
  );

  const renderMain = () => {
    if (selectedId) {
      return (
        <ConsultationDetail
          key={`detail-${selectedId}-${viewKey}`}
          id={selectedId}
          user={user}
          onBack={() => setSelectedId(null)}
          onRefresh={() => setViewKey(k => k + 1)}
        />
      );
    }
    if (showCreate) {
      return (
        <ConsultationCreate
          user={user}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); setViewKey(k => k + 1); }}
        />
      );
    }
    switch (tab) {
      case 'dashboard':
        return <Dashboard key={`dash-${viewKey}`} user={user} onOpen={(id) => setSelectedId(id)} />;
      case 'registration':
        return (
          <ConsultationList
            key={`list-reg-${viewKey}`}
            user={user}
            stage="registration"
            onOpen={setSelectedId}
            onNew={() => setShowCreate(true)}
          />
        );
      case 'verification':
        return (
          <ConsultationList
            key={`list-aud-${viewKey}`}
            user={user}
            stage="verification"
            onOpen={setSelectedId}
          />
        );
      case 'review':
        return (
          <ConsultationList
            key={`list-rev-${viewKey}`}
            user={user}
            stage="review"
            onOpen={setSelectedId}
          />
        );
      case 'warnings':
        return <WarningPanel key={`warn-${viewKey}`} user={user} onOpen={setSelectedId} />;
      case 'ledger':
        return <LedgerPanel key={`ledger-${viewKey}`} user={user} onOpen={setSelectedId} />;
      default:
        return null;
    }
  };

  const tabTitles: Record<TabType, string> = {
    dashboard: '工作台',
    registration: '会诊申请单登记 - 科室秘书工作台',
    verification: '过程核验 - 质控医生工作台',
    review: '复核归档 - 医务部主任工作台',
    warnings: '到期预警',
    ledger: '会诊申请单台账',
  };

  const roleBadgeCls = user.role === 'registrar' ? 'pending' : user.role === 'auditor' ? 'warning' : 'rechecked';

  return (
    <div className="layout">
      <div className="sidebar">
        <h2>三甲医院医务部</h2>
        <div style={{ padding: '0 20px 16px', fontSize: 13, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
          会诊申请单月底集中处理系统
        </div>
        {getTabs.map(t => (
          <div
            key={t.key}
            className={`nav-item ${tab === t.key ? 'active' : ''}`}
            onClick={() => { setTab(t.key); setSelectedId(null); setShowCreate(false); setViewKey(k => k + 1); }}
          >
            {t.label}
          </div>
        ))}
      </div>
      <div className="main">
        <div className="topbar">
          <h1>
            {selectedId ? '会诊申请单详情' : (showCreate ? '新建会诊申请单' : tabTitles[tab])}
          </h1>
          <div className="user-info">
            <span style={{ color: 'var(--text-secondary)' }}>{user.real_name}</span>
            <span className={`badge ${roleBadgeCls}`}>{roleLabels[user.role]}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {user.department}
            </span>
            <button onClick={handleLogout}>切换角色</button>
          </div>
        </div>
        {renderMain()}
      </div>
    </div>
  );
}
