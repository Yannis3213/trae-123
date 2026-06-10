'use client';

import { useEffect, useState } from 'react';
import { fetchApplications, Application, getUser, User } from '@/lib/api';
import Link from 'next/link';

type TabKey = 'normal' | 'approaching' | 'overdue';

export default function OverduePage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overdue');
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUser(getUser());
  }, []);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: TabKey; label: string; color: string; icon: string }[] = [
    { key: 'overdue', label: '已逾期', color: 'red', icon: '🔴' },
    { key: 'approaching', label: '临期（3天内）', color: 'yellow', icon: '🟡' },
    { key: 'normal', label: '正常', color: 'green', icon: '🟢' },
  ];

  const counts = {
    overdue: apps.filter(a => getDueStatus(a) === '逾期').length,
    approaching: apps.filter(a => getDueStatus(a) === '临期').length,
    normal: apps.filter(a => getDueStatus(a) === '正常').length,
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600 }}>⏰ 到期预警</h2>
        <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
          月底集中处理 · 节点超时责任到人 · 逾期批量推进逐条拦截
        </p>
      </div>

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card stat-red" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('overdue')}>
          <div className="stat-label">已逾期</div>
          <div className="stat-value">{counts.overdue}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>需立即处理</div>
        </div>
        <div className="stat-card stat-yellow" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('approaching')}>
          <div className="stat-label">临期（3天内）</div>
          <div className="stat-value">{counts.approaching}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>需加快处理</div>
        </div>
        <div className="stat-card stat-green" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('normal')}>
          <div className="stat-label">正常</div>
          <div className="stat-value">{counts.normal}</div>
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
          </div>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>加载中...</div>
        ) : apps.length === 0 ? (
          <div className="empty-state">
            {activeTab === 'normal' && '🎉 当前没有未完成的正常申请'}
            {activeTab === 'approaching' && '✅ 暂无临期申请，继续保持！'}
            {activeTab === 'overdue' && '✅ 暂无逾期申请，处理及时！'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>申请编号</th>
                <th>客户姓名</th>
                <th>账户类型</th>
                <th>状态</th>
                <th>到期日期</th>
                <th>剩余/逾期天数</th>
                <th>责任人</th>
                <th>客户经理</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => {
                const daysLeft = getDaysLeft(app.due_date);
                return (
                  <tr key={app.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{app.application_no}</td>
                    <td>{app.customer_name}</td>
                    <td>{app.account_type}</td>
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
                    <td>
                      {getResponsiblePerson(app)}
                    </td>
                    <td>{app.customer_manager}</td>
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
          <p>• <strong>待签收未分配</strong>：节点超时责任 = 待分配（运营主管需及时签收）</p>
          <p>• <strong>运营主管签收中</strong>：节点超时责任 = 运营主管</p>
          <p>• <strong>支行行长签收中</strong>：节点超时责任 = 支行行长</p>
          <p>• <strong>异常回传</strong>：节点超时责任 = 客户经理（需尽快补正）</p>
          <p>• <strong>逾期批量推进</strong>：逐条拦截校验，状态冲突保留原值，提示需谁补正</p>
        </div>
      </div>
    </div>
  );
}

function getDaysLeft(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function getDueStatus(app: Application): string {
  const days = getDaysLeft(app.due_date);
  if (days < 0) return '逾期';
  if (days <= 3) return '临期';
  return '正常';
}

function getResponsiblePerson(app: Application): string {
  if (app.status === '异常回传') {
    return `${app.customer_manager}（客户经理）`;
  }
  if (app.current_handler) {
    return `${app.current_handler}（${app.current_role || ''}）`;
  }
  if (app.status === '待签收') {
    return '待分配';
  }
  return '-';
}

function statusBadge(s: string) {
  switch (s) {
    case '待签收': return 'badge-blue';
    case '异常回传': return 'badge-red';
    case '签收完成': return 'badge-green';
    default: return 'badge-gray';
  }
}
