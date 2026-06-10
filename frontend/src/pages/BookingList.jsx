import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../api'
import { useApp } from '../context/AppContext.jsx'

const URGENCY_LABEL = {
  normal: '正常',
  approaching: '临期',
  overdue: '逾期'
}

export default function BookingList() {
  const navigate = useNavigate()
  const { bookings, loading, fetchBookings, refreshAll, showNotification, userRole } = useApp()

  const [filterStatus, setFilterStatus] = useState('')
  const [filterUrgency, setFilterUrgency] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchAction, setBatchAction] = useState('process')
  const [batchReason, setBatchReason] = useState('')
  const [batchResult, setBatchResult] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newBooking, setNewBooking] = useState({
    team_name: '', contact_person: '', contact_phone: '',
    visitor_count: '', visit_date: '', visit_time: '',
    itinerary: '', requirements: ''
  })

  useEffect(() => {
    fetchBookings({ status: filterStatus, urgency: filterUrgency })
  }, [fetchBookings, filterStatus, filterUrgency])

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === bookings.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(bookings.map(b => b.id))
    }
  }

  const handleBatchProcess = async () => {
    if (selectedIds.length === 0) {
      showNotification('请先选择要处理的预约单', 'warning')
      return
    }
    try {
      const res = await api.post('/bookings/batch-process', {
        ids: selectedIds,
        action: batchAction,
        reason: batchReason
      })
      if (res.data.success) {
        setBatchResult(res.data.data)
        showNotification(res.data.message, 'success')
        await refreshAll()
        setSelectedIds([])
      }
    } catch (err) {
      showNotification(err.response?.data?.error || '批量处理失败', 'error')
    }
  }

  const handleCreate = async () => {
    if (!newBooking.team_name || !newBooking.contact_person || !newBooking.contact_phone || !newBooking.visitor_count || !newBooking.visit_date) {
      showNotification('请填写必填字段', 'warning')
      return
    }
    try {
      const res = await api.post('/bookings', newBooking)
      if (res.data.success) {
        showNotification('创建成功', 'success')
        setShowCreateModal(false)
        setNewBooking({ team_name: '', contact_person: '', contact_phone: '', visitor_count: '', visit_date: '', visit_time: '', itinerary: '', requirements: '' })
        await refreshAll()
      }
    } catch (err) {
      showNotification(err.response?.data?.error || '创建失败', 'error')
    }
  }

  const canProcess = (booking) => {
    if (userRole === 'dispatcher' || userRole === 'manager') {
      return booking.status !== '已同步'
    }
    if (userRole === 'ticketing') {
      return booking.status === '待审核'
    }
    return false
  }

  const showBatchButton = userRole === 'dispatcher' || userRole === 'manager'

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>团队预约单列表</h3>
        </div>
        <div className="card-body">
          <div className="toolbar">
            <div className="filter-group">
              <label>状态：</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">全部</option>
                <option value="待审核">待审核</option>
                <option value="审核通过">审核通过</option>
                <option value="已同步">已同步</option>
                <option value="退回补正">退回补正</option>
              </select>
            </div>

            <div className="filter-group">
              <label>紧急度：</label>
              <select value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)}>
                <option value="">全部</option>
                <option value="normal">正常</option>
                <option value="approaching">临期</option>
                <option value="overdue">逾期</option>
              </select>
            </div>

            {userRole === 'dispatcher' && (
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                + 新建预约单
              </button>
            )}

            {showBatchButton && (
              <>
                <button
                  className="btn btn-primary"
                  disabled={selectedIds.length === 0}
                  onClick={() => { setBatchAction('process'); setBatchResult(null); setShowBatchModal(true) }}
                >
                  批量处理（{selectedIds.length}）
                </button>
                <button
                  className="btn btn-warning"
                  disabled={selectedIds.length === 0}
                  onClick={() => { setBatchAction('return'); setBatchResult(null); setShowBatchModal(true) }}
                >
                  批量退回
                </button>
                {userRole === 'manager' && (
                  <button
                    className="btn btn-danger"
                    disabled={selectedIds.length === 0}
                    onClick={() => { setBatchAction('advance_overdue'); setBatchResult(null); setShowBatchModal(true) }}
                  >
                    逾期批量推进
                  </button>
                )}
              </>
            )}
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {showBatchButton && (
                    <th className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={bookings.length > 0 && selectedIds.length === bookings.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th>预约单号</th>
                  <th>团队名称</th>
                  <th>联系人</th>
                  <th>人数</th>
                  <th>入园日期</th>
                  <th>状态</th>
                  <th>紧急度</th>
                  <th>当前处理人</th>
                  <th>截止时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={showBatchButton ? 11 : 10} className="empty-state">加载中...</td></tr>
                ) : bookings.length === 0 ? (
                  <tr><td colSpan={showBatchButton ? 11 : 10} className="empty-state">暂无数据</td></tr>
                ) : (
                  bookings.map(b => (
                    <tr key={b.id}>
                      {showBatchButton && (
                        <td className="checkbox-col">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(b.id)}
                            onChange={() => toggleSelect(b.id)}
                            disabled={!canProcess(b)}
                          />
                        </td>
                      )}
                      <td><span className="link" onClick={() => navigate(`/bookings/${b.id}`)}>{b.booking_no}</span></td>
                      <td>{b.team_name}</td>
                      <td>{b.contact_person}（{b.contact_phone}）</td>
                      <td>{b.visitor_count}人</td>
                      <td>{b.visit_date} {b.visit_time || ''}</td>
                      <td><span className={`status-tag ${b.status}`}>{b.status}</span></td>
                      <td><span className={`urgency-tag ${b.urgency}`}>{URGENCY_LABEL[b.urgency]}</span></td>
                      <td>{b.current_handler}</td>
                      <td style={{ color: b.urgency === 'overdue' ? '#dc3545' : b.urgency === 'approaching' ? '#ffc107' : '' }}>
                        {b.deadline ? dayjs(b.deadline).format('MM-DD HH:mm') : '-'}
                      </td>
                      <td>
                        <button className="btn btn-sm btn-default" onClick={() => navigate(`/bookings/${b.id}`)}>
                          详情/办理
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showBatchModal && (
        <div className="modal-overlay" onClick={() => setShowBatchModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              {batchAction === 'process' && '批量处理预约单'}
              {batchAction === 'return' && '批量退回预约单'}
              {batchAction === 'advance_overdue' && '逾期批量推进'}
              <button className="modal-close" onClick={() => setShowBatchModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16 }}>已选择 <strong>{selectedIds.length}</strong> 张预约单进行批量处理。</p>

              {batchAction === 'return' && (
                <div className="form-group">
                  <label>退回原因</label>
                  <textarea
                    value={batchReason}
                    onChange={e => setBatchReason(e.target.value)}
                    placeholder="请填写退回原因..."
                  />
                </div>
              )}

              {batchAction === 'advance_overdue' && (
                <div className="warning-box">
                  ⚠️ 此操作仅对「待审核」且「已逾期」的单据生效，将把处理人推进至景区经理。
                </div>
              )}

              {batchResult && (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    成功 <strong style={{ color: '#28a745' }}>{batchResult.success_count}</strong> 条，
                    失败 <strong style={{ color: '#dc3545' }}>{batchResult.fail_count}</strong> 条
                  </div>
                  <div className="batch-result-list">
                    {batchResult.results.map((r, idx) => (
                      <div key={idx} className={`batch-result-item ${r.success ? 'success' : 'fail'}`}>
                        <span>{r.booking_no || `#${r.id}`}</span>
                        <span>{r.success ? `✓ ${r.new_status || r.new_handler || '成功'}` : `✗ ${r.reason}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowBatchModal(false)}>
                {batchResult ? '关闭' : '取消'}
              </button>
              {!batchResult && (
                <button className="btn btn-primary" onClick={handleBatchProcess}>确认执行</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              新建团队预约单
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>团队名称 *</label>
                  <input value={newBooking.team_name} onChange={e => setNewBooking({ ...newBooking, team_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>联系人 *</label>
                  <input value={newBooking.contact_person} onChange={e => setNewBooking({ ...newBooking, contact_person: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>联系电话 *</label>
                  <input value={newBooking.contact_phone} onChange={e => setNewBooking({ ...newBooking, contact_phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>游客人数 *</label>
                  <input type="number" value={newBooking.visitor_count} onChange={e => setNewBooking({ ...newBooking, visitor_count: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>入园日期 *</label>
                  <input type="date" value={newBooking.visit_date} onChange={e => setNewBooking({ ...newBooking, visit_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>入园时间</label>
                  <input type="time" value={newBooking.visit_time} onChange={e => setNewBooking({ ...newBooking, visit_time: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>行程安排</label>
                <textarea value={newBooking.itinerary} onChange={e => setNewBooking({ ...newBooking, itinerary: e.target.value })} placeholder="请填写团队行程安排..." />
              </div>
              <div className="form-group">
                <label>特殊需求</label>
                <textarea value={newBooking.requirements} onChange={e => setNewBooking({ ...newBooking, requirements: e.target.value })} placeholder="请填写特殊需求（导游、团餐等）..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowCreateModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleCreate}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
