import { useState } from 'preact/hooks'
import { api } from '../api'
import { STATUS, STATUS_NAMES, ROLES } from '../types'

export default function BatchProcessModal({ config, store, onClose }) {
  const { ids, label, toStatus, action } = config
  const { currentUser, showToast, refresh, hazards } = store
  const [form, setForm] = useState({
    remark: '',
    return_reason: '',
    rectify_notice: '',
    recheck_result: '',
    current_handler: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState(null)

  const selectedHazards = hazards.filter(h => ids.includes(h.id))

  const needReturnReason = [STATUS.RETURNED].includes(toStatus)
  const needRectifyNotice = toStatus === STATUS.RECTIFYING
  const needRecheckResult = [STATUS.RECHECKING, STATUS.CLOSED].includes(toStatus)
  const needHandler = [STATUS.ASSIGNED, STATUS.TRANSFERRED].includes(toStatus)

  const handleSubmit = async () => {
    if (needReturnReason && !form.return_reason.trim()) {
      showToast('请填写退回原因', 'warning')
      return
    }
    if (needRectifyNotice && !form.rectify_notice.trim()) {
      showToast('请填写整改通知内容', 'warning')
      return
    }
    if (needRecheckResult && !form.recheck_result.trim()) {
      showToast('请填写复查结果', 'warning')
      return
    }
    if (needHandler && !form.current_handler.trim()) {
      showToast('请指定处理人', 'warning')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.batchProcess({
        ids,
        action,
        to_status: toStatus,
        ...form
      })
      if (res.success) {
        setResults(res.data)
        showToast(res.message, res.fail_count > 0 ? 'warning' : 'success')
        refresh()
      } else {
        showToast(res.message || '批量处理失败', 'error')
      }
    } catch (e) {
      showToast(e.message || '批量处理失败', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-mask batch-result-modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">📦 批量{label}（{ids.length}条）</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {!results ? (
            <>
              <div style={{marginBottom: '16px', padding: '12px', background: '#eff6ff', borderRadius: '8px', fontSize: '13px'}}>
                <strong>目标状态：</strong>{STATUS_NAMES[toStatus]}<br/>
                <strong>当前角色：</strong>{currentUser.roleName}<br/>
                <strong>处理数量：</strong>{ids.length} 条隐患单
              </div>

              <div style={{marginBottom: '16px'}}>
                <div style={{fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px'}}>涉及的隐患单：</div>
                <div style={{maxHeight: '140px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px'}}>
                  {selectedHazards.map(h => (
                    <div key={h.id} style={{padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontSize: '13px'}}>
                      <span style={{fontFamily: 'monospace', color: '#2563eb'}}>{h.hazard_no}</span>
                      <span style={{margin: '0 10px', color: '#6b7280'}}>|</span>
                      <span>{h.title}</span>
                      <span style={{margin: '0 10px', color: '#6b7280'}}>|</span>
                      <span style={{color: STATUS_NAMES[h.status] ? '#6b7280' : '#6b7280'}}>{STATUS_NAMES[h.status]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {needHandler && (
                <div className="form-group">
                  <label className="form-label required">指定处理人</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="请输入处理人姓名"
                    value={form.current_handler}
                    onChange={e => setForm({...form, current_handler: e.target.value})}
                  />
                </div>
              )}

              {needReturnReason && (
                <div className="form-group">
                  <label className="form-label required">退回原因</label>
                  <textarea
                    className="textarea"
                    placeholder="请说明退回补正的原因，将逐条应用"
                    value={form.return_reason}
                    onChange={e => setForm({...form, return_reason: e.target.value})}
                  />
                </div>
              )}

              {needRectifyNotice && (
                <div className="form-group">
                  <label className="form-label required">整改通知内容</label>
                  <textarea
                    className="textarea"
                    placeholder="请填写整改要求、整改时限等内容"
                    value={form.rectify_notice}
                    onChange={e => setForm({...form, rectify_notice: e.target.value})}
                  />
                </div>
              )}

              {needRecheckResult && (
                <div className="form-group">
                  <label className="form-label required">复查结果</label>
                  <textarea
                    className="textarea"
                    placeholder="请填写现场复查情况"
                    value={form.recheck_result}
                    onChange={e => setForm({...form, recheck_result: e.target.value})}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">办理备注</label>
                <textarea
                  className="textarea"
                  placeholder="可选：本次批量处理的备注说明"
                  value={form.remark}
                  onChange={e => setForm({...form, remark: e.target.value})}
                />
              </div>

              <div style={{padding: '10px', background: '#fffbeb', borderRadius: '6px', fontSize: '12px', color: '#92400e', border: '1px solid #fde68a'}}>
                ⚠️ 系统将逐条校验：当前状态、角色权限、版本号、逾期状态等。
                状态冲突、已逾期（未走退回补正）、缺证据的单据将被拦截并保留原值，请根据结果补正后重试。
              </div>
            </>
          ) : (
            <>
              <div style={{marginBottom: '14px', fontSize: '14px'}}>
                批量处理完成：
                <span style={{color: '#059669', fontWeight: '600', marginLeft: '6px'}}>成功 {results.filter(r => r.success).length}</span>
                <span style={{margin: '0 8px', color: '#9ca3af'}}>|</span>
                <span style={{color: '#dc2626', fontWeight: '600'}}>失败 {results.filter(r => !r.success).length}</span>
              </div>
              <div className="result-list">
                {results.map(r => {
                  const h = selectedHazards.find(x => x.id === r.ID) || {}
                  return (
                    <div key={r.ID} className={`result-item ${r.Success ? 'success' : 'fail'}`}>
                      <div className={`result-icon ${r.Success ? 'success' : 'fail'}`}>
                        {r.Success ? '✓' : '✗'}
                      </div>
                      <div className="result-id">{h.hazard_no || ('#' + r.ID)}</div>
                      <div className="result-msg" style={{flex: 1}}>
                        {r.Success ? (
                          <span style={{color: '#059669'}}>处理成功</span>
                        ) : (
                          <span>❌ {r.Message}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={submitting}>
            {results ? '关闭' : '取消'}
          </button>
          {!results && (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '处理中...' : `确认批量${label}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
