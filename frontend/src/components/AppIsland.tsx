import { useState, useEffect } from 'react';
import { api, statusLabels, stageLabels, roleLabels, urgencyLabels, formatDateTime } from '../lib/api';
import type { User, Consultation, ProcessRecord, AbnormalRecord, Attachment, AuditNote, ProcessResult, BatchResult } from '../types';
import ConsultationList from './ConsultationList';
import ConsultationDetail from './ConsultationDetail';
import ConsultationCreate from './ConsultationCreate';
import WarningPanel from './WarningPanel';
import LedgerPanel from './LedgerPanel';
import Dashboard from './Dashboard';

type TabType = 'dashboard' | 'list' | 'registration' | 'verification' | 'review' | 'ledger' | 'warnings';

export default function AppIsland() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<TabType>('dashboard');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const saved = localStorage.getItem('user');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    try {
      if (saved) setUser(JSON.parse(saved));
      (async () => {
        try {
          const me: any = await api.getMe();
          setUser(me);
          localStorage.setItem('user', JSON.stringify(me));
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
    { key: 'list', label: '会诊申请单', roles: ['registrar', 'auditor', 'reviewer'] },
    { key: 'registration', label: '会诊申请单登记', roles: ['registrar'] },
    { key: 'verification', label: '过程核验', roles: ['auditor'] },
    { key: 'review', label: '复核归档', roles: ['reviewer'] },
    { key: 'warnings', label: '到期预警' },
    { key: 'ledger', label: '会诊申请单台账' },
  ];

  const visibleTabs = getTabs.filter(t => !t.roles || t.roles.includes(user.role));

  if (tab === 'registration') {
    // 登记员直接看登记列表，包含创建和列表
  }

  const renderMain = () => {
    if (selectedId) {
      return <ConsultationDetail id={selectedId} user={user} onBack={() => setSelectedId(null)} onRefresh={() => {}} />;
    }
    if (showCreate) {
      return <ConsultationCreate user={user} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); }} />;
    }
    switch (tab) {
      case 'dashboard':
        return <Dashboard user={user} onOpen={(id) => setSelectedId(id)} />;
      case 'list':
        return <ConsultationList user={user} stage={null} onOpen={setSelectedId} onNew={() => setShowCreate(true)} />;
      case 'registration':
        return <ConsultationList user={user} stage="registration" onOpen={setSelectedId} onNew={() => setShowCreate(true)} />;
      case 'verification':
        return <ConsultationList user={user} stage="verification" onOpen={setSelectedId} />;
      case 'review':
        return <ConsultationList user={user} stage="review" onOpen={setSelectedId} />;
      case 'warnings':
        return <WarningPanel user={user} onOpen={setSelectedId} />;
      case 'ledger':
        return <LedgerPanel user={user} onOpen={setSelectedId} />;
      default:
        return null;
    }
  };

  const tabTitles: Record<TabType, string> = {
    dashboard: '工作台',
    list: '会诊申请单',
    registration: '会诊申请单登记',
    verification: '过程核验',
    review: '复核归档',
    warnings: '到期预警',
    ledger: '会诊申请单台账',
  };

  return (
    <div className="layout">
      <div className="sidebar">
        <h2>三甲医院医务部</h2>
        <div style={{ padding: '0 20px 16px', fontSize: 13, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
          会诊申请单月底集中处理系统
        </div>
        {visibleTabs.map(t => (
          <div
            key={t.key}
            className={`nav-item ${tab === t.key ? 'active' : ''}`}
            onClick={() => { setTab(t.key); setSelectedId(null); setShowCreate(false); }}
          >
            {t.label}
          </div>
        ))}
      </div>
      <div className="main">
        <div className="topbar">
          <h1>{selectedId ? '会诊申请单详情' : (showCreate ? '新建会诊申请单' : tabTitles[tab])}</h1>
          <div className="user-info">
            <span style={{ color: 'var(--text-secondary)' }}>
              {user.real_name}
            </span>
            <span className="badge pending">{roleLabels[user.role]}</span>
            <button onClick={handleLogout}>退出</button>
          </div>
        </div>
        {renderMain()}
      </div>
    </div>
  );
}
