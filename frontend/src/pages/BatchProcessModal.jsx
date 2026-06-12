import { useState } from 'preact/hooks'
import { api } from '../api'
import { STATUS_NAMES, STATUS_COLORS } from '../types'

export default function BatchProcessModal({ config, store, onClose, onOpenDetail }) {
  const { items, label, to_status, action } = config
  const { showToast, refresh } = store
  const [form, setForm] = useState({
    remark: '',
    return_reason: '',
    rectify_notice: '',
    recheck_result: '',
    current_handler: '',
    attachments: []
  })
  const [newAttachment, setNewAttachment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState(null)

  const needReturnReason = to_status === 'returned'
  const needRectifyNotice = to_status === 'rectifying'
  const needRecheckResult = to_status === 'rechecking' || to_status === 'closed'
  const needHandler = to_status === 'assigned' || to_status === 'transferred'
  const needAttachments = ['rectifying', 'rechecking', 'revisited', 'closed'].includes(to_status)

  const addAttachmentLocal = () => {
    const name = newAttachment.trim()
    if (!name) return
    setForm(prev => ({
      ...prev,
      attachments: [...prev.attachments, name]
    }))
    setNewAttachment('')
  }

  const removeAttachment = (idx) => {
    setForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== idx)
    }))
  }

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
    if (needAttachments && form.attachments.length === 0) {
      showToast('请至少添加一份佐证材料', 'warning')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        items: items.map(it => ({
          id: it.id,
          page_status: it.status,
          version: it.version,
          evidence: [...form.attachments]
        })),
        action,
        to_status,
        remark: form.remark,
        return_reason: form.return_reason,
        rectify_notice: form.rectify_notice,
        recheck_result: form.recheck_result,
        current_handler: form.current_handler,
        attachments: form.attachments,
        evidence: [...form.attachments]
      }

      const res = await api.batchProcess(payload)
      if (res.success) {
        setResults(res.data)
        showToast(res.message, res.fail_count > 0 ? 'warning' : 'success')
        refresh()
      }
    } catch (e) {
      showToast(e.message || '批量处理失败', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const errorCodeDescriptions = {
    'version_conflict': '版本号不一致',
    'status_conflict': '状态不一致',
    'overdue_blocked': '已逾期',
    'role_permission': '角色无权限',
    'invalid_transition': '流转路径不合法',
    'missing_rectify_notice': '缺整改通知',
    'missing_recheck_result': '缺复查结果',
    'missing_return_reason': '缺退回原因',
    'missing_handler': '缺处理人',
    'missing_evidence': '缺佐证材料',
    'not_current_handler': '非当前处理人',
    'update_conflict': '更新冲突',
    'not_found': '单据不存在'
  }

  return (
    <div className="modal-mask batch-result-modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">📦 批量{label}（{items.length}条）</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {!results ? (
            <>
              <div style={{marginBottom: '16px', padding: '12px', background: '#eff6ff', borderRadius: '8px', fontSize: '13px'}}>
                <strong>目标状态：</strong>
                <span className="status-badge" style={{marginLeft: '8px', background: STATUS_COLORS[to_status] + '20', color: STATUS_COLORS[to_status]}}>
                  {STATUS_NAMES[to_status]}
                </span>
              </div>

              <div style={{marginBottom: '16px'}}>
                <div style={{fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px'}}>
                  涉及的隐患单（将逐条校验页面状态和版本）：
                </div>
                <div style={{maxHeight: '180px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px'}}>
                  {items.map(it => (
                    <div key={it.id} style={{padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <span style={{fontFamily: 'monospace', color: '#2563eb', minWidth: '130px'}}>{it.hazard_no}</span>
                      <span style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{it.title}</span>
                      <span className="status-badge" style={{background: STATUS_COLORS[it.status] + '20', color: STATUS_COLORS[it.status], fontSize: '11px'}}>
                        {STATUS_NAMES[it.status]}
                      </span>
                      <span style={{color: '#6b7280', fontSize: '12px'}}>v{it.version}</span>
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
                    placeholder="请输入处理人姓名，将统一设置"
                    value={form.current_handler}
                    onInput={e => setForm({...form, current_handler: e.target.value})}
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
                    onInput={e => setForm({...form, return_reason: e.target.value})}
                  />
                </div>
              )}

              {needRectifyNotice && (
                <div className="form-group">
                  <label className="form-label required">整改通知内容</label>
                  <textarea
                    className="textarea"
                    placeholder="请填写整改要求、整改时限等"
                    value={form.rectify_notice}
                    onInput={e => setForm({...form, rectify_notice: e.target.value})}
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
                    onInput={e => setForm({...form, recheck_result: e.target.value})}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  附件/佐证材料
                  {needAttachments && <span className="required-tag" style={{marginLeft: '8px', color: '#dc2626', fontSize: '12px'}}>* 必填</span>}
                </label>
                {form.attachments.length > 0 && (
                  <div style={{marginBottom: '8px'}}>
                    {form.attachments.map((name, idx) => (
                      <span key={idx} className="tag" style={{background: '#ecfdf5', color: '#059669', marginRight: '6px', marginBottom: '4px'}}>
                        📎 {name}
                        <button
                          style={{marginLeft: '6px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px'}}
                          onClick={() => removeAttachment(idx)}
                        >✕</button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{display: 'flex', gap: '8px'}}>
                  <input
                    type="text"
                    className="input"
                    style={{flex: 1}}
                    placeholder="输入附件/佐证名称..."
                    value={newAttachment}
                    onInput={e => setNewAttachment(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addAttachmentLocal()}
                  />
                  <button className="btn" onClick={addAttachmentLocal}>添加</button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">办理备注</label>
                <textarea
                  className="textarea"
                  placeholder="可选：本次批量处理的备注说明"
                  value={form.remark}
                  onInput={e => setForm({...form, remark: e.target.value})}
                />
              </div>

              <div style={{padding: '10px', background: '#fffbeb', borderRadius: '6px', fontSize: '12px', color: '#92400e', border: '1px solid #fde68a'}}>
                ⚠️ 系统将逐条校验：页面状态 vs 后端状态、版本号、角色权限、逾期状态、必填证据。
                状态冲突、版本不一致、已逾期未走退回、缺材料的单据将被<strong>保留原值</strong>并返回失败原因及补正责任人。
              </div>
            </>
          ) : (
            <>
              <div style={{marginBottom: '14px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '16px'}}>
                <span>批量处理结果：</span>
                <span style={{color: '#059669', fontWeight: '600'}}>
                  ✅ 成功 {results.filter(r => r.success).length}
                </span>
                <span style={{color: '#dc2626', fontWeight: '600'}}>
                  ❌ 失败 {results.filter(r => !r.success).length}
                </span>
              </div>
              <div className="result-list">
                {results.map(r => (
                  <div key={r.id} className={`result-item ${r.success ? 'success' : 'fail'}`}>
                    <div className={`result-icon ${r.success ? 'success' : 'fail'}`}>
                      {r.success ? '✓' : '✗'}
                    </div>
                    <div style={{minWidth: '130px', fontFamily: 'monospace', color: '#2563eb', fontSize: '12px'}}>
                      {r.hazard_no}
                    </div>
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={{fontWeight: '500', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        {r.title}
                      </div>
                      <div style={{fontSize: '12px', color: r.success ? '#059669' : '#dc2626', marginTop: '2px'}}>
                        {r.message}
                      </div>
                      {!r.success && (
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px 10px', marginTop: '4px', fontSize: '11px', color: '#6b7280'}}>
                          {r.error_code && (
                            <span>
                              错误码：<span style={{color: '#374151', fontWeight: '500'}}>{r.error_code}</span>
                              {errorCodeDescriptions[r.error_code] && `（${errorCodeDescriptions[r.error_code]}）`}
                            </span>
                          )}
                          {r.abnormal_category && (
                            <span>
                              分类：<span style={{color: '#dc2626', fontWeight: '500'}}>{r.abnormal_category}</span>
                            </span>
                          )}
                          {r.suggest_next_status_name && r.suggest_next_status !== r.from_status && (
                            <span>
                              建议状态：<span style={{color: '#2563eb', fontWeight: '500'}}>{r.suggest_next_status_name}</span>
                            </span>
                          )}
                          {r.fix_by_role_name && (
                            <span>
                              补正角色：<span style={{fontWeight: '500'}}>{r.fix_by_role_name}</span>
                            </span>
                          )}
                          {r.current_version && r.page_version && (
                            <span>
                              版本：页面 v{r.page_version} / 后端 v{r.current_version}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{minWidth: '100px', textAlign: 'right', fontSize: '12px'}}>
                      {r.from_status_name && r.to_status_name && r.success ? (
                        <span>{r.from_status_name} → {r.to_status_name}</span>
                      ) : r.from_status_name ? (
                        <span className="status-badge" style={{background: STATUS_COLORS[r.from_status] + '20', color: STATUS_COLORS[r.from_status]}}>
                          {r.from_status_name}
                        </span>
                      ) : null}
                    </div>
                    {!r.success && r.fix_by_name && (
                      <div style={{minWidth: '110px', textAlign: 'right', fontSize: '12px'}}>
                        <div style={{color: '#dc2626', fontWeight: '500'}}>补正：{r.fix_by_name}</div>
                      </div>
                    )}
                    {!r.success && onOpenDetail && r.hazard_id && (
                      <div style={{minWidth: '88px', textAlign: 'right'}}>
                        <button
                          className="btn btn-sm"
                          style={{
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            padding: '4px 10px',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                          onClick={() => onOpenDetail(r.hazard_id)}
                        >
                          🔧 详情补正
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{marginTop: '12px', padding: '10px', background: '#f9fafb', borderRadius: '6px', fontSize: '12px', color: '#6b7280'}}>
                💡 提示：失败的单据请根据补正责任人回到详情页处理后再批量推进。所有成功和失败都已记录到审计轨迹。
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
