'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import type { Order, BatchResultItem } from '../../lib/types';
import { fmtAmount, fmtDate, fmtTime, relativeDeadline, statusBadge, urgencyBadge } from '../../lib/format';

export default function BatchPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: 'ok' | 'err' | 'info' | 'warn'; text: string } | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResultItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'overdue' | 'warning' | 'normal' | 'all'>('overdue');

  const load = async () => {
    setLoading(true);
    const r = await api.listOrders({ handler_scope: 'all', page_size: 200 });
    setLoading(false);
    if (!r.ok) {
      setMessage({ type: 'err', text: `加载失败：${r.message}` });
      return;
    }
    setOrders(r.data!.list);
    setBatchResults(null);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const nonArchived = orders.filter(o => o.status !== 'archived');
    if (view === 'all') return nonArchived;
    return nonArchived.filter(o => o.deadline_urgency?.level === view);
  }, [orders, view]);

  const stats = useMemo(() => {
    const nonArchived = orders.filter(o => o.status !== 'archived');
    return {
      normal: nonArchived.filter(o => o.deadline_urgency?.level === 'normal').length,
      warning: nonArchived.filter(o => o.deadline_urgency?.level === 'warning').length,
      overdue: nonArchived.filter(o => o.deadline_urgency?.level === 'overdue').length,
    };
  }, [orders]);

  const toggle = (id: string) => {
    setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };
  const toggleAll = () => {
    if (selectedIds.length === filtered.length && filtered.length > 0) setSelectedIds([]);
    else setSelectedIds(filtered.map(o => o.id));
  };

  const pushSelected = async () => {
    if (selectedIds.length === 0) {
      setMessage({ type: 'warn', text: '请先选择要推进的订单' });
      return;
    }
    setBusy(true);
    const r = await api.batchPushOverdue(selectedIds);
    setBusy(false);
    if (!r.ok) {
      setMessage({ type: 'err', text: `批量推进失败：${r.message}` });
      return;
    }
    setBatchResults(r.data!.results);
    const ok = r.data!.success_count;
    const fail = r.data!.total - ok;
    setMessage({
      type: ok > 0 ? 'ok' : fail > 0 ? 'warn' : 'info',
      text: `批量推进完成：成功 ${ok} 条，失败 ${fail} 条，队列将刷新`,
    });
    setSelectedIds([]);
    await load();
  };

  return (
    <div>
      <div className="breadcrumb"><Link href="/">住客订单列表</Link> / <span>批量处理 / 到期预警</span></div>

      {message && (
        <div className={`banner banner-${message.type === 'ok' ? 'ok' : message.type === 'err' ? 'err' : message.type === 'warn' ? 'warn' : 'info'}`}>
          {message.text}
        </div>
      )}

      <div className="banner banner-info">
        <strong>到期预警队列：</strong>
        一眼区分正常 / 临期（≤1小时）/ 逾期。逾期批量推进将<strong>逐条拦截并返回成功/失败原因</strong>，
        节点超时按<strong>当前处理人</strong>计算。处理成功后会刷新队列、同步后端版本。
      </div>

      <div className="page-grid-3col" style={{ marginBottom: 16 }}>
        <div className={`queue-card queue-overdue ${view === 'overdue' ? 'stat-overdue' : ''}`}
          style={{ borderLeft: view === 'overdue' ? '4px solid var(--overdue)' : '1px solid var(--border)', cursor: 'pointer' }}
          onClick={() => setView('overdue')}>
          <h4>🔴 逾期订单</h4>
          <div className="big">{stats.overdue}</div>
          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>已超办理期限，需批量推进或优先处理</div>
        </div>
        <div className={`queue-card queue-warning ${view === 'warning' ? 'stat-warning' : ''}`}
          style={{ borderLeft: view === 'warning' ? '4px solid var(--warning)' : '1px solid var(--border)', cursor: 'pointer' }}
          onClick={() => setView('warning')}>
          <h4>🟠 临期预警（≤1小时）</h4>
          <div className="big">{stats.warning}</div>
          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>临近办理截止，建议立即进入详情办理</div>
        </div>
        <div className={`queue-card queue-normal ${view === 'normal' ? 'stat' : ''}`}
          style={{ borderLeft: view === 'normal' ? '4px solid var(--reviewed)' : '1px solid var(--border)', cursor: 'pointer' }}
          onClick={() => setView('normal')}>
          <h4>🟢 正常办理中</h4>
          <div className="big">{stats.normal}</div>
          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>距截止尚有时间，按常规节奏办理</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            住客订单批量处理 · 当前视图：
            <select className="select" style={{ marginLeft: 8 }} value={view}
              onChange={e => setView(e.target.value as any)}>
              <option value="overdue">仅逾期</option>
              <option value="warning">仅临期</option>
              <option value="normal">仅正常</option>
              <option value="all">全部（未归档）</option>
            </select>
            <span style={{ marginLeft: 12, fontSize: 12, color: '#6b7280' }}>共 {filtered.length} 条</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={load} disabled={loading}>🔄 刷新队列</button>
            <button className="btn btn-danger" disabled={busy || selectedIds.length === 0} onClick={pushSelected}>
              🚀 逾期批量推进（逐条返回结果）
            </button>
          </div>
        </div>
        <div className="card-body">
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={toggleAll} />
                  </th>
                  <th>订单号</th>
                  <th>住客</th>
                  <th>房号</th>
                  <th>入住</th>
                  <th>金额</th>
                  <th>状态</th>
                  <th>当前处理人</th>
                  <th>紧急度 / 截止</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={10} className="empty">加载中…</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={10} className="empty">此视图下暂无订单</td></tr>}
                {!loading && filtered.map(o => {
                  const rowCls = o.deadline_urgency?.level === 'overdue' ? 'row-overdue'
                    : o.deadline_urgency?.level === 'warning' ? 'row-warning' : '';
                  return (
                    <tr key={o.id} className={rowCls}>
                      <td><input type="checkbox" checked={selectedIds.includes(o.id)} onChange={() => toggle(o.id)} /></td>
                      <td><strong>{o.order_no}</strong><div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtTime(o.created_at)}</div></td>
                      <td>{o.guest_name}</td>
                      <td>{o.room_no || '—'}</td>
                      <td>{fmtDate(o.check_in_date)}</td>
                      <td className="amount">{fmtAmount(o.amount)}</td>
                      <td>{statusBadge(o.status, o.status_label)}</td>
                      <td style={{ fontSize: 12 }}>
                        <div>{o.handler_name || o.current_handler || '—'}</div>
                        <div style={{ color: '#6b7280' }}>{o.current_role_label || ''}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {urgencyBadge(o.deadline_urgency?.level || 'none', o.deadline_urgency?.label || '无')}
                        <div style={{ color: '#6b7280', marginTop: 3 }}>{relativeDeadline(o.deadline_urgency)}<br />{fmtTime(o.deadline)}</div>
                      </td>
                      <td><Link className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} href={`/orders/${o.id}`}>进入详情</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
            已勾选 <strong>{selectedIds.length}</strong> 条；点击「逾期批量推进」将逐条执行并返回每条的成功/失败原因（包含拦截码与拦截原因）。
          </div>

          {batchResults && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>📋 批量推进结果（逐条返回）</div>
              <div className="batch-result">
                {batchResults.map((r, idx) => (
                  <div key={idx} className={`batch-row ${r.success ? 'success' : 'fail'}`}>
                    <div>
                      {r.success ? '✅' : '❌'}
                      <strong style={{ margin: '0 6px' }}>{r.order_no || r.order_id}</strong>
                      {r.code && <span style={{ color: '#6b7280', fontSize: 11 }}>[{r.code}]</span>}
                    </div>
                    <div>{r.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
