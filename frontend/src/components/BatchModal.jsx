import React, { useState } from 'react';

export default function BatchModal({ ids, actions, doctors, onClose, onSubmit }) {
  const [action, setAction] = useState(actions[0]?.key || '');
  const [payload, setPayload] = useState({});
  const [loading, setLoading] = useState(false);

  const currentAction = actions.find(a => a.key === action);

  const handleSubmit = async () => {
    if (!action) return;
    setLoading(true);
    await onSubmit(action, payload);
    setLoading(false);
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>批量处理（已选 {ids.length} 条）</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="required">选择操作</label>
          <select value={action} onChange={(e) => { setAction(e.target.value); setPayload({}); }}>
            {actions.map(a => (
              <option key={a.key} value={a.key}>{a.label}</option>
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

        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, fontSize: 13, color: '#64748b' }}>
          ⚠️ 批量操作将逐条执行，每条单据可能因状态、权限或材料问题失败，提交后请查看返回结果中的成功/失败详情。
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? '处理中...' : '确认提交'}
          </button>
        </div>
      </div>
    </div>
  );
}
