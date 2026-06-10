import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../api'
import { useApp } from '../context/AppContext.jsx'

const URGENCY_LABEL = { normal: '正常', approaching: '临期', overdue: '逾期' }
const FAIL_CODE_LABEL = {
  VERSION_CONFLICT: '版本冲突',
  STATUS_CONFLICT: '状态冲突',
  WRONG_HANDLER: '处理人不匹配',
  PERMISSION_DENIED: '角色越权',
  MISSING_MODULES: '缺必填证据',
  MISSING_FIELDS: '缺必填字段',
  NOT_FOUND: '单据不存在',
  NOT_OVERDUE: '非逾期',
  DUPLICATE_ACTION: '重复操作',
  DB_ERROR: '数据库异常'
}

export default function BookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { userRole, userName, showNotification, refreshAll } = useApp()

  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [versionConflictVisible, setVersionConflictVisible] = useState(false)
  const [lastError, setLastError] = useState(null)

  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [showModuleModal, setShowModuleModal] = useState(null)
  const [moduleData, setModuleData] = useState({})
  const [newNote, setNewNote] = useState('')
  const [processingRemark, setProcessingRemark] = useState('')
  const [auditNote, setAuditNote] = useState('')

  useEffect(() => {
    fetchDetail()
  }, [id])

  const fetchDetail = async () => {
    setLoading(true)
    setVersionConflictVisible(false)
    try {
      const res = await api.get(`/bookings/${id}`)
      if (res.data.success) {
        setBooking(res.data.data)
      }
    } catch (err) {
      showNotification(err.response?.data?.error || '获取详情失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleProcess = async () => {
    setLastError(null)
    try {
      const res = await api.post(`/bookings/${id}/process`, {
        version: booking.version,
        remark: processingRemark,
        note: auditNote
      })
      if (res.data.success) {
        showNotification(res.data.message, 'success')
        setBooking(res.data.data)
        setProcessingRemark('')
        setAuditNote('')
        setVersionConflictVisible(false)
        await refreshAll()
      }
    } catch (err) {
      const data = err.response?.data
      const code = data?.code
      setLastError(data)
      if (code === 'VERSION_CONFLICT') {
        setVersionConflictVisible(true)
      }
      if (code === 'MISSING_MODULES' && data?.missing_details) {
        showNotification(
          `缺证据：${data.missing_labels?.join('、') || ''}；${data.correction_summary || ''}`,
          'error'
        )
      } else {
        showNotification(data?.error || '处理失败', 'error')
      }
      if (code === 'VERSION_CONFLICT' || code === 'STATUS_CONFLICT') {
        setTimeout(fetchDetail, 600)
      }
    }
  }

  const handleReturn = async () => {
    if (!returnReason.trim()) {
      showNotification('请填写退回原因', 'warning')
      return
    }
    try {
      const res = await api.post(`/bookings/${id}/return`, {
        version: booking.version,
        reason: returnReason
      })
      if (res.data.success) {
        const msg = res.data.warning
          ? `已退回：${res.data.warning}`
          : res.data.message
        showNotification(msg, res.data.warning ? 'warning' : 'success')
        setBooking(res.data.data)
        setShowReturnModal(false)
        setReturnReason('')
        await refreshAll()
      }
    } catch (err) {
      const data = err.response?.data
      const code = data?.code
      setLastError(data)
      if (code === 'VERSION_CONFLICT') setVersionConflictVisible(true)
      showNotification(data?.error || '退回失败', 'error')
    }
  }

  const handleResubmit = async () => {
    setLastError(null)
    try {
      const res = await api.post(`/bookings/${id}/resubmit`, { version: booking.version })
      if (res.data.success) {
        showNotification(res.data.message, 'success')
        setBooking(res.data.data)
        await refreshAll()
      }
    } catch (err) {
      const data = err.response?.data
      const code = data?.code
      setLastError(data)
      if (code === 'MISSING_MODULES' && data?.missing_details) {
        showNotification(
          `仍缺证据：${data.missing_labels?.join('、') || ''}；${data.correction_summary || ''}`,
          'error'
        )
      } else {
        showNotification(data?.error || '重新提交失败', 'error')
      }
      if (code === 'VERSION_CONFLICT') setVersionConflictVisible(true)
    }
  }

  const openModuleModal = (type) => {
    setShowModuleModal(type)
    if (type === 'team_booking_info') {
      setModuleData({
        itinerary: booking.team_booking_info?.itinerary || '',
        requirements: booking.team_booking_info?.requirements || ''
      })
    } else if (type === 'ticket_verification') {
      setModuleData({
        ticket_count: booking.ticket_verification?.ticket_count ?? booking.visitor_count,
        verified_count: booking.ticket_verification?.verified_count ?? booking.visitor_count,
        ticket_type: booking.ticket_verification?.ticket_type || '团队通票'
      })
    } else if (type === 'entry_statistics') {
      setModuleData({
        actual_entry_count: booking.entry_statistics?.actual_entry_count ?? booking.visitor_count,
        entry_time: booking.entry_statistics?.entry_time
          ? dayjs(booking.entry_statistics.entry_time).format('YYYY-MM-DDTHH:mm')
          : dayjs().format('YYYY-MM-DDTHH:mm'),
        exit_time: booking.entry_statistics?.exit_time
          ? dayjs(booking.entry_statistics.exit_time).format('YYYY-MM-DDTHH:mm')
          : dayjs().add(6, 'hour').format('YYYY-MM-DDTHH:mm')
      })
    }
  }

  const handleUpdateModule = async () => {
    try {
      const res = await api.put(`/bookings/${id}/module`, {
        module: showModuleModal,
        version: booking.version,
        ...moduleData
      })
      if (res.data.success) {
        const extra = res.data.all_modules_complete
          ? '；全部证据已补齐 ✓'
          : (res.data.still_missing?.correction_summary || '')
        showNotification(res.data.message + extra, res.data.all_modules_complete ? 'success' : 'info')
        setBooking(res.data.data)
        setShowModuleModal(null)
        await refreshAll()
      }
    } catch (err) {
      const data = err.response?.data
      const code = data?.code
      setLastError(data)
      if (code === 'VERSION_CONFLICT') setVersionConflictVisible(true)
      showNotification(data?.error || '更新失败', 'error')
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    try {
      const res = await api.post(`/bookings/${id}/notes`, { note: newNote })
      if (res.data.success) {
        showNotification('备注添加成功', 'success')
        setNewNote('')
        fetchDetail()
      }
    } catch (err) {
      showNotification(err.response?.data?.error || '添加失败', 'error')
    }
  }

  const actions = booking?.actions_available || {}

  if (loading) return <div className="empty-state">加载中...</div>
  if (!booking) return <div className="empty-state">预约单不存在</div>

  const missingList = booking.missing_modules || []

  return (
    <div>
      <button className="back-btn" onClick={() => navigate('/bookings')}>← 返回列表</button>

      {versionConflictVisible && (
        <div className="alert-banner danger">
          <div className="alert-icon">⚠️</div>
          <div className="alert-body">
            <div className="alert-title">版本冲突：当前页面数据已过期</div>
            <div>
              你当前基于的版本
              <code style={{ background: '#fff', padding: '1px 6px', borderRadius: 3, margin: '0 4px' }}>
                v{lastError?.submitted_version || lastError?.current_version || '?'}
              </code>
              与服务端版本
              <code style={{ background: '#fff', padding: '1px 6px', borderRadius: 3, margin: '0 4px' }}>
                v{booking.version}
              </code>
              不一致。为避免覆盖他人处理结果，<strong>原状态保留未变更</strong>。
              <button
                className="btn btn-sm btn-danger"
                style={{ marginLeft: 10 }}
                onClick={fetchDetail}
              >
                🔄 刷新详情，获取最新数据
              </button>
            </div>
          </div>
        </div>
      )}

      {missingList.length > 0 && (
        <div className="alert-banner danger">
          <div className="alert-icon">📋</div>
          <div className="alert-body">
            <div className="alert-title">
              当前单据缺少 {missingList.length} 项必填证据模块
              {booking.status !== '已同步' && (
                <span className="preserve-tag">校验不通过时原状态保留</span>
              )}
            </div>
            <ul>
              {missingList.map(m => (
                <li key={m.key}>
                  缺【{m.label}】 → 需要
                  <strong style={{ color: '#6941c6' }}>【{m.owner_label}】</strong>
                  &nbsp;补正完成后，才能推进到下一状态
                </li>
              ))}
            </ul>
            <div className="missing-chip-list">
              {missingList.map(m => (
                <span className="missing-chip" key={m.key}>
                  ⛔ 缺 {m.label}
                  <span className="owner">责任：{m.owner_label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {booking.exception_reasons?.length > 0 && (
        <div className="alert-banner warning">
          <div className="alert-icon">⚠️</div>
          <div className="alert-body">
            <div className="alert-title">共 {booking.exception_reasons.length} 条异常 / 补正记录</div>
            <div style={{ fontSize: 12, opacity: .9 }}>
              （时间线下方可查看完整明细）最近一条：
              <strong style={{ marginLeft: 4 }}>
                [{booking.exception_reasons[0].category}] {booking.exception_reasons[0].reason}
              </strong>
              <span style={{ color: '#6b5504', marginLeft: 8 }}>
                — {booking.exception_reasons[0].reporter_label || booking.exception_reasons[0].reporter}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="detail-page">
        <div className="card detail-section">
          <div className="card-header">
            <h3>基本信息</h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span className={`status-tag ${booking.status}`}>{booking.status}</span>
              <span className={`urgency-tag ${booking.urgency}`}>{URGENCY_LABEL[booking.urgency]}</span>
              <span style={{ fontSize: 13, color: '#666' }}>版本号：v{booking.version}</span>
              <span style={{ fontSize: 13, color: '#2d7dd2' }}>当前处理人：{booking.current_handler}</span>
            </div>
          </div>
          <div className="card-body">
            <div className="basic-info-grid">
              <div className="info-item"><span className="label">预约单号：</span><span className="value">{booking.booking_no}</span></div>
              <div className="info-item"><span className="label">团队名称：</span><span className="value">{booking.team_name}</span></div>
              <div className="info-item"><span className="label">联系人：</span><span className="value">{booking.contact_person}</span></div>
              <div className="info-item"><span className="label">联系电话：</span><span className="value">{booking.contact_phone}</span></div>
              <div className="info-item"><span className="label">游客人数：</span><span className="value">{booking.visitor_count}人</span></div>
              <div className="info-item"><span className="label">入园时间：</span><span className="value">{booking.visit_date} {booking.visit_time || ''}</span></div>
              <div className="info-item"><span className="label">当前处理人：</span><span className="value">{booking.current_handler}</span></div>
              <div className="info-item"><span className="label">截止时间：</span>
                <span className="value" style={{
                  color: booking.urgency === 'overdue' ? '#dc3545' : booking.urgency === 'approaching' ? '#ffc107' : ''
                }}>
                  {booking.deadline ? dayjs(booking.deadline).format('YYYY-MM-DD HH:mm') : '-'}
                </span>
              </div>
              <div className="info-item"><span className="label">创建时间：</span><span className="value">{booking.created_at ? dayjs(booking.created_at).format('YYYY-MM-DD HH:mm') : '-'}</span></div>
            </div>
          </div>
        </div>

        <ModuleCard
          title="📋 团队预约模块"
          moduleKey="team_booking_info"
          data={booking.team_booking_info}
          canEdit={actions.can_edit_booking_info}
          onEdit={() => openModuleModal('team_booking_info')}
          children={
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <div><strong>行程安排：</strong>{booking.team_booking_info?.itinerary || '（未填写）'}</div>
              <div style={{ marginTop: 6 }}><strong>特殊需求：</strong>{booking.team_booking_info?.requirements || '（未填写）'}</div>
              <div style={{ marginTop: 6, color: '#999' }}>
                提交人：{booking.team_booking_info?.submitted_by || '-'} |
                提交时间：{booking.team_booking_info?.submitted_at ? dayjs(booking.team_booking_info.submitted_at).format('MM-DD HH:mm') : '-'}
              </div>
            </div>
          }
        />

        <ModuleCard
          title="🎫 票务核销模块"
          moduleKey="ticket_verification"
          data={booking.ticket_verification}
          canEdit={actions.can_edit_ticket}
          onEdit={() => openModuleModal('ticket_verification')}
          children={
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <div><strong>应核票数：</strong>{booking.ticket_verification?.ticket_count || 0} 张</div>
              <div><strong>已核票数：</strong>{booking.ticket_verification?.verified_count || 0} 张</div>
              <div><strong>票种：</strong>{booking.ticket_verification?.ticket_type || '-'}</div>
              <div style={{ marginTop: 6, color: '#999' }}>
                核销人：{booking.ticket_verification?.verified_by || '-'} |
                核销时间：{booking.ticket_verification?.verified_at ? dayjs(booking.ticket_verification.verified_at).format('MM-DD HH:mm') : '-'}
              </div>
            </div>
          }
        />

        <ModuleCard
          title="🚶 入园统计模块"
          moduleKey="entry_statistics"
          data={booking.entry_statistics}
          canEdit={actions.can_edit_entry}
          onEdit={() => openModuleModal('entry_statistics')}
          children={
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <div><strong>实际入园：</strong>{booking.entry_statistics?.actual_entry_count || 0} 人</div>
              <div><strong>入园时间：</strong>{booking.entry_statistics?.entry_time ? dayjs(booking.entry_statistics.entry_time).format('YYYY-MM-DD HH:mm') : '-'}</div>
              <div><strong>离园时间：</strong>{booking.entry_statistics?.exit_time ? dayjs(booking.entry_statistics.exit_time).format('YYYY-MM-DD HH:mm') : '-'}</div>
              <div style={{ marginTop: 6, color: '#999' }}>
                登记人：{booking.entry_statistics?.recorded_by || '-'} |
                登记时间：{booking.entry_statistics?.recorded_at ? dayjs(booking.entry_statistics.recorded_at).format('MM-DD HH:mm') : '-'}
              </div>
            </div>
          }
        />

        <div className="card">
          <div className="card-header">
            <h3>⚠️ 异常原因 / 补正动作记录</h3>
            <span style={{ fontSize: 12, color: '#888' }}>共 {booking.exception_reasons?.length || 0} 条</span>
          </div>
          <div className="card-body">
            {booking.exception_reasons?.length > 0 ? (
              booking.exception_reasons.map(e => (
                <div key={e.id} className="exception-item">
                  <span className="exception-category">{e.category}</span>
                  <strong>{e.reason}</strong>
                  <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
                    {e.reporter_label || e.reporter}（{e.reporter_role}） · {dayjs(e.created_at).format('MM-DD HH:mm')}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">暂无异常记录</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>📝 审计备注</h3>
          </div>
          <div className="card-body">
            {booking.audit_notes?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {booking.audit_notes.map(n => (
                  <div key={n.id} className="note-item">
                    <div>
                      <span className="note-author">{n.author}</span>
                      <span style={{ color: '#999' }}>（{n.author_label || n.author_role}）</span>
                      <span className="note-time">{dayjs(n.created_at).format('MM-DD HH:mm')}</span>
                    </div>
                    <div className="note-content">{n.note}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ flex: 1 }}
                placeholder="添加一条备注..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
              />
              <button className="btn btn-default" onClick={handleAddNote} disabled={!newNote.trim()}>
                添加备注
              </button>
            </div>
          </div>
        </div>

        <div className="card detail-section">
          <div className="card-header">
            <h3>🔄 处理记录（时间线 · 留痕）</h3>
            <span style={{ fontSize: 12, color: '#888' }}>共 {booking.processing_records?.length || 0} 条</span>
          </div>
          <div className="card-body">
            {booking.processing_records?.length > 0 ? (
              <div className="timeline">
                {booking.processing_records.map(r => (
                  <div key={r.id} className="timeline-item">
                    <div className="timeline-action">{r.action}</div>
                    <div className="timeline-meta">
                      {r.operator}（{r.operator_label || r.operator_role}） · {dayjs(r.created_at).format('YYYY-MM-DD HH:mm:ss')}
                      {r.from_status && r.to_status && (
                        <span> · {r.from_status} → <strong>{r.to_status}</strong></span>
                      )}
                    </div>
                    {r.remark && <div className="timeline-remark">{r.remark}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">暂无处理记录</div>
            )}
          </div>
        </div>
      </div>

      <div className="action-bar">
        {actions.can_process && (
          <>
            <input
              style={{ width: 200 }}
              placeholder="处理备注（可选）"
              value={processingRemark}
              onChange={e => setProcessingRemark(e.target.value)}
            />
            {userRole === 'manager' && (
              <input
                style={{ width: 200 }}
                placeholder="复核审计备注（可选）"
                value={auditNote}
                onChange={e => setAuditNote(e.target.value)}
              />
            )}
            <button className="btn btn-primary" onClick={handleProcess}>
              {userRole === 'dispatcher' && '审核通过 → 提交景区经理'}
              {userRole === 'ticketing' && '核销完成 → 提交景区经理'}
              {userRole === 'manager' && '复核通过 → 归档'}
            </button>
          </>
        )}
        {actions.can_return && (
          <button className="btn btn-warning" onClick={() => setShowReturnModal(true)}>
            退回补正
          </button>
        )}
        {actions.can_resubmit && (
          <button className="btn btn-primary" onClick={handleResubmit}>
            补正后重新提交
          </button>
        )}
        {!actions.can_process && !actions.can_return && !actions.can_resubmit && booking.status !== '已同步' && (
          <div style={{ color: '#b54708', fontSize: 13, marginRight: 'auto' }}>
            🔒 当前角色 / 状态下无可用办理动作（请切换角色或补正材料）
          </div>
        )}
        <button className="btn btn-default" onClick={fetchDetail}>🔄 刷新详情</button>
        <button className="btn btn-default" onClick={() => navigate('/bookings')}>返回列表</button>
      </div>

      {showReturnModal && (
        <div className="modal-overlay" onClick={() => setShowReturnModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              退回补正
              <button className="modal-close" onClick={() => setShowReturnModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert-banner warning">
                <div className="alert-icon">⚠️</div>
                <div className="alert-body">
                  <div className="alert-title">退回后进入「退回补正」状态</div>
                  <div>
                    系统会自动检测缺失的团队预约 / 票务核销 / 入园统计模块，
                    在异常原因里逐条记录<strong>需谁补正</strong>，并在详情页高亮显示。
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>退回原因 *</label>
                <textarea
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  placeholder="请详细填写退回原因，将存入异常原因与处理记录留痕..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowReturnModal(false)}>取消</button>
              <button className="btn btn-danger" onClick={handleReturn}>确认退回</button>
            </div>
          </div>
        </div>
      )}

      {showModuleModal && (
        <div className="modal-overlay" onClick={() => setShowModuleModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              编辑{showModuleModal === 'team_booking_info' ? '团队预约' : showModuleModal === 'ticket_verification' ? '票务核销' : '入园统计'}
              <button className="modal-close" onClick={() => setShowModuleModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {showModuleModal === 'team_booking_info' && (
                <>
                  <div className="form-group">
                    <label>行程安排</label>
                    <textarea
                      value={moduleData.itinerary}
                      onChange={e => setModuleData({ ...moduleData, itinerary: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>特殊需求</label>
                    <textarea
                      value={moduleData.requirements}
                      onChange={e => setModuleData({ ...moduleData, requirements: e.target.value })}
                    />
                  </div>
                </>
              )}
              {showModuleModal === 'ticket_verification' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>应核票数 *</label>
                      <input type="number" value={moduleData.ticket_count}
                        onChange={e => setModuleData({ ...moduleData, ticket_count: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>已核票数 *</label>
                      <input type="number" value={moduleData.verified_count}
                        onChange={e => setModuleData({ ...moduleData, verified_count: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>票种</label>
                    <input value={moduleData.ticket_type}
                      onChange={e => setModuleData({ ...moduleData, ticket_type: e.target.value })} />
                  </div>
                </>
              )}
              {showModuleModal === 'entry_statistics' && (
                <>
                  <div className="form-group">
                    <label>实际入园人数</label>
                    <input type="number" value={moduleData.actual_entry_count}
                      onChange={e => setModuleData({ ...moduleData, actual_entry_count: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>入园时间</label>
                      <input type="datetime-local" value={moduleData.entry_time}
                        onChange={e => setModuleData({ ...moduleData, entry_time: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>离园时间</label>
                      <input type="datetime-local" value={moduleData.exit_time}
                        onChange={e => setModuleData({ ...moduleData, exit_time: e.target.value })} />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowModuleModal(null)}>取消</button>
              <button className="btn btn-primary" onClick={handleUpdateModule}>保存（版本 v{booking.version}）</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModuleCard({ title, moduleKey, data, canEdit, onEdit, children }) {
  const isComplete = !!data?.is_complete
  const ownerLabel = data?.owner_label || '—'
  const ownerRole = data?.owner_role
  return (
    <div className="card">
      <div className="card-header">
        <h3>
          {title}
          <span className="owner-chip">责任人：{ownerLabel}</span>
        </h3>
        {canEdit && (
          <button className="btn btn-sm btn-default" onClick={onEdit}>
            编辑（{ownerRole}）
          </button>
        )}
      </div>
      <div className="card-body">
        <div className={`module-card ${isComplete ? 'complete' : 'incomplete'}`}>
          <div className="module-header">
            <span className="module-title">模块信息：{moduleKey}</span>
            <span className={`complete-badge ${isComplete ? 'yes' : 'no'}`}>
              {isComplete ? '✓ 已完善' : '✗ 待完善'}
            </span>
          </div>
          {children}
          {!isComplete && (
            <div className="alert-banner warning" style={{ marginTop: 12, marginBottom: 0 }}>
              <div className="alert-icon">🔧</div>
              <div className="alert-body">
                此模块未完善，推进状态时会<strong>保留原状态</strong>并拦截。
                需要【<strong style={{ color: '#6941c6' }}>{ownerLabel}</strong>】补正后才能流转。
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
