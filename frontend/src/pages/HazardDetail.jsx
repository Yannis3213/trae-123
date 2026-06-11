import { useState, useEffect } from 'preact/hooks'
import { api } from '../api'
import { STATUS, STATUS_NAMES, STATUS_COLORS, PRIORITY_NAMES, PRIORITY_COLORS, WARNING_NAMES, WARNING_COLORS, ROLES, ROLE_NAMES } from '../types'
import { formatDate, daysUntil } from '../utils'

export default function HazardDetail({ id, store, onClose }) {
  const { currentUser, showToast, refresh } = store
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [processForm, setProcessForm] = useState({
    toStatus: '',
    remark: '',
    return_reason: '',
    rectify_notice: '',
    recheck_result: '',
    current_handler: '',
    action: '',
    abnormal_tags: []
  })
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

  const { hazard, attachments, process_records, audit_notes, abnormal_reasons } = data
  const days = daysUntil(hazard.deadline)

  const getAvailableActions = () => {
    const actions = []
    const from = hazard.status

    if (currentUser.role === ROLES.FIRE_CLERK) {
      if (from === STATUS.DRAFT) {
        actions.push({ value: 'submit', label: '提交待分派', toStatus: STATUS.PENDING_ASSIGN, require: [] })
      }
      if (from === STATUS.PENDING_ASSIGN) {
        actions.push({ value: 'assign', label: '分派给监督员', toStatus: STATUS.ASSIGNED, require: ['current_handler'] })
        actions.push({ value: 'transfer', label: '转办其他部门', toStatus: STATUS.TRANSFERRED, require: ['current_handler'] })
      }
    }

    if (currentUser.role === ROLES.FIRE_SUPERVISOR) {
      if ([STATUS.ASSIGNED, STATUS.TRANSFERRED, STATUS.RETURNED].includes(from)) {
        actions.push({ value: 'rectify', label: '下发整改通知', toStatus: STATUS.RECTIFYING, require: ['rectify_notice'] })
      }
      if (from === STATUS.RECTIFYING) {
        actions.push({ value: 'recheck', label: '提交复查销项', toStatus: STATUS.RECHECKING, require: ['recheck_result'] })
        actions.push({ value: 'return_rectify', label: '退回补正材料', toStatus: STATUS.RETURNED, require: ['return_reason'] })
      }
      if (from === STATUS.RECHECKING) {
        actions.push({ value: 'return_recheck', label: '退回继续整改', toStatus: STATUS.RETURNED, require: ['return_reason'] })
      }
    }

    if (currentUser.role === ROLES.STATION_CHIEF) {
      if (from === STATUS.RECHECKING) {
        actions.push({ value: 'revisit', label: '确认已回访', toStatus: STATUS.REVISITED, require: [] })
        actions.push({ value: 'close', label: '确认销项归档', toStatus: STATUS.CLOSED, require: ['recheck_result'] })
        actions.push({ value: 'return_chief', label: '退回补正', toStatus: STATUS.RETURNED, require: ['return_reason'] })
      }
      if (from === STATUS.REVISITED) {
        actions.push({ value: 'close_final', label: '最终销项', toStatus: STATUS.CLOSED, require: [] })
      }
    }

    return actions
  }

  const actions = getAvailableActions()

  const handleProcess = async (action) => {
    setSubmitting(true)
    try {
      const payload = {
        ...processForm,
        action: action.value,
        toStatus: action.toStatus,
        version: hazard.version,
        abnormal_tags: hazard.abnormal_tags || []
      }

      if (hazard.warning_level === 'overdue' && action.toStatus !== STATUS.RETURNED) {
        payload.abnormal_tags = [...new Set([...(hazard.abnormal_tags || []), '已逾期'])]
      }

      const res = await api.processHazard(id, payload)
      if (res.success) {
        showToast('处理成功：' + action.label, 'success')
        refresh()
        onClose()
      } else {
        showToast(res.message || '处理失败', 'error')
      }
    } catch (e) {
      showToast(e.message || '处理失败', 'error')
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

  return (
    <div className="modal-mask" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">
            📄 {hazard.hazard_no} - {hazard.title}
            <span className="status-badge" style={{marginLeft: '10px', background: STATUS_COLORS[hazard.status] + '20', color: STATUS_COLORS[hazard.status]}}>
              {STATUS_NAMES[hazard.status]}
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
                </div>
              </div>

              <div className="detail-section">
                <div className="section-title"><span className="dot"></span>整改通知</div>
                <div className="info-grid">
                  <div className="info-item full">
                    <span className="info-label">整改通知内容</span>
                    <span className="info-value" style={{whiteSpace: 'pre-wrap'}}>{hazard.rectify_notice || '-'}</span>
                  </div>
                </div>
                {[STATUS.ASSIGNED, STATUS.TRANSFERRED, STATUS.RETURNED].includes(hazard.status) && currentUser.role === ROLES.FIRE_SUPERVISOR && (
                  <div style={{marginTop: '12px'}}>
                    <div className="form-group">
                      <label className="form-label required">填写整改通知</label>
                      <textarea
                        className="textarea"
                        placeholder="请填写整改要求、整改时限等内容"
                        value={processForm.rectify_notice}
                        onChange={e => setProcessForm({...processForm, rectify_notice: e.target.value})}
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
                {[STATUS.RECTIFYING, STATUS.RECHECKING].includes(hazard.status) && (currentUser.role === ROLES.FIRE_SUPERVISOR || currentUser.role === ROLES.STATION_CHIEF) && (
                  <div style={{marginTop: '12px'}}>
                    <div className="form-group">
                      <label className="form-label">填写复查结果（销项必填）</label>
                      <textarea
                        className="textarea"
                        placeholder="请填写现场复查情况、整改效果等"
                        value={processForm.recheck_result}
                        onChange={e => setProcessForm({...processForm, recheck_result: e.target.value})}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <div className="section-title"><span className="dot"></span>附件材料</div>
                {attachments.length === 0 ? (
                  <div className="empty-state" style={{padding: '20px', fontSize: '13px'}}>暂无附件</div>
                ) : (
                  <div className="attachment-list">
                    {attachments.map(a => (
                      <div key={a.id} className="attachment-item">
                        <strong>📎 {a.file_name}</strong>
                        <span style={{marginLeft: '10px', color: '#6b7280', fontSize: '12px'}}>
                          {a.file_type} · {Math.round(a.file_size/1024)}KB · 上传人：{a.uploaded_by} · {formatDate(a.uploaded_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
                    onChange={e => setAuditText(e.target.value)}
                  />
                  <button className="btn btn-primary" style={{alignSelf: 'flex-start'}} onClick={handleAddAudit}>添加</button>
                </div>
              </div>

              <div className="detail-section">
                <div className="section-title"><span className="dot"></span>异常原因记录</div>
                <div className="abnormal-list">
                  {abnormal_reasons.length === 0 ? (
                    <div style={{color: '#9ca3af', fontSize: '13px', padding: '10px 0'}}>暂无异常记录</div>
                  ) : abnormal_reasons.map(a => (
                    <div key={a.id} className="abnormal-item">
                      <div className="abnormal-header">
                        <span className="abnormal-reporter">
                          {a.reported_by}
                          {a.category && <span className="tag" style={{marginLeft: '8px', background: '#fef3c7', color: '#92400e'}}>{a.category}</span>}
                          {a.resolved && <span className="tag" style={{marginLeft: '8px', background: '#d1fae5', color: '#065f46'}}>已解决</span>}
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
                      <select className="input" style={{width: '140px'}} value={abnormalCategory} onChange={e => setAbnormalCategory(e.target.value)}>
                        <option value="">分类</option>
                        <option value="缺材料">缺材料</option>
                        <option value="超时">超时</option>
                        <option value="逾期">逾期</option>
                        <option value="退回补正">退回补正</option>
                        <option value="其他">其他</option>
                      </select>
                      <input type="text" className="input" style={{flex: 1}} placeholder="请输入异常原因详情..." value={abnormalText} onChange={e => setAbnormalText(e.target.value)} />
                      <button className="btn btn-primary" onClick={handleAddAbnormal}>记录</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-sidebar">
              <div className="action-panel">
                <div className="section-title"><span className="dot"></span>办理操作</div>
                <div style={{marginBottom: '12px', fontSize: '12px', color: '#6b7280'}}>
                  当前角色：<strong>{currentUser.roleName}</strong><br/>
                  当前版本：v{hazard.version}
                </div>

                {actions.length === 0 ? (
                  <div style={{color: '#9ca3af', fontSize: '13px', padding: '10px 0', textAlign: 'center'}}>
                    当前状态无可执行操作<br/>
                    （或请切换对应角色）
                  </div>
                ) : (
                  <>
                    {actions.some(a => a.require.includes('return_reason')) && (
                      <div className="form-group">
                        <label className="form-label required">退回原因</label>
                        <textarea
                          className="textarea"
                          placeholder="请说明退回补正的原因"
                          value={processForm.return_reason}
                          onChange={e => setProcessForm({...processForm, return_reason: e.target.value})}
                        />
                      </div>
                    )}
                    {actions.some(a => a.require.includes('current_handler')) && (
                      <div className="form-group">
                        <label className="form-label required">指定处理人</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="请输入处理人姓名"
                          value={processForm.current_handler}
                          onChange={e => setProcessForm({...processForm, current_handler: e.target.value})}
                        />
                      </div>
                    )}
                    <div className="form-group">
                      <label className="form-label">办理备注</label>
                      <textarea
                        className="textarea"
                        placeholder="可选：填写本次办理的备注说明"
                        value={processForm.remark}
                        onChange={e => setProcessForm({...processForm, remark: e.target.value})}
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
                  <div>🏷️ 版本号：v{hazard.version}</div>
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
