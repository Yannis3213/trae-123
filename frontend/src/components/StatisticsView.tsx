import React, { useState, useEffect, useMemo } from 'react';
import { api, type User, type DictItem, type PrescriptionOrder } from '../lib/api';
import OrderDetail from './OrderDetail';

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

const hoursLeft = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60));
};

const StatisticsView: React.FC<Props> = ({ user, dict, onChanged }) => {
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<PrescriptionOrder[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);

  const load = async () => {
    const [r1, r2] = await Promise.all([api.getStatistics(), api.listOrders()]);
    if (r1.code === 0 && r1.data) setStats(r1.data);
    if (r2.code === 0 && r2.data) setOrders(r2.data);
  };

  useEffect(() => { load(); }, []);

  const showMsg = (type: string, text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  };

  const filteredOrders = useMemo(() => {
    if (!filter) return orders;
    return orders.filter(o => o.warningLevel === filter);
  }, [orders, filter]);

  const byWarning = stats?.byWarning || [];
  const normalCount = byWarning.find((w: any) => w.level === 'normal')?.count || 0;
  const approachingCount = byWarning.find((w: any) => w.level === 'approaching')?.count || 0;
  const overdueCount = byWarning.find((w: any) => w.level === 'overdue')?.count || 0;

  return (
    <div>
      {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

      <div className="warning-banner">
        <div className="wb-card normal" onClick={() => setFilter('normal')} style={{ cursor: 'pointer' }}>
          <div className="wb-title">正常（24小时以上）</div>
          <div className="wb-count">{normalCount}</div>
        </div>
        <div className="wb-card approaching" onClick={() => setFilter('approaching')} style={{ cursor: 'pointer' }}>
          <div className="wb-title">临期（24小时内到期）</div>
          <div className="wb-count">{approachingCount}</div>
        </div>
        <div className="wb-card overdue" onClick={() => setFilter('overdue')} style={{ cursor: 'pointer' }}>
          <div className="wb-title">逾期（已超期）</div>
          <div className="wb-count">{overdueCount}</div>
        </div>
        <div className="wb-card normal" style={{ borderLeftColor: '#2e5b8a', cursor: 'pointer' }} onClick={() => setFilter('')}>
          <div className="wb-title">全部（{filter ? '点击清空筛选' : '显示所有'}）</div>
          <div className="wb-count">{orders.length}</div>
        </div>
      </div>

      <div className="card">
        <h3>{filter ? `${dict?.warningLevels.find(w => w.value === filter)?.label}队列` : '到期预警列表'}（{filteredOrders.length}）</h3>
        {filteredOrders.length === 0 ? (
          <div className="empty">暂无数据</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>预警</th>
                <th>订单号</th>
                <th>患者</th>
                <th>门店</th>
                <th>当前状态</th>
                <th>剩余/超期</th>
                <th>到期时间</th>
                <th>当前处理人</th>
                <th>责任人</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders
                .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
                .map(o => (
                  <tr key={o.id}>
                    <td><span className={`tag warning-${o.warningLevel}`}>{o.warningName}</span></td>
                    <td style={{ fontFamily: 'monospace' }}>{o.order_no}</td>
                    <td>{o.patient_name}</td>
                    <td>{o.store_name}</td>
                    <td><span className={`tag status-${o.status}`}>{o.statusName}</span></td>
                    <td>
                      {o.warningLevel === 'overdue'
                        ? <span style={{ color: '#991b1b', fontWeight: 600 }}>已超期 {Math.abs(hoursLeft(o.due_at))} 小时</span>
                        : <span style={{ color: o.warningLevel === 'approaching' ? '#92400e' : '#065f46' }}>
                            剩余 {hoursLeft(o.due_at)} 小时
                          </span>}
                    </td>
                    <td>{formatTime(o.due_at)}</td>
                    <td>{o.handler_name || '-'}</td>
                    <td>
                      {o.handler_name ? (
                        <span className={`tag role-${o.handler_role}`}>{o.handler_name}</span>
                      ) : <span style={{ color: '#9ca3af' }}>未指定</span>}
                    </td>
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
          onClose={() => { setDetailId(null); onChanged(); load(); }}
          onMessage={showMsg}
        />
      )}
    </div>
  );
};

export default StatisticsView;
