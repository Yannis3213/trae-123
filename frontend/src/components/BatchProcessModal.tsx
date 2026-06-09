import React, { useState, useEffect, useMemo } from 'react';
import { api, type User, type DictItem, type PrescriptionOrder, type BatchResult } from '../lib/api';

interface Props {
  selectedIds: string[];
  orders: PrescriptionOrder[];
  user: User;
  dict: {
    roles: DictItem[];
    statuses: DictItem[];
    abnormalTypes: DictItem[];
    warningLevels: DictItem[];
    transitions: Record<string, string[]>;
  } | null;
  onClose: () => void;
  onDone: () => void;
  onMessage: (type: string, text: string) => void;
}

const BatchProcessModal: React.FC<Props> = ({ selectedIds, orders, user, dict, onClose, onDone, onMessage }) => {
  const [toStatus, setToStatus] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<BatchResult[] | null>(null);

  const selectedOrders = useMemo(() => orders.filter(o => selectedIds.includes(o.id)), [selectedIds, orders]);

  const allowedTargets = useMemo(() => {
    const transitions = dict?.transitions || {};
    const merged = new Set<string>();
    selectedOrders.forEach(o => {
      const list = transitions[o.status] || [];
      list.forEach(s => merged.add(s));
    });
    if (user.role === 'area_manager') {
      selectedOrders.forEach(o => {
        if (o.status === 'signed') merged.add('signed');
      });
    }
    return Array.from(merged);
  }, [selectedOrders, dict, user]);

  const handleSubmit = async () => {
    if (!toStatus) { onMessage('error', '请选择目标状态'); return; }
    setSubmitting(true);
    const versionMap: Record<string, number> = {};
    selectedOrders.forEach(o => { versionMap[o.id] = o.version; });
    const r = await api.batchProcess({ ids: selectedIds, to_status: toStatus, version_map: versionMap, note });
    setSubmitting(false);
    if (r.code === 0 && r.data) {
      setResults(r.data.results);
    } else {
      onMessage('error', r.message || '批量处理失败');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>批量处理处方订单（{selectedIds.length} 条）</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {!results ? (
            <>
              <div className="alert info">
              当前角色：<b>{user.roleName}</b>。批量处理将逐条校验权限、状态、版本和证据，失败会给出具体原因。
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>订单号</th><th>患者</th><th>当前状态</th><th>版本</th><th>当前处理人</th></tr>
                </thead>
                <tbody>
                  {selectedOrders.map(o => (
                    <tr key={o.id}>
                      <td style={{ fontFamily: 'monospace' }}>{o.order_no}</td>
                      <td>{o.patient_name}</td>
                      <td><span className={`tag status-${o.status}`}>{o.statusName}</span></td>
                      <td>v{o.version}</td>
                      <td>{o.handler_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="form-row" style={{ marginTop: 14 }}>
                <div className="form-group">
                  <label><span className="required">*</span>目标状态</label>
                  <select value={toStatus} onChange={e => setToStatus(e.target.value)}>
                    <option value="">请选择目标状态</option>
                    {dict?.statuses.filter(s => allowedTargets.includes(s.value)).map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>备注</label>
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder="可选" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={`alert ${results.every(r => r.success) ? 'success' : results.some(r => r.success) ? 'warning' : 'error'}`}>
                批量处理完成：成功 {results.filter(r => r.success).length} 条，失败 {results.filter(r => !r.success).length} 条
              </div>
              <div className="batch-result-list">
                {results.map((r, i) => (
                  <div key={i} className="batch-result-row">
                    <span>
                      <span className="no">{r.order_no || r.id}</span>
                      <span style={{ marginLeft: 10, color: r.success ? '#065f46' : '#991b1b' }}>
                        {r.success ? '✓ 成功' : '✗ 失败'}
                      </span>
                    </span>
                    <span style={{ color: '#4b5563' }}>{r.message}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn secondary" onClick={results ? onDone : onClose}>
            {results ? '完成' : '取消'}
          </button>
          {!results && (
            <button className="btn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '处理中...' : '确定批量处理'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchProcessModal;
