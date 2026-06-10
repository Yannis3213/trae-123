'use client';

import { useEffect, useState } from 'react';
import {
  fetchApplications,
  Application,
  getUser,
  User,
  parseErrorMessage,
  formatDateTime,
} from '@/lib/api';
import Link from 'next/link';

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [dueFilter, setDueFilter] = useState('');
  const [queueFilter, setQueueFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setUser(getUser());
    loadData();
  }, [statusFilter, dueFilter, queueFilter]);

  const loadData = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (dueFilter) params.due_status = dueFilter;
      if (queueFilter) params.queue = queueFilter;
      if (keyword) params.keyword = keyword;
      const res = await fetchApplications(params);
      setApps(res.items);
    } catch (err: any) {
      const parsed = parseErrorMessage(err);
      setError(parsed.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      loadData();
    }
  };

  const queueOptions = getQueueOptions(user?.role || '');

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600 }}>开户申请列表</h2>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
            共 <strong style={{ color: '#1e40af' }}>{apps.length}</strong> 条记录
            {queueFilter && <span style={{ marginLeft: '8px' }}>· 当前队列：{queueOptions.find(q => q.value === queueFilter)?.label}</span>}
            {user?.role && <span style={{ marginLeft: '8px' }}>· 角色：{user.role}</span>}
          </p>
        </div>
        <button
          className="btn btn-sm"
          onClick={() => loadData(true)}
          disabled={refreshing}
        >
          {refreshing ? '刷新中...' : '🔄 刷新'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button className="btn btn-sm" style={{ marginLeft: '12px' }} onClick={() => loadData()}>
            重试
          </button>
        </div>
      )}

      <div className="card">
        <div className="filter-bar">
          <select value={queueFilter} onChange={(e) => setQueueFilter(e.target.value)}>
            <option value="">全部队列</option>
            {queueOptions.map((q) => (
              <option key={q.value} value={q.value}>{q.label}</option>
            ))}
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">全部状态</option>
            <option value="待签收">待签收</option>
            <option value="异常回传">异常回传</option>
            <option value="签收完成">签收完成</option>
          </select>

          <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value)}>
            <option value="">全部到期状态</option>
            <option value="正常">正常</option>
            <option value="临期">临期（3天内）</option>
            <option value="逾期">逾期</option>
          </select>

          <input
            type="text"
            placeholder="搜索客户名、申请编号、电话..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleSearch}
            style={{ width: '240px' }}
          />

          <button className="btn btn-primary btn-sm" onClick={() => loadData()}>查询</button>
          <button className="btn btn-sm" onClick={() => {
            setStatusFilter('');
            setDueFilter('');
            setQueueFilter('');
            setKeyword('');
            setTimeout(() => loadData(), 50);
          }}>重置</button>
        </div>

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
        ) : apps.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
            <div>暂无数据</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              当前筛选条件下没有开户申请记录
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
                <th>到期状态</th>
                <th>当前处理人</th>
                <th>版本</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} style={
                  app.due_status === '逾期' ? { background: '#fef2f2' } :
                  app.due_status === '临期' ? { background: '#fefce8' } : undefined
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
                  <td>
                    <span className={`badge ${dueBadge(app.due_status)}`}>{app.due_status}</span>
                  </td>
                  <td>{app.current_handler || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>v{app.version}</td>
                  <td style={{ fontSize: '12px', color: '#64748b' }}>
                    {formatDateTime(app.created_at)}
                  </td>
                  <td>
                    <Link href={`/applications/${app.id}`} className="btn btn-sm btn-primary">
                      办理
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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

function dueBadge(d: string) {
  switch (d) {
    case '正常': return 'badge-green';
    case '临期': return 'badge-yellow';
    case '逾期': return 'badge-red';
    default: return 'badge-gray';
  }
}

function getQueueOptions(role: string): { value: string; label: string }[] {
  switch (role) {
    case '客户经理':
      return [
        { value: 'my', label: '我的申请' },
      ];
    case '运营主管':
      return [
        { value: 'pending', label: '待签收' },
        { value: 'my', label: '我签收的' },
        { value: 'returned', label: '异常回传' },
      ];
    case '支行行长':
      return [
        { value: 'pending', label: '待签收' },
        { value: 'my', label: '我签收的' },
        { value: 'completed', label: '已完成' },
      ];
    default:
      return [];
  }
}
