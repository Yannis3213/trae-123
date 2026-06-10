'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import type { Order, OrderStats, UserRole } from '../lib/types';
import { fmtAmount, fmtDate, fmtTime, relativeDeadline, statusBadge, urgencyBadge } from '../lib/format';

type TabKey = 'pending' | 'transferred' | 'reviewed';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending', label: '待分派' },
  { key: 'transferred', label: '已转办' },
  { key: 'reviewed', label: '已回访' },
];

const PAGE_LABEL: Record<UserRole, string> = {
  registrar: '住客登记员（发起 / 补正）',
  supervisor: '住客审核主管（办理）',
  reviewer: '酒店集团复核负责人（复核归档）',
};

export default function OrdersListPage() {
  const [tab, setTab] = useState<TabKey>('pending');
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [keyword, setKeyword] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('');
  const [handlerScope, setHandlerScope] = useState<'mine' | 'all'>('mine');
  const [orderType, setOrderType] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);

  const countsByTab = useMemo(() => {
    if (!stats) return { pending: 0, transferred: 0, reviewed: 0 };
    return stats.mine;
  }, [stats]);

  const load = async () => {
    setLoading(true);
    const res = await api.listOrders({
      status: tab,
      keyword: keyword || undefined,
      urgency: urgencyFilter || undefined,
      handler_scope: handlerScope,
      order_type: orderType || undefined,
      page,
      page_size: pageSize,
    });
    setLoading(false);
    if (!res.ok) {
      setMessage({ type: 'err', text: `加载失败：${res.message}` });
      return;
    }
    setOrders(res.data!.list);
    setTotal(res.data!.total);
    setStats(res.data!.stats || null);
  };

  useEffect(() => { setPage(1); }, [tab, keyword, urgencyFilter, handlerScope, orderType]);
  useEffect(() => { load(); }, [tab, keyword, urgencyFilter, handlerScope, orderType, page]);

  const refreshAll = async () => {
    await load();
    setMessage({ type: 'ok', text: '队列已刷新，页面状态与后端记录同步完成' });
    setTimeout(() => setMessage(null), 2500);
  };

  return (
    <div>
      <div className="banner banner-info" style={{ marginBottom: 14 }}>
        <strong>📋 岗位配置：</strong>
        您当前以选定角色办理订单。列表仅展示您角色下可处理的订单；点击“刷新队列”可将页面状态与后端记录同步（避免静默覆盖）。
        切换右上角角色可体验不同环节的视角。
      </div>

      {message && (
        <div className={`banner banner-${message.type === 'ok' ? 'ok' : message.type === 'err' ? 'err' : 'info'}`}>
          {message.text}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card stat-pending">
          <div className="stat-label">待分派（我的队列）</div>
          <div className="stat-value">{stats?.mine.pending ?? 0}</div>
        </div>
        <div className="stat-card stat-transferred">
          <div className="stat-label">已转办（我的队列）</div>
          <div className="stat-value">{stats?.mine.transferred ?? 0}</div>
        </div>
        <div className="stat-card stat-reviewed">
          <div className="stat-label">已回访（可归档）</div>
          <div className="stat-value">{stats?.mine.reviewed ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">待我处理合计</div>
          <div className="stat-value">{stats?.mine.my_to_handle ?? 0}</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-label">临期预警（≤1小时）</div>
          <div className="stat-value">{stats?.urgency.warning ?? 0}</div>
        </div>
        <div className="stat-card stat-overdue">
          <div className="stat-label">逾期（未归档）</div>
          <div className="stat-value">{stats?.urgency.overdue ?? 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">住客订单列表（状态联动 · 刷新队列即同步后端）</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link className="btn btn-primary" href="/new">+ 新建住客订单</Link>
            <Link className="btn" href="/batch">批量处理 / 到期预警</Link>
            <button className="btn" onClick={refreshAll} disabled={loading}>🔄 刷新队列</button>
          </div>
        </div>
        <div className="card-body">
          <div className="tabs">
            {TABS.map(t => (
              <button
                key={t.key}
                className={`tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                <span className="tab-count">{(countsByTab as any)[t.key] || 0}</span>
              </button>
            ))}
          </div>

          <div className="filter-row">
            <input
              className="input" placeholder="订单号 / 住客姓名 / 房号"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              style={{ minWidth: 240 }}
            />
            <select className="select" value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)}>
              <option value="">全部紧急度</option>
              <option value="normal">正常</option>
              <option value="warning">临期（≤1小时）</option>
              <option value="overdue">逾期</option>
            </select>
            <select className="select" value={orderType} onChange={e => setOrderType(e.target.value)}>
              <option value="">全部订单类型</option>
              <option value="normal">普通</option>
              <option value="vip">VIP</option>
            </select>
            <select className="select" value={handlerScope} onChange={e => setHandlerScope(e.target.value as 'mine' | 'all')}>
              <option value="mine">我的处理范围</option>
              <option value="all">全量（仅限查看）</option>
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>订单号</th>
                  <th>住客</th>
                  <th>房号</th>
                  <th>入住 → 退房</th>
                  <th>金额</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>当前环节</th>
                  <th>处理人</th>
                  <th>到期 / 紧急度</th>
                  <th>已有证据</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={12} className="empty">加载中…</td></tr>
                )}
                {!loading && orders.length === 0 && (
                  <tr><td colSpan={12} className="empty">当前筛选条件下暂无住客订单</td></tr>
                )}
                {!loading && orders.map(o => {
                  const rowCls = o.deadline_urgency?.level === 'overdue' ? 'row-overdue'
                    : o.deadline_urgency?.level === 'warning' ? 'row-warning' : '';
                  return (
                    <tr key={o.id} className={rowCls}>
                      <td><strong>{o.order_no}</strong><div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtTime(o.created_at)}</div></td>
                      <td>{o.guest_name}</td>
                      <td>{o.room_no || '—'}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(o.check_in_date)}<br /><span style={{ color: '#9ca3af' }}>→ {fmtDate(o.check_out_date)}</span></td>
                      <td className="amount">{fmtAmount(o.amount)}</td>
                      <td>{o.order_type === 'vip' ? <span className="urgency-tag urgency-warning">VIP</span> : '普通'}</td>
                      <td>{statusBadge(o.status, o.status_label)}</td>
                      <td style={{ fontSize: 12 }}>{o.current_role_label || '—'}</td>
                      <td style={{ fontSize: 12 }}>{o.handler_name || o.current_handler || '—'}</td>
                      <td style={{ fontSize: 12 }}>
                        {urgencyBadge(o.deadline_urgency?.level || 'none', o.deadline_urgency?.label || '无')}
                        <div style={{ color: '#6b7280', marginTop: 3 }}>{relativeDeadline(o.deadline_urgency)}</div>
                      </td>
                      <td>
                        {(o.evidence_labels || []).map(e => <span key={e} className="evidence-pill">{e}</span>)}
                        {(o.evidence_labels || []).length === 0 && <span style={{ color: '#dc2626', fontSize: 11 }}>无证据</span>}
                      </td>
                      <td>
                        <Link className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} href={`/orders/${o.id}`}>
                          进入详情办理
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <div>总计 {total} 条 · 第 {page} 页</div>
            <div className="btns">
              <button className="btn" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>上一页</button>
              <button className="btn" disabled={page * pageSize >= total || loading} onClick={() => setPage(p => p + 1)}>下一页</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
