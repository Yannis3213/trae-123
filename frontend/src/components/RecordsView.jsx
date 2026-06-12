import React, { useState, useEffect } from 'react';
import { recordsApi } from '../lib/api';
import { formatDate, STATUS_LABELS, EXCEPTION_LABELS } from '../lib/auth';

export default function RecordsView() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await recordsApi.list({ page_size: 200 });
      if (res.success) setRecords(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="card">
      <div className="card-title"><span>📝 全部处理记录</span></div>
      {loading && <div className="empty">加载中...</div>}
      {!loading && records.length === 0 && <div className="empty">暂无记录</div>}
      {records.length > 0 && (
        <div className="timeline">
          {records.map(r => (
            <div key={r.id} className="timeline-item">
              <div className="time">{formatDate(r.created_at)}</div>
              <div className="meta">
                <span className="badge" style={{ background: '#eff6ff', color: '#2563eb' }}>
                  {r.operator_name}
                </span>
                <a href={`/detail/${r.visit_order_id}`}>{r.order_no} · {r.pet_name}</a>
                {r.from_status && (
                  <span style={{ color: '#64748b' }}>
                    {STATUS_LABELS[r.from_status]} → <strong>{STATUS_LABELS[r.to_status]}</strong>
                  </span>
                )}
                {r.exceptionTypeLabel && (
                  <span className="exception-tag">{EXCEPTION_LABELS[r.exception_type]}</span>
                )}
              </div>
              <div>{r.comment}</div>
              {r.exception_reason && (
                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>异常：{r.exception_reason}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
