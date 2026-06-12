import { useState, useEffect } from 'preact/hooks'
import { api } from '../api'
import { STATUS, STATUS_NAMES, STATUS_COLORS, PRIORITY_NAMES, PRIORITY_COLORS, WARNING_NAMES, WARNING_COLORS, ROLES, ROLE_NAMES } from '../types'
import { formatDate, daysUntil } from '../utils'

export default function HazardDetail({ id, store, onClose }) {
  const { currentUser, showToast, refresh } = store
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [processForm, setProcessForm] = useState({
    to_status: '',
    page_status: '',
    remark: '',
    return_reason: '',
    rectify_notice: '',
    recheck_result: '',
    current_handler: '',
    action: '',
    abnormal_tags: [],
    evidence: [],
    attachments: [],
    version: 0
  })
  const [newAttachment, setNewAttachment] = useState('')
  const [auditText, setAuditText] = useState('')
  const [abnormalText, setAbnormalText] = useState('')
  const [abnormalCategory, setAbnormalCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api.getHazard(id)
      if (res.success) {
        setData(res.data)
        const h = res.data.hazard
        setProcessForm(prev => ({
          ...prev,
          version: h.version,
          page_status: h.status,
          abnormal_tags: h.abnormal_tags || []
        }))
      }
    } catch (e) {
      showToast(e.message || '加载详情失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="modal-mask">
        <div className="modal modal-lg">
          <div className="modal-body">
            <div className="empty-state">加载中...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { hazard, attachments, process_records, audit_notes, abnormal_reasons, next_handlers } = data
  const days = daysUntil(hazard.deadline)

  const getAvailableActions = () => {
    const actions = []
    const from = hazard.status

    if (currentUser.role === ROLES.FIRE_CLERK) {
      if (from === STATUS.DRAFT) {
        actions.push({ value: 'submit', label: '提交待分派', to_status: STATUS.PENDING_ASSIGN, require: [] })
      }
      if (from === STATUS.PENDING_ASSIGN) {
        actions.push({ value: 'assign', label: '分派给监督员', to_status: STATUS.ASSIGNED, require: ['current_handler'] })
        actions.push({ value: 'transfer', label: '转办其他部门', to_status: STATUS.TRANSFERRED, require: ['current_handler'] })
      }
    }

    if (currentUser.role === ROLES.FIRE_SUPERVISOR) {
      if ([STATUS.ASSIGNED, STATUS.TRANSFERRED, STATUS.RETURNED].includes(from)) {
        actions.push({ value: 'rectify', label: '下发整改通知', to_status: STATUS.RECTIFYING, require: ['rectify_notice', 'attachments'] })
      }
      if (from === STATUS.RECTIFYING) {
        actions.push({ value: 'recheck', label: '提交复查销项', to_status: STATUS.RECHECKING, require: ['recheck_result', 'attachments'] })
        actions.push({ value: 'return_rectify', label: '退回补正材料', to_status: STATUS.RETURNED, require: ['return_reason'] })
      }
      if (from === STATUS.RECHECKING) {
        actions.push({ value: 'return_recheck', label: '退回继续整改', to_status: STATUS.RETURNED, require: ['return_reason'] })
      }
    }

    if (currentUser.role === ROLES.STATION_CHIEF) {
      if (from === STATUS.RECHECKING) {
        actions.push({ value: 'revisit', label: '确认已回访', to_status: STATUS.REVISITED, require: ['attachments'] })
        actions.push({ value: 'close', label: '确认销项归档', to_status: STATUS.CLOSED, require: ['recheck_result', 'attachments'] })
        actions.push({ value: 'return_chief', label: '退回补正', to_status: STATUS.RETURNED, require: ['return_reason'] })
      }
      if (from === STATUS.REVISITED) {
        actions.push({ value: 'close_final', label: '最终销项', to_status: STATUS.CLOSED, require: ['attachments'] })
      }
    }

    return actions
  }

  const actions = getAvailableActions()

  const addAttachmentLocal = () => {
    const name = newAttachment.trim()
    if (!name) {
      showToast('请输入附件名称', 'warning')
      return
    }
    setProcessForm(prev => ({
      ...prev,
      attachments: [...prev.attachments, name]
    }))
    setNewAttachment('')
  }

  const removeAttachmentLocal = (idx) => {
    setProcessForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== idx)
    }))
  }

  const handleProcess = async (action) => {
    if (action.require?.includes('current_handler') && !processForm.current_handler.trim()) {
      showToast('请指定处理人', 'warning')
      return
    }
    if (action.require?.includes('return_reason') && !processForm.return_reason.trim()) {
      showToast('请填写退回原因', 'warning')
      return
    }
    if (action.require?.includes('rectify_notice') && !processForm.rectify_notice.trim()) {
      showToast('请填写整改通知内容', 'warning')
      return
    }
    if (action.require?.includes('recheck_result') && !processForm.recheck_result.trim()) {
      showToast('请填写复查结果', 'warning')
      return
    }
    if (action.require?.includes('attachments') && processForm.attachments.length === 0 && attachments.length === 0) {
      showToast('请添加至少一份佐证材料', 'warning')
      return
    }

    setSubmitting(true)
    try {
      const allAttachments = [...attachments.map(a => a.file_name), ...processForm.attachments]
      const payload = {
        ...processForm,
        action: action.value,
        to_status: action.to_status,
        page_status: hazard.status,
        version: hazard.version,
        evidence: allAttachments
      }

      const res = await api.processHazard(id, payload)
      if (res.success) {
        showToast('处理成功：' + action.label, 'success')
        refresh()
        onClose()
      }
    } catch (e) {
      let msg = e.message || '处理失败'
      if (e.detail) {
        const d = e.detail
        const extra = []
        if (d.fix_by_name) extra.push(`补正责任人：${d.fix_by_name}`)
        if (d.current_status_name) extra.push(`当前状态：${d.current_status_name}`)
        if (d.fix_suggestion) extra.push(d.fix_suggestion)
        if (extra.length > 0) {
          msg = e.message + '（' + extra.join('；') + '）'
        }
      }
      showToast(msg, 'error')
      loadData()
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddAudit = async () => {
    if (!auditText.trim()) {
      showToast('请输入备注内容', 'warning')
      return
    }
    try {
      const res = await api.addAuditNote(id, auditText.trim())
      if (res.success) {
        showToast('备注已添加', 'success')
        setAuditText('')
        loadData()
      }
    } catch (e) {
      showToast(e.message || '添加失败', 'error')
    }
  }

  const handleAddAbnormal = async () => {
    if (!abnormalText.trim()) {
      showToast('请输入异常原因', 'warning')
      return
    }
    try {
      const res = await api.addAbnormalReason(id, abnormalText.trim(), abnormalCategory)
      if (res.success) {
        showToast('异常原因已记录', 'success')
        setAbnormalText('')
        setAbnormalCategory('')
        loadData()
      }
    } catch (e) {
      showToast(e.message || '记录失败', 'error')
    }
  }

  const showReturnReason = actions.some(a => a.require?.includes('return_reason'))
  const showHandler = actions.some(a => a.require?.includes('current_handler'))
  const showRectifyNotice = actions.some(a => a.require?.includes('rectify_notice')) || hazard.status === STATUS.RECTIFYING
  const showRecheckResult = actions.some(a => a.require?.includes('recheck_result')) || hazard.status === STATUS.RECHECKING
  const requireAttachments = actions.some(a => a.require?.includes('attachments'))

  return (
    <div className="modal-mask" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">
            📄 {hazard.hazard_no} - {hazard.title}
            <span className="status-badge" style={{marginLeft: '10px', background: STATUS_COLORS[hazard.status] + '20', color: STATUS_COLORS[hazard.status]}}>
              {STATUS_NAMES[hazard.status]}
            </span>
            <span style={{marginLeft: '8px', fontSize: '12px', color: '#6b7280'}}>
              版本 v{hazard.version}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="detail-layout">
            <div className="detail-main">
              <div className="detail-section">
                <div className="section-title"><span className="dot"></span>隐患上报</div>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">单号</span>
                    <span className="info-value" style={{fontFamily: 'monospace'}}>{hazard.hazard_no}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">创建人</span>
                    <span className="info-value">{hazard.created_by}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">位置</span>
                    <span className="info-value">{hazard.location || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">优先级</span>
                    <span className="info-value">
                      <span className="tag priority-tag" style={{background: PRIORITY_COLORS[hazard.priority] + '20', color: PRIORITY_COLORS[hazard.priority]}}>
                        {PRIORITY_NAMES[hazard.priority]}
                      </span>
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">责任人</span>
                    <span className="info-value">{hazard.responsible || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">当前处理人</span>
                    <span className="info-value">{hazard.current_handler || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">截止时间</span>
                    <span className="info-value">
                      {formatDate(hazard.deadline)}
                      {days !== null && (
                        <span style={{marginLeft: '8px', color: days < 0 ? '#dc2626' : '#6b7280', fontSize: '12px'}}>
                          ({days < 0 ? `逾期${-days}天` : `剩余${days}天`})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">预警级别</span>
                    <span className="info-value">
                      <span className="warning-icon" style={{background: WARNING_COLORS[hazard.warning_level]}}></span>
                      <span style={{color: WARNING_COLORS[hazard.warning_level], fontWeight: '500'}}>
                        {WARNING_NAMES[hazard.warning_level]}
                      </span>
                    </span>
                  </div>
                  <div className="info-item full">
                    <span className="info-label">详细描述</span>
                    <span className="info-value" style={{whiteSpace: 'pre-wrap'}}>{hazard.description || '-'}</span>
                  </div>
                  {(hazard.abnormal_tags && hazard.abnormal_tags.length > 0) && (
                    <div className="info-item full">
                      <span className="info-label">异常标签</span>
                      <span className="info-value">
                        {hazard.abnormal_tags.map((t, i) => (
                          <span key={i} className="tag abnormal-tag">{t}</span>
                        ))}
                      </span>
                    </div>
                  )}
                  {next_handlers && next_handlers.length > 0 && (
                    <div className="info-item full">
                      <span className="info-label">下一节点责任角色</span>
                      <span className="info-value">
                        {next_handlers.map((h, i) => (
                          <span key={i} className="tag" style={{background: '#dbeafe', color: '#1e40af', marginRight: '6px'}}>
                            {h.role_name}
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <div className="section-title"><span className="dot"></span>整改通知</div>
                <div className="info-grid">
                  <div className="info-item full">
                    <span className="info-label">已下发整改通知</span>
                    <span className="info-value" style={{whiteSpace: 'pre-wrap'}}>{hazard.rectify_notice || '-'}</span>
                  </div>
                </div>
                {showRectifyNotice && currentUser.role === ROLES.FIRE_SUPERVISOR && (
                  <div style={{marginTop: '12px'}}>
                    <div className="form-group">
                      <label className="form-label required">填写/更新整改通知</label>
                      <textarea
                        className="textarea"
                        placeholder="请填写整改要求、整改时限、整改责任人等内容"
                        value={processForm.rectify_notice}
                        onInput={e => setProcessForm({...processForm, rectify_notice: e.target.value})}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <div className="section-title"><span className="dot"></span>复查销项</div>
                <div className="info-grid">
                  <div className="info-item full">
                    <span className="info-label">复查结果</span>
                    <span className="info-value" style={{whiteSpace: 'pre-wrap'}}>{hazard.recheck_result || '-'}</span>
                  </div>
                  {hazard.return_reason && (
                    <div className="info-item full">
                      <span className="info-label" style={{color: '#dc2626'}}>退回原因</span>
                      <span className="info-value" style={{whiteSpace: 'pre-wrap', color: '#dc2626'}}>{hazard.return_reason}</span>
                    </div>
                  )}
                </div>
                {showRecheckResult && (currentUser.role === ROLES.FIRE_SUPERVISOR || currentUser.role === ROLES.STATION_CHIEF) && (
                  <div style={{marginTop: '12px'}}>
                    <div className="form-group">
                      <label className="form-label">填写复查结果（销项必填）</label>
                      <textarea
                        className="textarea"
                        placeholder="请填写现场复查情况、整改效果、是否符合要求等"
                        value={processForm.recheck_result}
                        onInput={e => setProcessForm({...processForm, recheck_result: e.target.value})}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <div className="section-title">
                  <span className="dot"></span>附件材料与佐证
                  {requireAttachments && <span className="required-tag" style={{marginLeft: '8px', color: '#dc2626', fontSize: '12px'}}>* 必填</span>}
                </div>
                {attachments.length === 0 && processForm.attachments.length === 0 ? (
                  <div className="empty-state" style={{padding: '20px', fontSize: '13px'}}>暂无附件</div>
                ) : (
                  <div className="attachment-list">
                    {attachments.map(a => (
                      <div key={a.id} className="attachment-item">
                        <strong>📎 {a.file_name}</strong>
                        <span style={{marginLeft: '10px', color: '#6b7280', fontSize: '12px'}}>
                          {a.file_type} · 上传人：{a.uploaded_by} · {formatDate(a.uploaded_at)}
                        </span>
                      </div>
                    ))}
                    {processForm.attachments.map((name, idx) => (
                      <div key={'new-' + idx} className="attachment-item" style={{background: '#ecfdf5', borderColor: '#a7f3d0'}}>
                        <strong>📎 {name}</strong>
                        <span style={{marginLeft: '10px', color: '#059669', fontSize: '12px'}}>待提交 · 新增</span>
                        <button className="link-btn" style={{marginLeft: 'auto', color: '#dc2626'}} onClick={() => removeAttachmentLocal(idx)}>移除</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{marginTop: '12px', display: 'flex', gap: '8px'}}>
                  <input
                    type="text"
                    className="input"
                    style={{flex: 1}}
                    placeholder="输入附件名称/佐证材料描述..."
                    value={newAttachment}
                    onInput={e => setNewAttachment(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addAttachmentLocal()}
                  />
                  <button className="btn btn-primary" onClick={addAttachmentLocal}>添加佐证</button>
                </div>
                <div style={{marginTop: '6px', fontSize: '12px', color: '#6b7280'}}>
                  💡 提示：新增的佐证材料将随本次办理操作一同提交并记录到审计轨迹中
                </div>
              </div>

              <div className="detail-section">
                <div className="section-title"><span className="dot"></span>审计轨迹（处理记录）</div>
                {process_records.length === 0 ? (
                  <div className="empty-state" style={{padding: '20px', fontSize: '13px'}}>暂无处理记录</div>
                ) : (
                  <div className="timeline">
                    {process_records.map(r => (
                      <div key={r.id} className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <span className="timeline-action">
                              {r.from_status && r.to_status ? (
                                <>
                                  <span className="status-badge" style={{background: STATUS_COLORS[r.from_status] + '20', color: STATUS_COLORS[r.from_status], marginRight: '6px'}}>
                                    {STATUS_NAMES[r.from_status]}
                                  </span>
                                  →
                                  <span className="status-badge" style={{background: STATUS_COLORS[r.to_status] + '20', color: STATUS_COLORS[r.to_status], marginLeft: '6px'}}>
                                    {STATUS_NAMES[r.to_status]}
                                  </span>
                                </>
                              ) : r.action}
                            </span>
                            <span className="timeline-time">{formatDate(r.created_at)}</span>
                          </div>
                          <div className="timeline-meta">
                            操作人：{r.operator}（{ROLE_NAMES[r.operator_role] || r.operator_role}）
                          </div>
                          {r.remark && <div className="timeline-remark">{r.remark}</div>}
                          {r.evidence && r.evidence.length > 0 && (
                            <div style={{marginTop: '6px', fontSize: '12px', color: '#6b7280'}}>
                              📎 佐证材料：{r.evidence.join('、')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="detail-section">
                <div className="section-title"><span className="dot"></span>审计备注</div>
                <div className="audit-list">
                  {audit_notes.length === 0 ? (
                    <div style={{color: '#9ca3af', fontSize: '13px', padding: '10px 0'}}>暂无备注</div>
                  ) : audit_notes.map(n => (
                    <div key={n.id} className="audit-item">
                      <div className="audit-header">
                        <span className="audit-author">{n.auditor}（{ROLE_NAMES[n.auditor_role] || n.auditor_role}）</span>
                        <span className="audit-time">{formatDate(n.created_at)}</span>
                      </div>
                      <div className="audit-content">{n.content}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop: '12px', display: 'flex', gap: '8px'}}>
                  <textarea
                    className="textarea"
                    style={{flex: 1, minHeight: '60px'}}
                    placeholder="添加审计备注..."
                    value={auditText}
                    onInput={e => setAuditText(e.target.value)}
                  />
                  <button className="btn btn-primary" style={{alignSelf: 'flex-start'}} onClick={handleAddAudit}>添加</button>
                </div>
              </div>

              <div className="detail-section">
                <div className="section-title">
                  <span className="dot"></span>异常原因记录
                  {abnormal_reasons.filter(a => !a.resolved).length > 0 && (
                    <span className="tag" style={{
                      marginLeft: '10px',
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      fontSize: '12px'
                    }}>
                      {abnormal_reasons.filter(a => !a.resolved).length} 项待补正
                    </span>
                  )}
                </div>
                <div className="abnormal-list">
                  {abnormal_reasons.length === 0 ? (
                    <div style={{color: '#9ca3af', fontSize: '13px', padding: '10px 0'}}>暂无异常记录</div>
                  ) : abnormal_reasons.map(a => (
                    <div key={a.id} className="abnormal-item" style={{
                      borderLeft: a.resolved ? '4px solid #10b981' : '4px solid #dc2626',
                      background: a.resolved ? '#f9fafb' : '#fff1f2',
                      border: a.resolved ? '1px solid #e5e7eb' : '1px solid #fecaca'
                    }}>
                      <div className="abnormal-header">
                        <span className="abnormal-reporter">
                          {a.reported_by}
                          {a.category && (
                            <span className="tag" style={{
                              marginLeft: '8px',
                              background: a.resolved ? '#e5e7eb' : '#fef3c7',
                              color: a.resolved ? '#4b5563' : '#92400e',
                              fontWeight: '600'
                            }}>{a.category}</span>
                          )}
                          {a.resolved ? (
                            <span className="tag" style={{marginLeft: '8px', background: '#d1fae5', color: '#065f46'}}>已解决</span>
                          ) : (
                            <span className="tag" style={{marginLeft: '8px', background: '#fee2e2', color: '#991b1b', fontWeight: '600'}}>待补正</span>
                          )}
                        </span>
                        <span className="abnormal-time">{formatDate(a.created_at)}</span>
                      </div>
                      <div className="abnormal-reason">{a.reason}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop: '12px'}}>
                  <div className="form-group">
                    <label className="form-label">记录异常原因（逾期/缺材料/退回等）</label>
                    <div style={{display: 'flex', gap: '8px'}}>
                      <select
                        className="input"
                        style={{width: '140px'}}
                        value={abnormalCategory}
                        onInput={e => setAbnormalCategory(e.target.value)}
                      >
                        <option value="">分类</option>
                        <option value="缺材料">缺材料</option>
                        <option value="超时">超时</option>
                        <option value="逾期">逾期</option>
                        <option value="退回补正">退回补正</option>
                        <option value="其他">其他</option>
                      </select>
                      <input
                        type="text"
                        className="input"
                        style={{flex: 1}}
                        placeholder="请输入异常原因详情..."
                        value={abnormalText}
                        onInput={e => setAbnormalText(e.target.value)}
                      />
                      <button className="btn btn-primary" onClick={handleAddAbnormal}>记录</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-sidebar">
              <div className="action-panel">
                <div className="section-title"><span className="dot"></span>办理操作</div>
                <div style={{marginBottom: '12px', fontSize: '12px', color: '#6b7280', lineHeight: '1.8'}}>
                  当前角色：<strong style={{color: '#1f2937'}}>{currentUser.roleName}</strong><br/>
                  页面状态：<strong style={{color: STATUS_COLORS[hazard.status]}}>{STATUS_NAMES[hazard.status]}</strong><br/>
                  页面版本：<strong>v{hazard.version}</strong>
                </div>

                {actions.length === 0 ? (
                  <div style={{color: '#9ca3af', fontSize: '13px', padding: '10px 0', textAlign: 'center'}}>
                    当前状态无可执行操作<br/>
                    （或请切换对应角色）
                  </div>
                ) : (
                  <>
                    {showHandler && (
                      <div className="form-group">
                        <label className="form-label required">指定处理人</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="请输入处理人姓名"
                          value={processForm.current_handler}
                          onInput={e => setProcessForm({...processForm, current_handler: e.target.value})}
                        />
                      </div>
                    )}
                    {showReturnReason && (
                      <div className="form-group">
                        <label className="form-label required">退回原因</label>
                        <textarea
                          className="textarea"
                          placeholder="请说明退回补正的原因和要求"
                          value={processForm.return_reason}
                          onInput={e => setProcessForm({...processForm, return_reason: e.target.value})}
                        />
                      </div>
                    )}
                    <div className="form-group">
                      <label className="form-label">办理备注</label>
                      <textarea
                        className="textarea"
                        placeholder="可选：填写本次办理的备注说明"
                        value={processForm.remark}
                        onInput={e => setProcessForm({...processForm, remark: e.target.value})}
                      />
                    </div>
                    <div className="action-btns">
                      {actions.map(a => (
                        <button
                          key={a.value}
                          className={`btn ${a.value.includes('return') ? 'btn-danger' : a.value.includes('close') ? 'btn-success' : 'btn-primary'}`}
                          onClick={() => handleProcess(a)}
                          disabled={submitting}
                        >
                          {submitting ? '处理中...' : a.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="detail-section">
                <div className="section-title"><span className="dot"></span>关键信息</div>
                <div style={{fontSize: '13px', lineHeight: '2'}}>
                  <div>📝 创建时间：{formatDate(hazard.created_at)}</div>
                  <div>🔄 更新时间：{formatDate(hazard.updated_at)}</div>
                  <div>🏷️ 当前版本：v{hazard.version}</div>
                  <div>📎 附件数量：{attachments.length + processForm.attachments.length}</div>
                  <div>📜 处理记录：{process_records.length}条</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}
