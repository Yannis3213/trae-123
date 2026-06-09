import { h, useState } from 'preact';
import api from '../api.js';

export default function BatchModal({ user, selectedIds, records, onClose, onSuccess, showToast }) {
  const [action, setAction] = useState(user.role === 'supervisor' ? 'accept' : 'verify');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const actionLabel = action === 'accept' ? '批量接单审核通过' : '批量复核归档';
  const canAccept = user.role === 'supervisor';
  const canVerify = user.role === 'principal';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await api.batchHandle({
        record_ids: selectedIds,
        action,
        remark: remark || undefined
      });
      setResult(res);
      if (res.summary.failed === 0) {
        showToast(`${actionLabel}成功：${res.summary.success}条`, 'success');
      } else {
        showToast(`${actionLabel}完成：成功${res.summary.success}条，失败${res.summary.failed}条`, 'info');
      }
    } catch (err) {
      setError(err.message || '批量处理失败');
    } finally {
      setLoading(false);
    }
  };

  const selectedRecords = records.filter(r => selectedIds.includes(r.id));

  return (
    <div class="modal-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="modal">
        <div class="modal-header">
          <h3>批量处理晨检记录</h3>
          <button class="close" onClick={onClose}>×</button>
        </div>
        {!result ? (
          <form onSubmit={handleSubmit}>
            <div class="modal-body">
              <div class="form-row">
                <label>处理动作 <span class="required">*</span></label>
                <select value={action} onInput={(e) => setAction(e.target.value)}>
                  {canAccept && <option value="accept">批量接单审核通过（主管）</option>}
                  {canVerify && <option value="verify">批量复核归档（园长）</option>}
                </select>
              </div>
              <div class="form-row">
                <label>备注</label>
                <textarea value={remark} onInput={(e) => setRemark(e.target.value)}
                  placeholder="批量处理备注（可选）" />
                <div class="hint">
                  ⚠️ 异常记录、已逾期记录、非当前处理人、状态不匹配的记录将被逐条拦截，不会整批放行
                </div>
              </div>
              <div style={{ padding: 10, background: '#fafafa', borderRadius: 4, fontSize: 12, maxHeight: 180, overflowY: 'auto' }}>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>已选择 {selectedIds.length} 条记录：</div>
                {selectedRecords.map(r => (
                  <div key={r.id} style={{ padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                    {r.child_name}（{r.class_name} / {r.check_date}）—
                    <span class={`badge badge-${r.status}`} style={{ margin: '0 6px' }}>{r.status_name}</span>
                    {r.health_status === 'abnormal' && <span class="tag-abnormal">异常</span>}
                    <span class={`deadline-badge deadline-${r.deadline_status}`} style={{ marginLeft: 4 }}>
                      {r.deadline_status === 'normal' ? '正常' : r.deadline_status === 'warning' ? '临期' : '逾期'}
                    </span>
                  </div>
                ))}
              </div>
              {error && <div style={{ color: '#f5222d', fontSize: 13, marginTop: 10 }}>{error}</div>}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn" onClick={onClose} disabled={loading}>取消</button>
              <button type="submit" class="btn btn-primary" disabled={loading}>
                {loading ? '处理中...' : '确认批量处理'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div class="modal-body">
              <div class="batch-result">
                <div class="summary">
                  共 {result.summary.total} 条：成功
                  <span style={{ color: '#52c41a', margin: '0 4px' }}>{result.summary.success}</span>
                  条，失败
                  <span style={{ color: '#f5222d', margin: '0 4px' }}>{result.summary.failed}</span>
                  条
                </div>
                {result.results.map(r => {
                  const rec = selectedRecords.find(x => x.id === r.id);
                  return (
                    <div key={r.id} class={`item ${r.success ? 'success' : 'failed'}`}>
                      <div>
                        <span class="id">{r.id.slice(0, 8)}</span>
                        {rec && <span style={{ marginLeft: 6 }}>{rec.child_name}（{rec.check_date}）</span>}
                        {r.success ? (
                          <span style={{ marginLeft: 8, color: '#52c41a', fontWeight: 500 }}>
                            ✓ 成功 → {r.new_status_name}
                          </span>
                        ) : (
                          <span style={{ marginLeft: 8, color: '#f5222d', fontWeight: 500 }}>✗ 失败</span>
                        )}
                      </div>
                      {!r.success && <div style={{ fontSize: 11, marginTop: 2 }}>{r.reason}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-primary" onClick={onSuccess}>完成并刷新列表</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
