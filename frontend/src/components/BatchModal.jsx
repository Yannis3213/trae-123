import React, { useState } from 'react';
import { STATUS_LABELS, EXCEPTION_LABELS } from '../lib/auth';

export default function BatchModal({ ids, actions, doctors, onClose, onSubmit }) {
  const [action, setAction] = useState(actions[0]?.key || '');
  const [payload, setPayload] = useState({});
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const currentAction = actions.find(a => a.key === action);

  const handleSubmit = async () => {
    if (!action) return;
    setLoading(true);
    try {
      const res = await onSubmit(action, payload);
      if (res && res.results) {
        setResults(res);
      }
    } catch (err) {
      // handled by parent
    }
    setLoading(false);
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: results ? 700 : 500 }}>
        <div className="modal-header">
          <h3>批量处理（已选 {ids.length} 条）</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {!results && (
          <>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="required">选择操作</label>
              <select value={action} onChange={(e) => { setAction(e.target.value); setPayload({}); }}>
                {actions.map(a => (
                  <option key={a.key} value={a.key}>
                    {a.isOverdueAction ? '⚠️ ' : ''}{a.label}
                  </option>
                ))}
              </select>
            </div>

            {currentAction?.needPayload && currentAction.payloadField === 'assignee_id' && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="required">{currentAction.labelField}</label>
                <select
                  value={payload.assignee_id || ''}
                  onChange={(e) => setPayload({ ...payload, assignee_id: Number(e.target.value) })}
                >
                  <option value="">请选择兽医师</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {currentAction?.needPayload && currentAction.payloadField === 'evidence_provided' && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>{currentAction.labelField}</label>
                <textarea
                  value={payload.evidence_provided || ''}
                  onChange={(e) => setPayload({ ...payload, evidence_provided: e.target.value })}
                  placeholder="请输入已提供的证据材料，多个用逗号分隔"
                />
              </div>
            )}

            {currentAction?.needPayload && currentAction.payloadField === 'exception_reason' && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="required">{currentAction.labelField}</label>
                <textarea
                  value={payload.exception_reason || ''}
                  onChange={(e) => setPayload({ ...payload, exception_reason: e.target.value })}
                  placeholder="请输入退回原因"
                />
              </div>
            )}

            {currentAction?.needPayload && currentAction.payloadField === 'correction_action' && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="required">{currentAction.labelField}</label>
                <textarea
                  value={payload.correction_action || ''}
                  onChange={(e) => setPayload({ ...payload, correction_action: e.target.value })}
                  placeholder="请说明补正动作，如：补充XX材料、电话确认XX执行情况"
                />
              </div>
            )}

            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, fontSize: 13, color: '#64748b' }}>
              ⚠️ 批量操作将逐条执行，每条单据可能因状态、权限或材料问题失败，提交后请查看返回结果中的成功/失败详情。
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={onClose}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? '处理中...' : '确认提交'}
              </button>
            </div>
          </>
        )}

        {results && (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, color: '#16a34a' }}>✅ 成功：{results.successCount} 条</div>
              <div style={{ fontWeight: 600, color: '#dc2626' }}>❌ 失败：{results.failCount} 条</div>
              <div style={{ color: '#64748b' }}>总计：{results.total} 条</div>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>单号</th>
                    <th>结果</th>
                    <th>状态变更</th>
                    <th>异常类型</th>
                    <th>详情/原因</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r, i) => (
                    <tr key={i} style={!r.success ? { background: '#fef2f2' } : {}}>
                      <td style={{ fontSize: 12 }}>{r.order_no || r.id}</td>
                      <td>
                        <span className="badge" style={{
                          background: r.success ? '#dcfce7' : '#fee2e2',
                          color: r.success ? '#166534' : '#991b1b',
                          fontSize: 11
                        }}>
                          {r.success ? '成功' : '失败'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {r.success
                          ? `${STATUS_LABELS[r.from] || r.from || '-'} → ${STATUS_LABELS[r.to] || r.to || '-'}`
                          : (r.currentStatusLabel || '-')
                        }
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {r.exceptionType ? EXCEPTION_LABELS[r.exceptionType] || r.exceptionType : '-'}
                      </td>
                      <td style={{ fontSize: 11, color: r.success ? '#16a34a' : '#dc2626', maxWidth: 220, wordBreak: 'break-all' }}>
                        {r.success ? (r.correctionAction || r.message) : (r.reason || r.message)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={onClose}>确认关闭</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
