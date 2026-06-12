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
  const [auditTrail, setAuditTrail] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [currentAction, setCurrentAction] = useState(null)
  const [actionForm, setActionForm] = useState({ opinion: '', evidenceName: '', evidenceUrl: '' })
  const [showEvidenceModal, setShowEvidenceModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [appData, auditData] = await Promise.all([
        api.getApplication(id),
        api.getAuditTrail(id),
      ])
      setApp(appData)
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
    setActionForm({ opinion: '', evidenceName: '', evidenceUrl: '' })
    setShowActionModal(true)
  }

  const handleActionConfirm = async () => {
    try {
      const version = app.version
      const data = { ...actionForm, version }

      switch (currentAction) {
        case 'assign':
          await api.assignApplication(id, data)
          break
        case 'transfer':
          await api.transferApplication(id, data)
          break
        case 'visit':
          await api.visitApplication(id, data)
          break
        case 'correct':
          await api.correctApplication(id, data)
          break
        case 'return':
          await api.returnApplication(id, data)
          break
        case 'review':
          await api.reviewApplication(id, data)
          break
        case 'submitCorrection':
          await api.submitCorrection(id, data)
          break
        case 'submitNotification':
          await api.submitNotification(id, data)
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
    if (!actionForm.evidenceName || !actionForm.evidenceUrl) {
      alert('请填写证据名称和链接')
      return
    }
    try {
      await api.uploadEvidence(id, {
        name: actionForm.evidenceName,
        url: actionForm.evidenceUrl,
        module: 'notification',
      })
      setShowEvidenceModal(false)
      setActionForm({ opinion: '', evidenceName: '', evidenceUrl: '' })
      await loadData()
    } catch (e) {
      alert(`上传失败：${e.message}`)
    }
  }

  const isHandler = app && currentUser.value && app.current_handler === currentUser.value.id

  const canAssign = currentRole.value === 'registrar' && app?.status === 'pending_assign'
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

  const canUploadEvidence = currentRole.value === 'agent' &&
    (app?.status === 'transferred' || app?.status === 'visited') && isHandler

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
                <div className="value">{app.applicant_phone || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">商标名称</div>
                <div className="value">{app.trademark_name}</div>
              </div>
              <div className="detail-item">
                <div className="label">商标类别</div>
                <div className="value">第 {app.trademark_class} 类</div>
              </div>
              <div className="detail-item">
                <div className="label">申请日期</div>
                <div className="value">{formatDate(app.application_date)}</div>
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
                <div className="value">{app.material_note || '无'}</div>
              </div>
              <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                <div className="label">
                  证据完整性
                  <span className={`badge ${app.evidence_complete ? 'badge-green' : 'badge-red'}`} style={{ marginLeft: '8px' }}>
                    {app.evidence_complete ? '齐全' : '缺件'}
                  </span>
                </div>
                <div className="value">{app.evidence_note || '无'}</div>
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

          {app.attachments && app.attachments.length > 0 && (
            <div className="detail-section">
              <h3>附件材料</h3>
              <div className="attachment-list">
                {app.attachments.map(att => (
                  <div key={att.id} className="attachment-item">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{att.name}</span>
                    <span className="module-tag">{moduleLabel(att.module)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {app.exception_reasons && app.exception_reasons.length > 0 && (
            <div className="detail-section">
              <h3>异常原因</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {app.exception_reasons.map(ex => (
                  <div key={ex.id} className="alert alert-error">
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                      {actionLabel(ex.action)} · {ex.handler_name} · {formatDateTime(ex.created_at)}
                    </div>
                    <div>{ex.reason}</div>
                    {ex.corrected && (
                      <div style={{ marginTop: '4px', color: '#52c41a', fontSize: '12px' }}>
                        ✓ 已补正
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {auditTrail && auditTrail.length > 0 && (
            <div className="detail-section">
              <h3>审计轨迹</h3>
              <div className="audit-trail">
                {auditTrail.map(record => (
                  <div key={record.id} className="audit-item">
                    <div className="audit-time">{formatDateTime(record.created_at)}</div>
                    <div className="audit-action">
                      <span className={`status-tag status-${record.to_status || record.from_status || 'pending_assign'}`} style={{ marginRight: '8px' }}>
                        {actionLabel(record.action)}
                      </span>
                      {record.from_status && record.to_status && (
                        <span style={{ color: '#888', fontSize: '12px' }}>
                          {statusLabel(record.from_status)} → {statusLabel(record.to_status)}
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
              {(currentAction === 'correct' || currentAction === 'submitCorrection') && (
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
                  (currentAction === 'review' && (!app?.material_complete || !app?.evidence_complete))
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
              <h2>上传递交通知证据</h2>
              <button className="modal-close" onClick={() => setShowEvidenceModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>证据名称 *</label>
                <input
                  type="text"
                  placeholder="如：商标局受理通知书"
                  value={actionForm.evidenceName}
                  onInput={(e) => setActionForm({ ...actionForm, evidenceName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>证据链接 *</label>
                <input
                  type="text"
                  placeholder="请输入证据文件链接"
                  value={actionForm.evidenceUrl}
                  onInput={(e) => setActionForm({ ...actionForm, evidenceUrl: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>备注</label>
                <textarea
                  placeholder="备注说明（可选）"
                  value={actionForm.opinion}
                  onInput={(e) => setActionForm({ ...actionForm, opinion: e.target.value })}
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
    </div>
  )
}

export default ApplicationDetail
