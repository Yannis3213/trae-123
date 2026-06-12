import React, { useState } from 'react';
import { CATEGORY_LABELS } from '../lib/auth';

export default function ActionModal({ action, doctors, onClose, onSubmit }) {
  const [form, setForm] = useState({
    comment: '',
    assignee_id: '',
    evidence_provided: '',
    exception_reason: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const payload = { ...form };
    if (payload.assignee_id) payload.assignee_id = Number(payload.assignee_id);
    setLoading(true);
    await onSubmit(action.action, payload);
    setLoading(false);
  };

  const needsAssignee = action.action === 'assign';
  const needsEvidence = action.requiresEvidence && action.requiresEvidence.length > 0;
  const needsReason = action.action === 'return_for_correction';

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{action.label}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
          操作后状态将从 <strong>{action.from || '当前状态'}</strong> 变更为 <strong>{action.toLabel}</strong>
        </div>

        {needsAssignee && (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="required">分派给兽医师</label>
            <select value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })}>
              <option value="">请选择兽医师</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {needsEvidence && (
          <>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>
                必填证据材料：
                {action.requiresEvidence.map(e => (
                  <span key={e} className="tag" style={{ marginLeft: 6 }}>{e}</span>
                ))}
              </label>
              <textarea
                value={form.evidence_provided}
                onChange={e => setForm({ ...form, evidence_provided: e.target.value })}
                placeholder="请列出已提供的证据材料，多个用逗号分隔"
              />
            </div>
          </>
        )}

        {needsReason && (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="required">退回原因（异常说明）</label>
            <textarea
              value={form.exception_reason}
              onChange={e => setForm({ ...form, exception_reason: e.target.value })}
              placeholder="请详细说明退回补正的原因，将作为异常原因留存"
            />
          </div>
        )}

        <div className="form-group">
          <label>处理备注</label>
          <textarea
            value={form.comment}
            onChange={e => setForm({ ...form, comment: e.target.value })}
            placeholder="请填写处理备注（可选）"
          />
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? '提交中...' : '确认提交'}
          </button>
        </div>
      </div>
    </div>
  );
}
