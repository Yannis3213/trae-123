import React, { useState, useEffect, useMemo } from 'react';
import { api, type User, type DictItem, type PrescriptionOrder } from '../lib/api';
import OrderDetail from './OrderDetail';
import CreateOrderModal from './CreateOrderModal';
import BatchProcessModal from './BatchProcessModal';

interface Props {
  user: User;
  dict: {
    roles: DictItem[];
    statuses: DictItem[];
    abnormalTypes: DictItem[];
    warningLevels: DictItem[];
    transitions: Record<string, string[]>;
  } | null;
  onChanged: () => void;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { hour12: false });
};

const timeLeft = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / (1000 * 60 * 60));
  const mins = Math.floor((abs % (1000 * 60 * 60)) / (1000 * 60));
  const prefix = diff < 0 ? '已超 ' : '剩 ';
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const h = hours % 24;
    return `${prefix}${days}天${h}小时`;
  }
  return `${prefix}${hours}小时${mins}分`;
};

const OrderList: React.FC<Props> = ({ user, dict, onChanged }) => {
  const [orders, setOrders] = useState<PrescriptionOrder[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [warningFilter, setWarningFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      api.listOrders({ status: statusFilter, warning: warningFilter, keyword, onlyMine: onlyMine ? 'true' : 'false' }),
      api.getStatistics()
    ]);
    setLoading(false);
    if (r1.code === 0 && r1.data) setOrders(r1.data);
    if (r2.code === 0 && r2.data) setStats(r2.data);
  };

  useEffect(() => { load(); }, [statusFilter, warningFilter, keyword, onlyMine]);

  const allWarningStats = useMemo(() => {
    if (!stats || !stats.byWarning) return [];
    return stats.byWarning;
  }, [stats]);

  const toggleSelect = (id: string) => {
    setSelected(sel => sel.includes(id) ? sel.filter(i => i !== id) : [...sel, id]);
  };
  const toggleSelectAll = () => {
    setSelected(sel => sel.length === orders.length ? [] : orders.map(o => o.id));
  };

  const showMsg = (type: string, text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  };

  const canCreate = user.role === 'store_clerk';
  const canBatch = user.role !== 'store_clerk';

  return (
    <div>
      {stats && (
        <div className="warning-banner">
          {allWarningStats.map(w => (
            <div key={w.level} className={`wb-card ${w.level}`}>
              <div className="wb-title">{w.levelName}</div>
              <div className="wb-count">{w.count}</div>
            </div>
          ))}
          <div className="wb-card normal" style={{ borderLeftColor: '#2e5b8a' }}>
            <div className="wb-title">待我处理</div>
            <div className="wb-count">{stats.myPending || 0}</div>
          </div>
        </div>
      )}

      {stats && (
        <div className="stats-grid">
          {stats.byStatus?.map((s: any) => (
            <div key={s.status} className={`stat-card status-${s.status}`}>
              <div className="stat-label">{s.statusName}</div>
              <div className="stat-value">{s.count}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

        <div className="toolbar">
          <label>状态：
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">全部</option>
              {dict?.statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label>预警：
            <select value={warningFilter} onChange={e => setWarningFilter(e.target.value)}>
              <option value="">全部</option>
              {dict?.warningLevels.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </label>
          <label>
            <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />
            &nbsp;仅看我处理
          </label>
          <input type="text" placeholder="搜索单号/患者姓名" value={keyword} onChange={e => setKeyword(e.target.value)} />

          <div style={{ flex: 1 }} />

          {canCreate && (
            <button className="btn" onClick={() => setShowCreate(true)}>＋ 新建处方订单</button>
          )}
          {canBatch && (
            <button
              className="btn success"
              onClick={() => setShowBatch(true)}
              disabled={selected.length === 0}
            >
              批量处理（{selected.length}）
            </button>
          )}
        </div>

        {loading ? (
          <div className="empty">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="empty">暂无处方订单数据</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {canBatch && (
                  <th style={{ width: 40 }}>
                    <input type="checkbox" checked={selected.length === orders.length && orders.length > 0} onChange={toggleSelectAll} />
                  </th>
                )}
                <th>订单号</th>
                <th>患者姓名</th>
                <th>门店</th>
                <th>药品数</th>
                <th>金额(元)</th>
                <th>状态</th>
                <th>预警</th>
                <th>到期剩余</th>
                <th>当前处理人</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  {canBatch && (
                    <td>
                      <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggleSelect(o.id)} />
                    </td>
                  )}
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{o.order_no}</td>
                  <td>{o.patient_name}</td>
                  <td>{o.store_name}</td>
                  <td>{o.drugs_count}</td>
                  <td>{o.total_amount.toFixed(2)}</td>
                  <td><span className={`tag status-${o.status}`}>{o.statusName}</span></td>
                  <td><span className={`tag warning-${o.warningLevel}`}>{o.warningName}</span></td>
                  <td>{timeLeft(o.due_at)}</td>
                  <td>
                    {o.handler_name
                      ? (<><span className={`tag role-${o.handler_role}`}>{o.handler_name}</span></>)
                      : <span style={{ color: '#9ca3af' }}>未分配</span>}
                  </td>
                  <td>{formatTime(o.created_at)}</td>
                  <td>
                    <button className="link-btn" onClick={() => setDetailId(o.id)}>查看详情</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detailId && (
        <OrderDetail
          orderId={detailId}
          user={user}
          dict={dict}
          onClose={() => { setDetailId(null); onChanged(); }}
          onMessage={showMsg}
        />
      )}
      {showCreate && (
        <CreateOrderModal
          user={user}
          onClose={() => setShowCreate(false)}
          onCreated={(order) => {
            setShowCreate(false);
            showMsg('success', `处方订单 ${order.order_no} 已创建，已流转至执业药师处理`);
            onChanged();
          }}
        />
      )}
      {showBatch && (
        <BatchProcessModal
          selectedIds={selected}
          orders={orders}
          user={user}
          dict={dict}
          onClose={() => setShowBatch(false)}
          onDone={() => {
            setShowBatch(false);
            setSelected([]);
            onChanged();
          }}
          onMessage={showMsg}
        />
      )}
    </div>
  );
};

export default OrderList;
