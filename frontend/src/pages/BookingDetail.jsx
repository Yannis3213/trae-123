import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../api'
import { useApp } from '../context/AppContext.jsx'

const URGENCY_LABEL = {
  normal: '正常',
  approaching: '临期',
  overdue: '逾期'
}

export default function BookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { userRole, userName, showNotification, refreshAll } = useApp()

  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
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
    if (!window.confirm(`确认将单据从「${booking.status}」推进到下一状态？`)) return
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
        await refreshAll()
      }
    } catch (err) {
      const data = err.response?.data
      showNotification(data?.error || '处理失败', 'error')
      if (data?.code === 'VERSION_CONFLICT') {
        fetchDetail()
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
        showNotification(res.data.warning || res.data.message, res.data.warning ? 'warning' : 'success')
        setBooking(res.data.data)
        setShowReturnModal(false)
        setReturnReason('')
        await refreshAll()
      }
    } catch (err) {
      showNotification(err.response?.data?.error || '退回失败', 'error')
    }
  }

  const handleResubmit = async () => {
    try {
      const res = await api.post(`/bookings/${id}/resubmit`, { version: booking.version })
      if (res.data.success) {
        showNotification(res.data.message, 'success')
        setBooking(res.data.data)
        await refreshAll()
      }
    } catch (err) {
      const data = err.response?.data
      showNotification(data?.error || '重新提交失败', 'error')
      if (data?.code === 'MISSING_MODULES' && data?.missing_modules) {
        showNotification(`缺少：${data.missing_modules.join('、')}`, 'error')
      }
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
        ticket_count: booking.ticket_verification?.ticket_count || booking.visitor_count,
        verified_count: booking.ticket_verification?.verified_count || booking.visitor_count,
        ticket_type: booking.ticket_verification?.ticket_type || '团队通票'
      })
    } else if (type === 'entry_statistics') {
      setModuleData({
        actual_entry_count: booking.entry_statistics?.actual_entry_count || booking.visitor_count,
        entry_time: booking.entry_statistics?.entry_time ? dayjs(booking.entry_statistics.entry_time).format('YYYY-MM-DDTHH:mm') : dayjs().format('YYYY-MM-DDTHH:mm'),
        exit_time: booking.entry_statistics?.exit_time ? dayjs(booking.entry_statistics.exit_time).format('YYYY-MM-DDTHH:mm') : dayjs().add(6, 'hour').format('YYYY-MM-DDTHH:mm')
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
        showNotification(res.data.message, 'success')
        setBooking(res.data.data)
        setShowModuleModal(null)
        await refreshAll()
      }
    } catch (err) {
      showNotification(err.response?.data?.error || '更新失败', 'error')
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

  const canProcess = () => {
    if (booking.status === '已同步') return false
    if (userRole === 'dispatcher' && booking.status === '待审核') return true
    if (userRole === 'ticketing' && booking.status === '待审核') return true
    if (userRole === 'manager' && booking.status === '审核通过') return true
    return false
  }

  const canReturn = () => {
    if (booking.status === '已同步' || booking.status === '退回补正') return false
    if (userRole === 'dispatcher' && booking.status === '待审核') return true
    if (userRole === 'manager') return true
    return false
  }

  const canResubmit = () => {
    return booking.status === '退回补正' && userRole === 'dispatcher'
  }

  const canEditModule = (type) => {
    if (booking.status === '已同步') return false
    if (type === 'ticket_verification') return userRole === 'ticketing' || userRole === 'dispatcher'
    return userRole === 'dispatcher'
  }

  if (loading) {
    return <div className="empty-state">加载中...</div>
  }
  if (!booking) {
    return <div className="empty-state">预约单不存在</div>
  }

  return (
    <div>
      <button className="back-btn" onClick={() => navigate('/bookings')}>← 返回列表</button>

      {(booking.exception_reasons?.length > 0 || booking.status === '退回补正') && (
        <div className="warning-box">
          ⚠️ 该预约单存在 {booking.exception_reasons?.length || 0} 条异常记录：
          {booking.exception_reasons?.slice(0, 2).map((e, i) => (
            <span key={i} style={{ marginLeft: 8, fontWeight: 600 }}>
              [{e.category}] {e.reason}
            </span>
          ))}
        </div>
      )}

      <div className="detail-page">
        <div className="card detail-section">
          <div className="card-header">
            <h3>基本信息</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              <span className={`status-tag ${booking.status}`}>{booking.status}</span>
              <span className={`urgency-tag ${booking.urgency}`}>{URGENCY_LABEL[booking.urgency]}</span>
              <span style={{ fontSize: 13, color: '#666' }}>版本号：v{booking.version}</span>
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
              <div className="info-item"><span className="label">截止时间：</span><span className="value" style={{ color: booking.urgency === 'overdue' ? '#dc3545' : booking.urgency === 'approaching' ? '#ffc107' : '' }}>
                {booking.deadline ? dayjs(booking.deadline).format('YYYY-MM-DD HH:mm') : '-'}
              </span></div>
              <div className="info-item"><span className="label">创建时间：</span><span className="value">{booking.created_at ? dayjs(booking.created_at).format('YYYY-MM-DD HH:mm') : '-'}</span></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>📋 团队预约模块</h3>
            {canEditModule('team_booking_info') && (
              <button className="btn btn-sm btn-default" onClick={() => openModuleModal('team_booking_info')}>编辑</button>
            )}
          </div>
          <div className="card-body">
            <div className={`module-card ${booking.team_booking_info?.is_complete ? 'complete' : 'incomplete'}`}>
              <div className="module-header">
                <span className="module-title">团队预约信息</span>
                <span className={`complete-badge ${booking.team_booking_info?.is_complete ? 'yes' : 'no'}`}>
                  {booking.team_booking_info?.is_complete ? '✓ 已完善' : '✗ 待完善'}
                </span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div><strong>行程安排：</strong>{booking.team_booking_info?.itinerary || '（未填写）'}</div>
                <div style={{ marginTop: 6 }}><strong>特殊需求：</strong>{booking.team_booking_info?.requirements || '（未填写）'}</div>
                <div style={{ marginTop: 6, color: '#999' }}>
                  提交人：{booking.team_booking_info?.submitted_by || '-'} |
                  提交时间：{booking.team_booking_info?.submitted_at ? dayjs(booking.team_booking_info.submitted_at).format('MM-DD HH:mm') : '-'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>🎫 票务核销模块</h3>
            {canEditModule('ticket_verification') && (
              <button className="btn btn-sm btn-default" onClick={() => openModuleModal('ticket_verification')}>编辑</button>
            )}
          </div>
          <div className="card-body">
            <div className={`module-card ${booking.ticket_verification?.is_complete ? 'complete' : 'incomplete'}`}>
              <div className="module-header">
                <span className="module-title">票务核销信息</span>
                <span className={`complete-badge ${booking.ticket_verification?.is_complete ? 'yes' : 'no'}`}>
                  {booking.ticket_verification?.is_complete ? '✓ 已完善' : '✗ 待完善'}
                </span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div><strong>应核票数：</strong>{booking.ticket_verification?.ticket_count || 0} 张</div>
                <div><strong>已核票数：</strong>{booking.ticket_verification?.verified_count || 0} 张</div>
                <div><strong>票种：</strong>{booking.ticket_verification?.ticket_type || '-'}</div>
                <div style={{ marginTop: 6, color: '#999' }}>
                  核销人：{booking.ticket_verification?.verified_by || '-'} |
                  核销时间：{booking.ticket_verification?.verified_at ? dayjs(booking.ticket_verification.verified_at).format('MM-DD HH:mm') : '-'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>🚶 入园统计模块</h3>
            {canEditModule('entry_statistics') && (
              <button className="btn btn-sm btn-default" onClick={() => openModuleModal('entry_statistics')}>编辑</button>
            )}
          </div>
          <div className="card-body">
            <div className={`module-card ${booking.entry_statistics?.is_complete ? 'complete' : 'incomplete'}`}>
              <div className="module-header">
                <span className="module-title">入园统计信息</span>
                <span className={`complete-badge ${booking.entry_statistics?.is_complete ? 'yes' : 'no'}`}>
                  {booking.entry_statistics?.is_complete ? '✓ 已完善' : '✗ 待完善'}
                </span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div><strong>实际入园：</strong>{booking.entry_statistics?.actual_entry_count || 0} 人</div>
                <div><strong>入园时间：</strong>{booking.entry_statistics?.entry_time ? dayjs(booking.entry_statistics.entry_time).format('YYYY-MM-DD HH:mm') : '-'}</div>
                <div><strong>离园时间：</strong>{booking.entry_statistics?.exit_time ? dayjs(booking.entry_statistics.exit_time).format('YYYY-MM-DD HH:mm') : '-'}</div>
                <div style={{ marginTop: 6, color: '#999' }}>
                  登记人：{booking.entry_statistics?.recorded_by || '-'} |
                  登记时间：{booking.entry_statistics?.recorded_at ? dayjs(booking.entry_statistics.recorded_at).format('MM-DD HH:mm') : '-'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>⚠️ 异常原因记录</h3>
          </div>
          <div className="card-body">
            {booking.exception_reasons?.length > 0 ? (
              booking.exception_reasons.map(e => (
                <div key={e.id} className="exception-item">
                  <span className="exception-category">{e.category}</span>
                  <strong>{e.reason}</strong>
                  <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
                    {e.reporter}（{e.reporter_role}） · {dayjs(e.created_at).format('MM-DD HH:mm')}
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
                      <span style={{ color: '#999' }}>（{n.author_role}）</span>
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
            <h3>🔄 处理记录（时间线）</h3>
          </div>
          <div className="card-body">
            {booking.processing_records?.length > 0 ? (
              <div className="timeline">
                {booking.processing_records.map(r => (
                  <div key={r.id} className="timeline-item">
                    <div className="timeline-action">{r.action}</div>
                    <div className="timeline-meta">
                      {r.operator}（{r.operator_role}） · {dayjs(r.created_at).format('YYYY-MM-DD HH:mm:ss')}
                      {r.from_status && r.to_status && (
                        <span> · {r.from_status} → {r.to_status}</span>
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
        {canProcess() && (
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
        {canReturn() && (
          <button className="btn btn-warning" onClick={() => setShowReturnModal(true)}>退回补正</button>
        )}
        {canResubmit() && (
          <button className="btn btn-primary" onClick={handleResubmit}>补正后重新提交</button>
        )}
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
              <div className="warning-box">
                ⚠️ 退回后将进入「退回补正」状态，需要现场调度补正后重新提交。
                系统会自动检测缺失的模块并提示需谁补正。
              </div>
              <div className="form-group">
                <label>退回原因 *</label>
                <textarea
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  placeholder="请详细填写退回原因..."
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
                      <input type="number" value={moduleData.ticket_count} onChange={e => setModuleData({ ...moduleData, ticket_count: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>已核票数 *</label>
                      <input type="number" value={moduleData.verified_count} onChange={e => setModuleData({ ...moduleData, verified_count: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>票种</label>
                    <input value={moduleData.ticket_type} onChange={e => setModuleData({ ...moduleData, ticket_type: e.target.value })} />
                  </div>
                </>
              )}
              {showModuleModal === 'entry_statistics' && (
                <>
                  <div className="form-group">
                    <label>实际入园人数</label>
                    <input type="number" value={moduleData.actual_entry_count} onChange={e => setModuleData({ ...moduleData, actual_entry_count: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>入园时间</label>
                      <input type="datetime-local" value={moduleData.entry_time} onChange={e => setModuleData({ ...moduleData, entry_time: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>离园时间</label>
                      <input type="datetime-local" value={moduleData.exit_time} onChange={e => setModuleData({ ...moduleData, exit_time: e.target.value })} />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowModuleModal(null)}>取消</button>
              <button className="btn btn-primary" onClick={handleUpdateModule}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
