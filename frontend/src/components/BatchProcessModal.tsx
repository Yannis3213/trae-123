import React, { useState, useMemo } from 'react';
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
  const [abnormalType, setAbnormalType] = useState('');
  const [abnormalReason, setAbnormalReason] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
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
    return Array.from(merged);
  }, [selectedOrders, dict]);

  const isAbnormalTarget = ['material_shortage', 'overdue', 'abnormal_return', 'returned_correction'].includes(toStatus);

  const handleSubmit = async () => {
    if (!toStatus) { onMessage('error', '请选择目标状态'); return; }
    if (isAbnormalTarget && !abnormalType && !abnormalReason) {
      onMessage('warning', '建议填写异常类型和原因，便于后续追溯');
    }
    setSubmitting(true);
    const versionMap: Record<string, number> = {};
    selectedOrders.forEach(o => { versionMap[o.id] = o.version; });
    const r = await api.batchProcess({
      ids: selectedIds,
      to_status: toStatus,
      version_map: versionMap,
      note,
      abnormal_type: abnormalType || undefined,
      abnormal_reason: abnormalReason || undefined,
      correction_note: correctionNote || undefined
    });
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
                当前角色：<b>{user.roleName}</b>。批量处理逐条校验「角色 → 当前处理人 → 状态机 → 版本号 → 必需证据」，失败会在结果中给出具体原因。
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>订单号</th><th>患者</th><th>当前状态</th><th>版本</th><th>当前处理人</th><th>预警</th></tr>
                </thead>
                <tbody>
                  {selectedOrders.map(o => (
                    <tr key={o.id}>
                      <td style={{ fontFamily: 'monospace' }}>{o.order_no}</td>
                      <td>{o.patient_name}</td>
                      <td><span className={`tag status-${o.status}`}>{o.statusName}</span></td>
                      <td>v{o.version}</td>
                      <td>{o.handler_name || '-'}</td>
                      <td><span className={`tag warning-${o.warningLevel}`}>{o.warningName}</span></td>
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
              {isAbnormalTarget && (
                <div className="form-row">
                  <div className="form-group">
                    <label>异常类型</label>
                    <select value={abnormalType} onChange={e => setAbnormalType(e.target.value)}>
                      <option value="">不额外指定（自动按目标状态推导）</option>
                      {dict?.abnormalTypes.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>异常原因</label>
                    <input value={abnormalReason} onChange={e => setAbnormalReason(e.target.value)} placeholder="建议填写，便于追溯" />
                  </div>
                </div>
              )}
              {toStatus === 'returned_correction' && (
                <div className="form-group">
                  <label>补正要求</label>
                  <textarea value={correctionNote} onChange={e => setCorrectionNote(e.target.value)} placeholder="请描述需要门店/处理人补正的具体要求" />
                </div>
              )}
            </>
          ) : (
            <>
              <div className={`alert ${results.every(r => r.success) ? 'success' : results.some(r => r.success) ? 'warning' : 'error'}`}>
                批量处理完成：成功 <b>{results.filter(r => r.success).length}</b> 条，
                失败 <b>{results.filter(r => !r.success).length}</b> 条（共 {results.length} 条）
              </div>
              <div className="batch-result-list">
                {results.map((r, i) => (
                  <div key={i} className="batch-result-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        <span className="no">{r.order_no || r.id}</span>
                        <span style={{ marginLeft: 10, color: r.success ? '#065f46' : '#991b1b', fontWeight: 600 }}>
                          {r.success ? '✓ 成功' : '✗ 失败'}
                        </span>
                        {r.error_code && (
                          <span className="tag" style={{ marginLeft: 8, background: '#fee2e2', color: '#991b1b', fontSize: 11 }}>
                            {r.error_code}
                          </span>
                        )}
                      </span>
                      <span style={{ color: '#4b5563', flexShrink: 0, textAlign: 'right' }}>{r.message}</span>
                    </div>
                    {!r.success && (r.handler_name || r.current_version || r.current_status_name || r.correction_note) && (
                      <div style={{ fontSize: 12, color: '#6b7280', paddingLeft: 22 }}>
                        <div>
                          {r.handler_name && <span style={{ marginRight: 12 }}>当前处理人：{r.handler_name}</span>}
                          {r.current_version !== undefined && <span style={{ marginRight: 12 }}>当前版本：v{r.current_version}</span>}
                          {r.current_status_name && <span>当前状态：{r.current_status_name}</span>}
                        </div>
                        {r.correction_note && (
                          <div style={{ marginTop: 4, color: '#92400e', background: '#fef3c7', padding: '4px 8px', borderRadius: 4 }}>
                            💡 {r.correction_note}
                          </div>
                        )}
                      </div>
                    )}
                    {r.success && (r.new_version !== undefined || r.handler_name || r.status_name) && (
                      <div style={{ fontSize: 12, color: '#065f46', paddingLeft: 22 }}>
                        {r.new_version !== undefined && <span style={{ marginRight: 12 }}>新版本：v{r.new_version}</span>}
                        {r.status_name && <span style={{ marginRight: 12 }}>新状态：{r.status_name}</span>}
                        {r.handler_name && <span>下一处理人：{r.handler_name}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn secondary" onClick={results ? onDone : onClose}>
            {results ? '完成并刷新列表' : '取消'}
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
