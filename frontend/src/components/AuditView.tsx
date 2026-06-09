import React, { useState, useEffect } from 'react';
import { api, type User, type DictItem } from '../lib/api';

interface Props {
  user: User;
  dict: {
    roles: DictItem[];
    statuses: DictItem[];
    abnormalTypes: DictItem[];
    warningLevels: DictItem[];
    transitions: Record<string, string[]>;
  } | null;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { hour12: false });
};

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  view: '查看',
  update_status: '状态变更',
  batch_update: '批量处理',
  upload_attachment: '上传附件',
  review: '复核通过',
  return_correction: '退回补正'
};

const AuditView: React.FC<Props> = ({ user }) => {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await api.listAudit({ limit: 100 });
      setLoading(false);
      if (r.code === 0 && r.data) setList(r.data);
    })();
  }, []);

  return (
    <div className="card">
      <h3>{user.role === 'area_manager' ? '审计轨迹' : '操作记录'}（最近 100 条）</h3>
      {loading ? (
        <div className="empty">加载中...</div>
      ) : list.length === 0 ? (
        <div className="empty">暂无记录</div>
      ) : (
        <ul className="timeline">
          {list.map(a => (
            <li key={a.id}>
              <div className="time">{formatTime(a.created_at)}</div>
              <div className="title">
                <span className={`tag role-${a.operator_role}`}>{a.operator_name}</span>
                <span style={{ marginLeft: 6 }}>
                  <b>{ACTION_LABELS[a.action] || a.action}</b>
                </span>
                <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 6 }}>
                  订单 {a.order_id?.slice(0, 8)}…（v{a.order_version}）
                </span>
              </div>
              {a.content && <div className="note">{a.content}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AuditView;
