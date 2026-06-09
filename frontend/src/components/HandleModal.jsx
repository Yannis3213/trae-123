import { h, useState } from 'preact';
import api from '../api.js';

const ACTION_TITLES = {
  accept: '接单审核通过',
  reject: '退回处理',
  correction_submit: '补正并提交',
  verify: '复核通过并归档',
  correction_accept: '补正通过'
};

export default function HandleModal({ record, action, user, onClose, onSuccess, showToast }) {
  const [form, setForm] = useState({
    correction_reason: '',
    reject_reason: '',
    remark: '',
    audit_note: ''
  });
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isReject = action === 'reject';
  const isCorrection = action === 'correction_submit';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isReject && !form.reject_reason.trim()) {
      setError('退回意见必填');
      return;
    }
    if (isCorrection && !form.correction_reason.trim()) {
      setError('补正原因必填');
      return;
    }

    const payload = {
      action,
      version: record.version,
      correction_reason: form.correction_reason || undefined,
      reject_reason: form.reject_reason || undefined,
      remark: form.remark || undefined,
      audit_note: form.audit_note || undefined,
      attachments: attachments.filter(a => a.name && a.type)
    };

    setLoading(true);
    try {
      await api.handleRecord(record.id, payload);
      showToast(`${ACTION_TITLES[action] || '处理'}成功`, 'success');
      onSuccess();
    } catch (err) {
      setError(err.message || '处理失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="modal-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="modal">
        <div class="modal-header">
          <h3>{ACTION_TITLES[action] || '处理记录'}</h3>
          <button class="close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div class="modal-body">
            <div style={{ padding: 10, background: '#f5f5f5', borderRadius: 4, marginBottom: 14, fontSize: 13 }}>
              <div>单据：{record.child ? record.child.name : ''} | {record.check_date} | 版本 v{record.version}</div>
              <div>当前状态：<span class={`badge badge-${record.status}`}>{record.status_name}</span></div>
              {record.health_status === 'abnormal' && (
                <div style={{ marginTop: 4, color: '#f5222d' }}>⚠️ 异常记录，仅支持补正或退回</div>
              )}
            </div>

            {isCorrection && (
              <div class="form-row">
                <label>补正原因 <span class="required">*</span></label>
                <textarea value={form.correction_reason}
                  onInput={(e) => setForm({ ...form, correction_reason: e.target.value })}
                  placeholder="请说明本次补正的具体内容" />
              </div>
            )}

            {isReject && (
              <div class="form-row">
                <label>退回意见 <span class="required">*</span></label>
                <textarea value={form.reject_reason}
                  onInput={(e) => setForm({ ...form, reject_reason: e.target.value })}
                  placeholder="请说明退回原因及要求" />
              </div>
            )}

            {isCorrection && (
              <>
                <h4 style={{ fontSize: 13, marginBottom: 8 }}>补充证据</h4>
                {attachments.map((a, idx) => (
                  <div key={idx} style={{ padding: 8, marginBottom: 8, background: '#fafafa', borderRadius: 4 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <select value={a.type} style={{ flex: 1, padding: 4 }}
                        onInput={(e) => {
                          const next = [...attachments];
                          next[idx] = { ...a, type: e.target.value };
                          setAttachments(next);
                        }}>
                        <option value="registration">晨检登记</option>
                        <option value="child_profile">幼儿档案</option>
                        <option value="abnormal_notice">异常通知</option>
                      </select>
                      <button type="button" class="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}>删除</button>
                    </div>
                    <input placeholder="证据名称" value={a.name} style={{ width: '100%', padding: 4, marginBottom: 4 }}
                      onInput={(e) => {
                        const next = [...attachments];
                        next[idx] = { ...a, name: e.target.value };
                        setAttachments(next);
                      }} />
                    <textarea placeholder="证据内容描述" value={a.content} style={{ width: '100%', padding: 4, minHeight: 40 }}
                      onInput={(e) => {
                        const next = [...attachments];
                        next[idx] = { ...a, content: e.target.value };
                        setAttachments(next);
                      }} />
                  </div>
                ))}
                <button type="button" class="btn" style={{ marginBottom: 12 }}
                  onClick={() => setAttachments([...attachments, { type: 'registration', name: '', content: '' }])}>
                  + 添加补充证据
                </button>
              </>
            )}

            <div class="form-row">
              <label>处理备注</label>
              <textarea value={form.remark} onInput={(e) => setForm({ ...form, remark: e.target.value })}
                placeholder="备注信息（可选）" />
            </div>

            <div class="form-row">
              <label>审计备注</label>
              <textarea value={form.audit_note} onInput={(e) => setForm({ ...form, audit_note: e.target.value })}
                placeholder="审计备注将独立保存（可选）" />
              <div class="hint">版本 v{record.version} 将被用于乐观锁校验，若记录已被他人更新将被拦截</div>
            </div>

            {error && <div style={{ color: '#f5222d', fontSize: 13, marginTop: 6 }}>{error}</div>}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" onClick={onClose} disabled={loading}>取消</button>
            <button type="submit" class={`btn ${isReject ? 'btn-danger' : isCorrection ? 'btn-warning' : 'btn-success'}`} disabled={loading}>
              {loading ? '提交中...' : '确认提交'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
