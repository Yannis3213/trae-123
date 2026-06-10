'use client';

import { useEffect, useState } from 'react';
import { fetchStats, Stats, getUser, User, fetchApplications, Application } from '@/lib/api';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [recent, setRecent] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getUser());
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, apps] = await Promise.all([
        fetchStats(),
        fetchApplications({}),
      ]);
      setStats(s);
      setRecent(apps.items.slice(0, 5));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>加载中...</div>;
  if (!stats) return <div>加载失败</div>;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
          欢迎回来，{user?.real_name}
        </h2>
        <p style={{ color: '#64748b', fontSize: '13px' }}>
          {user?.role} · {user?.branch} · 月底集中处理开户申请
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-blue">
          <div className="stat-label">全部申请</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card stat-blue">
          <div className="stat-label">待处理</div>
          <div className="stat-value">{stats.pending}</div>
        </div>
        <div className="stat-card stat-green">
          <div className="stat-label">已完成</div>
          <div className="stat-value">{stats.completed}</div>
        </div>
        <div className="stat-card stat-yellow">
          <div className="stat-label">临期（3天内）</div>
          <div className="stat-value">{stats.approaching}</div>
        </div>
        <div className="stat-card stat-red">
          <div className="stat-label">已逾期</div>
          <div className="stat-value">{stats.overdue}</div>
        </div>
        <div className="stat-card stat-red">
          <div className="stat-label">异常回传</div>
          <div className="stat-value">{stats.exception}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-title">快捷入口</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link href="/applications" className="btn btn-primary">
            查看全部申请
          </Link>
          <Link href="/applications/overdue" className="btn btn-warning">
            到期预警
          </Link>
          {(user?.role === '运营主管' || user?.role === '支行行长') && (
            <Link href="/batch" className="btn btn-success">
              批量处理
            </Link>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">最近申请</div>
        <table>
          <thead>
            <tr>
              <th>申请编号</th>
              <th>客户姓名</th>
              <th>账户类型</th>
              <th>状态</th>
              <th>到期状态</th>
              <th>客户经理</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((app) => (
              <tr key={app.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{app.application_no}</td>
                <td>{app.customer_name}</td>
                <td>{app.account_type}</td>
                <td>
                  <span className={`badge ${getStatusBadge(app.status)}`}>{app.status}</span>
                </td>
                <td>
                  <span className={`badge ${getDueBadge(app.due_status)}`}>{app.due_status}</span>
                </td>
                <td>{app.customer_manager}</td>
                <td>
                  <Link href={`/applications/${app.id}`} className="btn btn-sm">
                    详情
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case '待签收': return 'badge-blue';
    case '异常回传': return 'badge-red';
    case '签收完成': return 'badge-green';
    default: return 'badge-gray';
  }
}

function getDueBadge(due: string) {
  switch (due) {
    case '正常': return 'badge-green';
    case '临期': return 'badge-yellow';
    case '逾期': return 'badge-red';
    default: return 'badge-gray';
  }
}
