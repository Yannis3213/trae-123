'use client';

import { useEffect, useState } from 'react';
import {
  fetchApplications,
  fetchStats,
  Application,
  getUser,
  User,
  parseErrorMessage,
  formatDateTime,
  getDaysLeft as apiGetDaysLeft,
  getResponsiblePerson as apiGetResponsiblePerson,
  Stats,
} from '@/lib/api';
import Link from 'next/link';

type TabKey = 'normal' | 'approaching' | 'overdue';

export default function OverduePage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overdue');
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    setUser(getUser());
    loadStats();
  }, []);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadStats = async () => {
    try {
      const s = await fetchStats();
      setStats(s);
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  };

  const loadData = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const dueMap: Record<TabKey, string> = {
        normal: '正常',
        approaching: '临期',
        overdue: '逾期',
      };
      const res = await fetchApplications({
        due_status: dueMap[activeTab],
      });
      setApps(res.items.filter(a => a.status !== '签收完成'));
      loadStats();
    } catch (err: any) {
      const parsed = parseErrorMessage(err);
      setError(parsed.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const tabs: { key: TabKey; label: string; color: string; icon: string; count?: number }[] = [
    { key: 'overdue', label: '已逾期', color: 'red', icon: '🔴', count: stats?.overdue },
    { key: 'approaching', label: '临期（3天内）', color: 'yellow', icon: '🟡', count: stats?.approaching },
    { key: 'normal', label: '正常', color: 'green', icon: '🟢', count: stats?.normal },
  ];

  const sortedApps = [...apps].sort((a, b) => {
    const daysA = apiGetDaysLeft(a.due_date);
    const daysB = apiGetDaysLeft(b.due_date);
    return daysA - daysB;
  });

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600 }}>⏰ 到期预警</h2>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
            月底集中处理 · 节点超时责任到人 · 逾期批量推进逐条拦截
          </p>
        </div>
        <button
          className="btn btn-sm"
          onClick={() => loadData(true)}
          disabled={refreshing || loading}
        >
          {refreshing ? '刷新中...' : '🔄 刷新'}
        </button>
      </div>

      {error && <div className="alert alert-error">
        {error}
        <button className="btn btn-sm" style={{ marginLeft: '12px' }} onClick={() => loadData()}>
          重试
        </button>
      </div>}

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card stat-red" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('overdue')}>
          <div className="stat-label">已逾期</div>
          <div className="stat-value">{tabs[0].count ?? '-'}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>需立即处理</div>
        </div>
        <div className="stat-card stat-yellow" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('approaching')}>
          <div className="stat-label">临期（3天内）</div>
          <div className="stat-value">{tabs[1].count ?? '-'}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>需加快处理</div>
        </div>
        <div className="stat-card stat-green" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('normal')}>
          <div className="stat-label">正常</div>
          <div className="stat-value">{tabs[2].count ?? '-'}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>时间充裕</div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: '20px' }}>
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            style={{
              color: activeTab === tab.key
                ? (tab.color === 'red' ? '#dc2626' : tab.color === 'yellow' ? '#ca8a04' : '#16a34a')
                : undefined,
              borderBottomColor: activeTab === tab.key
                ? (tab.color === 'red' ? '#dc2626' : tab.color === 'yellow' ? '#ca8a04' : '#16a34a')
                : undefined,
            }}
          >
            {tab.icon} {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{ marginLeft: '6px', fontSize: '12px' }}>({tab.count})</span>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '16px' }}>⏳ 加载中...</div>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
            <div>加载失败</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: '12px' }} onClick={() => loadData()}>
              重新加载
            </button>
          </div>
        ) : sortedApps.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>
              {activeTab === 'normal' ? '🎉' : activeTab === 'approaching' ? '✅' : '✅'}
            </div>
            <div>
              {activeTab === 'normal' && '当前没有未完成的正常申请'}
              {activeTab === 'approaching' && '暂无临期申请，继续保持！'}
              {activeTab === 'overdue' && '暂无逾期申请，处理及时！'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              点击上方标签切换查看其他状态
            </div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>申请编号</th>
                <th>客户姓名</th>
                <th>账户类型</th>
                <th>金额</th>
                <th>当前阶段</th>
                <th>状态</th>
                <th>到期日期</th>
                <th>剩余/逾期天数</th>
                <th>责任人</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedApps.map((app) => {
                const daysLeft = apiGetDaysLeft(app.due_date);
                return (
                  <tr key={app.id} style={
                    daysLeft < 0 ? { background: '#fef2f2' } :
                    daysLeft <= 3 ? { background: '#fefce8' } : undefined
                  }>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{app.application_no}</td>
                    <td>{app.customer_name}</td>
                    <td>{app.account_type}</td>
                    <td>¥{app.amount.toLocaleString()}</td>
                    <td>
                      <span className="badge badge-gray">{app.current_role || '-'}</span>
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(app.status)}`}>{app.status}</span>
                    </td>
                    <td>{app.due_date}</td>
                    <td>
                      <span style={{
                        color: daysLeft < 0 ? '#dc2626' : daysLeft <= 3 ? '#ca8a04' : '#16a34a',
                        fontWeight: 600,
                      }}>
                        {daysLeft < 0 ? `逾期 ${Math.abs(daysLeft)} 天` : `剩余 ${daysLeft} 天`}
                      </span>
                    </td>
                    <td>{apiGetResponsiblePerson(app)}</td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {formatDateTime(app.created_at)}
                    </td>
                    <td>
                      <Link href={`/applications/${app.id}`} className="btn btn-sm btn-primary">
                        处理
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-title">超时责任认定规则</div>
        <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.8 }}>
          <p>• <strong>待签收未分配</strong>：节点超时责任 = 待{user?.role || '分配'}（需及时签收）</p>
          <p>• <strong>运营主管签收中</strong>：节点超时责任 = 运营主管（需在期限内审核）</p>
          <p>• <strong>支行行长签收中</strong>：节点超时责任 = 支行行长（需在期限内复核）</p>
          <p>• <strong>异常回传</strong>：节点超时责任 = 客户经理（需尽快补正材料）</p>
          <p>• <strong>版本冲突</strong>：提交版本落后于当前版本时，保留原值并提示刷新</p>
          <p>• <strong>逾期批量推进</strong>：逐条拦截校验，状态冲突保留原值，提示需谁补正</p>
        </div>
      </div>
    </div>
  );
}

function statusBadge(s: string) {
  switch (s) {
    case '待签收': return 'badge-blue';
    case '异常回传': return 'badge-red';
    case '签收完成': return 'badge-green';
    default: return 'badge-gray';
  }
}
