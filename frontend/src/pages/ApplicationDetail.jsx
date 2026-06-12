import { useEffect, useState } from 'preact/hooks'
import { api } from '../api.js'
import {
  currentRole,
  currentUser,
  loadApplications,
  loadStats,
} from '../store.js'
import {
  statusLabel,
  warningLabel,
  moduleLabel,
  actionLabel,
  formatDate,
  formatDateTime,
  daysRemaining,
} from '../utils/format.js'

function ApplicationDetail({ id }) {
  const [app, setApp] = useState(null)
  const [attachments, setAttachments] = useState([])
  const [exceptions, setExceptions] = useState([])
  const [auditTrail, setAuditTrail] = useState([])
  const [auditRemarks, setAuditRemarks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [currentAction, setCurrentAction] = useState(null)
  const [actionForm, setActionForm] = useState({
    opinion: '',
    evidenceName: '',
    evidenceUrl: '',
    evidenceType: 'notification_evidence',
    materialComplete: false,
    evidenceComplete: false,
    reason: '',
    exceptionReason: '',
    assignee: 'agent',
  })
  const [showEvidenceModal, setShowEvidenceModal] = useState(false)
  const [evidenceForm, setEvidenceForm] = useState({
    name: '',
    fileType: '',
    evidenceType: 'notification_evidence',
    url: '',
  })
  const [showRemarkModal, setShowRemarkModal] = useState(false)
  const [remarkForm, setRemarkForm] = useState('')

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [detailData, auditData] = await Promise.all([
      api.getApplication(id),
      api.getAuditTrail(id),
    ])
    setApp(detailData.application)
    setAttachments(detailData.attachments || [])
    setExceptions(detailData.exceptions || [])
    setAuditRemarks(detailData.audit_remarks || [])
    setAuditTrail(auditData)
  } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    window.history.back()
  }

  const handleActionClick = (action) => {
    setCurrentAction(action)
    setActionForm({
      opinion: '',
      evidenceName: '',
      evidenceUrl: '',
      evidenceType: 'notification_evidence',
      materialComplete: false,
      evidenceComplete: false,
      reason: '',
      assignee: 'agent',
    })
    setShowActionModal(true)
  }

  const handleActionConfirm = async () => {
    try {
      const version = app.version
      const data = { ...actionForm, version }

      switch (currentAction) {
        case 'assign':
          await api.assignApplication(id, { opinion: actionForm.opinion, version })
          break
        case 'transfer':
          await api.transferApplication(id, data)
          break
        case 'visit':
          await api.visitApplication(id, {
            opinion: actionForm.opinion,
            evidence_complete: actionForm.evidenceComplete,
            version,
          })
          break
        case 'correct':
          await api.correctApplication(id, {
            opinion: actionForm.opinion,
            material_complete: actionForm.materialComplete,
            evidence_complete: actionForm.evidenceComplete,
            exception_reason: actionForm.reason,
            version,
          })
          break
        case 'return':
          await api.returnApplication(id, {
            opinion: actionForm.opinion,
            reason: actionForm.exceptionReason,
            material_complete: actionForm.materialComplete,
            evidence_complete: actionForm.evidenceComplete,
            exception_reason: actionForm.exceptionReason,
            version,
          })
          break
        case 'review':
          await api.reviewApplication(id, {
          opinion: actionForm.opinion,
          approved: true,
          version,
        })
          break
        case 'submitCorrection':
          await api.submitCorrection(id, {
            opinion: actionForm.opinion,
            material_complete: actionForm.materialComplete,
            evidence_complete: actionForm.evidenceComplete,
            exception_reason: actionForm.reason,
            version,
          })
          break
        case 'submitNotification':
          await api.submitNotification(id, {
            opinion: actionForm.opinion,
            evidence_complete: actionForm.evidenceComplete,
            version,
          })
          break
        default:
          break
      }

      setShowActionModal(false)
      await loadData()
      await loadApplications()
      await loadStats()
    } catch (e) {
      alert(`操作失败：${e.message}`)
    }
  }

  const handleUploadEvidence = async () => {
    if (!evidenceForm.name) {
      alert('请填写证据名称')
      return
    }
    try {
      await api.uploadEvidence(id, {
        name: evidenceForm.name,
        file_name: evidenceForm.name,
        file_type: evidenceForm.fileType,
        evidence_type: evidenceForm.evidenceType,
        module_type: app.currentModule || 'notification',
        url: evidenceForm.url,
        version: app.version,
      })
      setShowEvidenceModal(false)
      setEvidenceForm({
        name: '',
        fileType: '',
        evidenceType: 'notification_evidence',
        url: '',
      })
      await loadData()
      await loadApplications()
      await loadStats()
    } catch (e) {
      alert(`上传失败：${e.message}`)
    }
  }

  const handleRemarkSubmit = async () => {
    if (!remarkForm.trim()) {
      alert('请输入备注内容')
      return
    }
    try {
      await api.addAuditRemark(id, {
        content: remarkForm.trim(),
        version: app.version,
      })
      setShowRemarkModal(false)
      setRemarkForm('')
      await loadData()
      await loadApplications()
      await loadStats()
    } catch (e) {
      alert(`添加备注失败：${e.message}`)
    }
  }

  const isHandler = app && currentUser.value && app.current_handler === currentUser.value.id

  const canAssign = currentRole.value === 'registrar' && app?.status === 'pending_assign' && isHandler
  const canTransfer = currentRole.value === 'agent' && app?.status === 'pending_assign' && isHandler
  const canVisit = currentRole.value === 'agent' && app?.status === 'transferred' && isHandler
  const canCorrect = currentRole.value === 'registrar' &&
    (app?.status === 'correction' || app?.status === 'returned') && isHandler
  const canReturn = (currentRole.value === 'agent' || currentRole.value === 'director') &&
    (app?.status === 'transferred' || app?.status === 'visited') && isHandler
  const canReview = currentRole.value === 'director' && app?.status === 'visited' && isHandler

  const canSubmitCorrection = currentRole.value === 'registrar' &&
    (app?.status === 'correction' || app?.status === 'returned') && isHandler
  const canSubmitNotification = currentRole.value === 'agent' &&
    app?.status === 'transferred' && isHandler

  const canUploadEvidence = (currentRole.value === 'agent' || currentRole.value === 'registrar') &&
    (app?.status === 'transferred' || app?.status === 'visited' ||
     app?.status === 'correction' || app?.status === 'returned' ||
     app?.status === 'pending_assign')

  const lastRecord = auditTrail && auditTrail.length > 0 ? auditTrail[0] : null

  const days = app?.node_due_date ? daysRemaining(app.node_due_date) : null

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="back-link" onClick={handleBack}>&larr; 返回列表</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner">加载中...</div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : !app ? (
        <div className="empty-state">申请单不存在</div>
      ) : (
        <div className="detail-container">
          <div className="detail-header">
            <div>
              <h2>
                商标申请单详情
                <span style={{ marginLeft: '12px', fontFamily: 'monospace', color: '#888', fontSize: '16px' }}>
                  {app.application_no}
                </span>
              </h2>
              <div style={{ marginTop: '8px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`status-tag status-${app.status}`}>{statusLabel(app.status)}</span>
                <span className={`warning-tag warning-${app.warning_status}`}>{warningLabel(app.warning_status)}</span>
                <span style={{ fontSize: '13px', color: '#888' }}>
                  当前版本：v{app.version}
                </span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#888' }}>
                创建时间：{formatDateTime(app.created_at)}
              </div>
              <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
                创建人：{app.created_by_name}
              </div>
            </div>
          </div>

          {app.node_due_date && (
            <div style={{ padding: '0 20px' }}>
            <div className={`node-info ${app.warning_status === 'overdue' ? 'overdue' : ''}`}>
              <span className="node-name">当前节点：{app.current_node}</span>
              <span style={{ margin: '0 12px', color: '#ddd' }}>|</span>
              <span className="node-responsible">责任人：{app.node_responsible}</span>
              <span style={{ margin: '0 12px', color: '#ddd' }}>|</span>
              <span>
                截止日期：{formatDate(app.node_due_date)}
                {days !== null && (
                  <span style={{
                    marginLeft: '8px',
                    color: days < 0 ? '#ff4d4f' : days <= 3 ? '#fa8c16' : '#52c41a',
                    fontWeight: '500',
                  }}>
                    ({days < 0 ? `已逾期 ${Math.abs(days)} 天` : days <= 3 ? `剩 ${days} 天（临期）` : `剩 ${days} 天`})
                  </span>
                )}
              </span>
              {app.node_overdue && (
                <span style={{ marginLeft: '12px', color: '#ff4d4f' }}>
                  <strong>已超时</strong>
                </span>
              )}
            </div>
          </div>
          )}

          <div className="detail-section">
            <h3>基本信息</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <div className="label">申请人</div>
                <div className="value">{app.applicant_name}</div>
              </div>
              <div className="detail-item">
                <div className="label">联系电话</div>
                <div className="value">{app.applicant_contact || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">商标名称</div>
                <div className="value">{app.trademark_name}</div>
              </div>
              <div className="detail-item">
                <div className="label">商标类别</div>
                <div className="value">{app.category}</div>
              </div>
              <div className="detail-item">
                <div className="label">申请日期</div>
                <div className="value">{formatDate(app.created_at)}</div>
              </div>
              <div className="detail-item">
                <div className="label">当前处理人</div>
                <div className="value">{app.current_handler_name || '-'}</div>
              </div>
              <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                <div className="label">
                  材料完整性
                  <span className={`badge ${app.material_complete ? 'badge-green' : 'badge-red'}`} style={{ marginLeft: '8px' }}>
                    {app.material_complete ? '齐全' : '缺件'}
                  </span>
                </div>
              </div>
              <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                <div className="label">
                  证据完整性
                  <span className={`badge ${app.evidence_complete ? 'badge-green' : 'badge-red'}`} style={{ marginLeft: '8px' }}>
                    {app.evidence_complete ? '齐全' : '缺件'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {lastRecord && (
            <div className="detail-section">
              <h3>上一处理人意见</h3>
              <div className="last-opinion">
                <div className="opinion-header">
                  <span>
                    {actionLabel(lastRecord.action)} · {lastRecord.handler_name}
                  </span>
                  <span>{formatDateTime(lastRecord.created_at)}</span>
                </div>
                {lastRecord.opinion && (
                  <div className="opinion-content">{lastRecord.opinion}</div>
                )}
                {!lastRecord.opinion && (
                  <div className="opinion-content" style={{ color: '#888' }}>无意见</div>
                )}
              </div>
            </div>
          )}

          {attachments && attachments.length > 0 && (
            <div className="detail-section">
              <h3>附件材料（{attachments.length}）</h3>
              <div className="attachment-list">
                {attachments.map(att => (
                  <div key={att.id} className="attachment-item">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{att.file_name || att.name}</span>
                    <span className="module-tag">{moduleLabel(att.module_type || att.module)}</span>
                    {att.evidence_type && (
                      <span className="evidence-type-tag" style={{
                        fontSize: '12px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: '#e6f7ff',
                      color: '#1890ff',
                    }}>
                      {att.evidence_type === 'notification_evidence' ? '递交通知' :
                       att.evidence_type === 'application_form' ? '申请书' :
                       att.evidence_type === 'trademark_image' ? '商标图样' :
                       att.evidence_type === 'correction_material' ? '补正材料' : att.evidence_type}
                    </span>
                    )}
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      {att.uploaded_by_name || att.uploaded_by} · {formatDate(att.uploaded_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {exceptions && exceptions.length > 0 && (
            <div className="detail-section">
              <h3>异常原因（{exceptions.length}）</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {exceptions.map(ex => (
                  <div key={ex.id} className={`alert ${ex.resolved ? 'alert-success' : 'alert-error'}`}>
                    <div style={{ fontWeight: '500', marginBottom: '6px' }}>
                      <span style={{ marginRight: '8px' }}>
                        {moduleLabel(ex.module_type || ex.module)}
                      </span>
                      <span className={`status-tag status-${ex.reason_type === 'material_missing' ? 'correction' :
                        ex.reason_type === 'evidence_missing' ? 'returned' :
                        ex.reason_type === 'overdue_advance' ? 'transferred' :
                        ex.reason_type === 'status_conflict' ? 'visited' :
                        ex.reason_type === 'batch_correction' ? 'correction' : 'pending_assign'}`}
                        style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '12px', marginRight: '8px' }}>
                        {ex.reason_type === 'material_missing' ? '材料缺失' :
                         ex.reason_type === 'evidence_missing' ? '证据缺失' :
                         ex.reason_type === 'correction_note' ? '补正备注' :
                         ex.reason_type === 'overdue_advance' ? '逾期推进' :
                         ex.reason_type === 'status_conflict' ? '状态冲突' :
                         ex.reason_type === 'batch_correction' ? '批量补正' : ex.reason_type}
                      </span>
                      <span style={{ fontSize: '13px', color: '#666' }}>
                        {ex.created_by_name || ex.created_by} · {formatDateTime(ex.created_at)}
                      </span>
                    </div>
                    {(ex.material_complete !== undefined && ex.material_complete !== null) || (ex.evidence_complete !== undefined && ex.evidence_complete !== null) ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                        {ex.material_complete !== undefined && ex.material_complete !== null && (
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            background: ex.material_complete ? '#f6ffed' : '#fff2f0',
                            color: ex.material_complete ? '#52c41a' : '#ff4d4f',
                            border: `1px solid ${ex.material_complete ? '#b7eb8f' : '#ffa39e'}`,
                          }}>
                            材料完整：{ex.material_complete ? '是' : '否'}
                          </span>
                        )}
                        {ex.evidence_complete !== undefined && ex.evidence_complete !== null && (
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            background: ex.evidence_complete ? '#f6ffed' : '#fff2f0',
                            color: ex.evidence_complete ? '#52c41a' : '#ff4d4f',
                            border: `1px solid ${ex.evidence_complete ? '#b7eb8f' : '#ffa39e'}`,
                          }}>
                            证据完整：{ex.evidence_complete ? '是' : '否'}
                          </span>
                        )}
                      </div>
                    ) : null}
                    <div style={{ lineHeight: '1.6' }}>
                      <strong>异常说明：</strong>{ex.reason}
                    </div>
                    {ex.opinion && (
                      <div style={{ marginTop: '4px', lineHeight: '1.6' }}>
                        <strong>处理意见：</strong>{ex.opinion}
                      </div>
                    )}
                    {ex.resolved && (
                      <div style={{ marginTop: '6px', color: '#52c41a', fontSize: '12px' }}>
                        ✓ 已解决 {ex.resolved_at ? `（${formatDate(ex.resolved_at)}）` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="detail-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>审计备注（{auditRemarks.length} 条）</h3>
              <button className="btn btn-default btn-sm" onClick={() => { setRemarkForm(''); setShowRemarkModal(true); }}>
                + 添加备注
              </button>
            </div>
            {auditRemarks && auditRemarks.length > 0 ? (
              <div className="audit-trail">
                {auditRemarks.map(remark => (
                  <div key={remark.id} className="audit-item" style={{ background: '#f9f9ff' }}>
                    <div className="audit-time">{formatDateTime(remark.created_at)}</div>
                    <div className="audit-action">
                      <span className="status-tag status-visited" style={{ marginRight: '8px' }}>
                        备注
                      </span>
                    </div>
                    <div className="audit-handler">
                      <span>创建人：{remark.created_by_name || remark.created_by}</span>
                    </div>
                    <div className="audit-opinion" style={{ background: '#f0f5ff', color: '#1890ff', marginTop: '8px' }}>
                      {remark.content}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#999', fontSize: '13px', padding: '12px 0' }}>暂无审计备注</div>
            )}
          </div>

          {auditTrail && auditTrail.length > 0 && (
            <div className="detail-section">
              <h3>审计轨迹（{auditTrail.length} 条记录）</h3>
              <div className="audit-trail">
                {auditTrail.map(record => (
                  <div key={record.id} className="audit-item">
                    <div className="audit-time">{formatDateTime(record.created_at)}</div>
                    <div className="audit-action">
                      <span className={`status-tag status-${record.new_status || record.old_status || 'pending_assign'}`} style={{ marginRight: '8px' }}>
                        {actionLabel(record.action)}
                      </span>
                      {record.old_status && record.new_status && (
                        <span style={{ color: '#888', fontSize: '12px' }}>
                          {statusLabel(record.old_status)} → {statusLabel(record.new_status)}
                        </span>
                      )}
                    </div>
                    <div className="audit-handler">
                      处理人：{record.handler_name}
                      {record.role && <span style={{ color: '#888' }}>（{record.role_name || record.role}）</span>}
                    </div>
                    {record.opinion && (
                      <div className="audit-opinion">{record.opinion}</div>
                    )}
                    {record.remark && (
                      <div className="audit-opinion" style={{ background: '#f0f5ff', color: '#1890ff' }}>
                        备注：{record.remark}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="action-bar">
            {canAssign && (
              <button className="btn btn-primary" onClick={() => handleActionClick('assign')}>
                分派（待分派→已转办）
              </button>
            )}
            {canTransfer && (
              <button className="btn btn-warning" onClick={() => handleActionClick('transfer')}>
                转办
              </button>
            )}
            {canVisit && (
              <button className="btn btn-success" onClick={() => handleActionClick('visit')}>
                回访（已转办→已回访）
              </button>
            )}
            {canCorrect && (
              <button className="btn btn-warning" onClick={() => handleActionClick('correct')}>
                补正（待补正→待分派）
              </button>
            )}
            {canReturn && (
              <button className="btn btn-danger" onClick={() => handleActionClick('return')}>
                退回
              </button>
            )}
            {canReview && (
              <button className="btn btn-primary" onClick={() => handleActionClick('review')}>
                复核归档（已回访→已归档）
              </button>
            )}
            {canSubmitCorrection && (
              <button className="btn btn-warning" onClick={() => handleActionClick('submitCorrection')}>
                提交补正材料
              </button>
            )}
            {canSubmitNotification && (
              <button className="btn btn-primary" onClick={() => handleActionClick('submitNotification')}>
                提交递交通知
              </button>
            )}
            {canUploadEvidence && (
              <button className="btn btn-default" onClick={() => setShowEvidenceModal(true)}>
                上传证据
              </button>
            )}
            {!canAssign && !canTransfer && !canVisit && !canCorrect && !canReturn && !canReview &&
              !canSubmitCorrection && !canSubmitNotification && !canUploadEvidence && (
              <span style={{ color: '#888', fontSize: '13px' }}>当前状态下无可用操作</span>
            )}
          </div>
        </div>
      )}

      {showActionModal && (
        <div className="modal-overlay" onClick={() => setShowActionModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {currentAction === 'assign' && '分派申请单'}
                {currentAction === 'transfer' && '转办申请单'}
                {currentAction === 'visit' && '回访申请单'}
                {currentAction === 'correct' && '补正申请单'}
                {currentAction === 'return' && '退回申请单'}
                {currentAction === 'review' && '复核归档'}
                {currentAction === 'submitCorrection' && '提交补正材料'}
                {currentAction === 'submitNotification' && '提交递交通知'}
              </h2>
              <button className="modal-close" onClick={() => setShowActionModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {currentAction === 'visit' && !app?.evidence_complete && (
                <div className="alert alert-warning">
                  当前证据不完整，请先上传递交通知证据后再进行回访操作。
                </div>
              )}
              {currentAction === 'review' && (!app?.material_complete || !app?.evidence_complete) && (
                <div className="alert alert-warning">
                  复核归档要求材料和证据都必须完整。
                  {!app?.material_complete && <div>• 材料不完整</div>}
                  {!app?.evidence_complete && <div>• 证据不完整</div>}
                </div>
              )}
              {currentAction === 'return' && (
                <>
                  {!actionForm.materialComplete && (
                    <div className="alert alert-warning">材料不完整，退回后将进入待补正状态</div>
                  )}
                  {!actionForm.evidenceComplete && actionForm.materialComplete && (
                    <div className="alert alert-warning">证据不完整，退回后将进入已退回状态</div>
                  )}
                  <div className="form-group">
                    <label>材料是否完整</label>
                    <select
                      value={actionForm.materialComplete ? 'true' : 'false'}
                      onInput={(e) => setActionForm({ ...actionForm, materialComplete: e.target.value === 'true' })}
                    >
                      <option value="false">否，材料不完整</option>
                      <option value="true">是，材料完整</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>证据是否完整</label>
                    <select
                      value={actionForm.evidenceComplete ? 'true' : 'false'}
                      onInput={(e) => setActionForm({ ...actionForm, evidenceComplete: e.target.value === 'true' })}
                    >
                      <option value="false">否，证据不完整</option>
                      <option value="true">是，证据完整</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>异常原因说明 <span style={{ color: '#ff4d4f' }}>*</span></label>
                    <textarea
                      placeholder="请详细说明退回原因或异常情况（必填）"
                      value={actionForm.exceptionReason}
                      onInput={(e) => setActionForm({ ...actionForm, exceptionReason: e.target.value })}
                    />
                    {!actionForm.exceptionReason?.trim() && (
                      <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '4px' }}>异常原因说明为必填项</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label>处理意见</label>
                    <textarea
                      placeholder="请输入处理意见（可选）"
                      value={actionForm.opinion}
                      onInput={(e) => setActionForm({ ...actionForm, opinion: e.target.value })}
                    />
                  </div>
                </>
              )}
              {(currentAction === 'correct' || currentAction === 'submitCorrection') && (
                  <>
                    <div className="form-group">
                      <label>材料是否已补全</label>
                      <select
                        value={actionForm.materialComplete ? 'true' : 'false'}
                        onInput={(e) => setActionForm({ ...actionForm, materialComplete: e.target.value === 'true' })}
                      >
                        <option value="false">否</option>
                        <option value="true">是，材料已补全</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>证据是否已完整</label>
                      <select
                        value={actionForm.evidenceComplete ? 'true' : 'false'}
                        onInput={(e) => setActionForm({ ...actionForm, evidenceComplete: e.target.value === 'true' })}
                      >
                        <option value="false">否</option>
                        <option value="true">是，证据已完整</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>异常原因说明</label>
                      <textarea
                        placeholder="补正说明或异常原因（可选）"
                        value={actionForm.reason}
                        onInput={(e) => setActionForm({ ...actionForm, reason: e.target.value })}
                      />
                    </div>
                  </>
                )}
              {(currentAction === 'visit' || currentAction === 'submitNotification') && (
                <div className="form-group">
                  <label>证据是否已完整</label>
                  <select
                    value={actionForm.evidenceComplete ? 'true' : 'false'}
                    onInput={(e) => setActionForm({ ...actionForm, evidenceComplete: e.target.value === 'true' })}
                  >
                    <option value="false">否</option>
                    <option value="true">是，证据已完整</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>处理意见</label>
                <textarea
                  placeholder="请输入处理意见（根据操作可能必填）"
                  value={actionForm.opinion}
                  onInput={(e) => setActionForm({ ...actionForm, opinion: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowActionModal(false)}>取消</button>
              <button
                className="btn btn-primary"
                onClick={handleActionConfirm}
                disabled={
                  (currentAction === 'visit' && !app?.evidence_complete) ||
                  (currentAction === 'review' && (!app?.material_complete || !app?.evidence_complete)) ||
                  (currentAction === 'return' && !actionForm.exceptionReason?.trim()) ||
                  (currentAction === 'assign' && !actionForm.opinion?.trim())
                }
              >
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}

      {showEvidenceModal && (
        <div className="modal-overlay" onClick={() => setShowEvidenceModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>上传证据材料</h2>
              <button className="modal-close" onClick={() => setShowEvidenceModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>证据名称 *</label>
                <input
                  type="text"
                  placeholder="如：商标局受理通知书"
                  value={evidenceForm.name}
                  onInput={(e) => setEvidenceForm({ ...evidenceForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>证据类型</label>
                <select
                  value={evidenceForm.evidenceType}
                  onInput={(e) => setEvidenceForm({ ...evidenceForm, evidenceType: e.target.value })}
                >
                  <option value="notification_evidence">递交通知回执</option>
                  <option value="application_form">商标申请书</option>
                  <option value="trademark_image">商标图样</option>
                  <option value="correction_material">补正材料</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div className="form-group">
                <label>文件类型</label>
                <input
                  type="text"
                  placeholder="如：pdf、jpg 等"
                  value={evidenceForm.fileType}
                  onInput={(e) => setEvidenceForm({ ...evidenceForm, fileType: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>文件链接/地址</label>
                <input
                  type="text"
                  placeholder="请输入文件访问链接"
                  value={evidenceForm.url}
                  onInput={(e) => setEvidenceForm({ ...evidenceForm, url: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowEvidenceModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleUploadEvidence}>上传</button>
            </div>
          </div>
        </div>
      )}

      {showRemarkModal && (
        <div className="modal-overlay" onClick={() => setShowRemarkModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>添加审计备注</h2>
              <button className="modal-close" onClick={() => setShowRemarkModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>备注内容 *</label>
                <textarea
                  rows={5}
                  placeholder="请输入备注内容，备注将永久保留在审计记录中"
                  value={remarkForm}
                  onInput={(e) => setRemarkForm(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowRemarkModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleRemarkSubmit}>提交</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ApplicationDetail
