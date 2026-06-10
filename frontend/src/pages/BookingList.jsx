import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../api'
import { useApp } from '../context/AppContext.jsx'

const URGENCY_LABEL = { normal: '正常', approaching: '临期', overdue: '逾期' }
const FAIL_CODE_LABEL = {
  VERSION_CONFLICT: '版本冲突', STATUS_CONFLICT: '状态冲突', WRONG_HANDLER: '处理人不匹配',
  PERMISSION_DENIED: '角色越权', MISSING_MODULES: '缺必填证据',
  MISSING_FIELDS: '缺必填字段', NOT_FOUND: '单据不存在',
  NOT_OVERDUE: '非逾期', DUPLICATE_ACTION: '重复操作', DB_ERROR: '数据库异常'
}

export default function BookingList() {
  const navigate = useNavigate()
  const { bookings, missingSummary, loading, fetchBookings, refreshAll, showNotification, userRole } = useApp()

  const [filterStatus, setFilterStatus] = useState('')
  const [filterUrgency, setFilterUrgency] = useState('')
  const [filterMissing, setFilterMissing] = useState('')
  const [selectedIds, setSelectedIds] = useState([])

  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchAction, setBatchAction] = useState('process')
  const [batchReason, setBatchReason] = useState('')
  const [batchResult, setBatchResult] = useState(null)
  const [batchLoading, setBatchLoading] = useState(false)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [newBooking, setNewBooking] = useState({
    team_name: '', contact_person: '', contact_phone: '',
    visitor_count: '', visit_date: '', visit_time: '',
    itinerary: '', requirements: ''
  })

  useEffect(() => {
    fetchBookings({ status: filterStatus, urgency: filterUrgency, missing_module: filterMissing })
  }, [fetchBookings, filterStatus, filterUrgency, filterMissing])

  const displayList = bookings

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }
  const toggleSelectAll = () => {
    if (selectedIds.length === displayList.length) setSelectedIds([])
    else setSelectedIds(displayList.map(b => b.id))
  }

  const openBatch = (action) => {
    if (selectedIds.length === 0) {
      showNotification('请先选择要处理的预约单', 'warning')
      return
    }
    setBatchAction(action)
    setBatchResult(null)
    setBatchReason('')
    setShowBatchModal(true)
  }

  const handleBatchProcess = async () => {
    setBatchLoading(true)
    try {
      const res = await api.post('/bookings/batch-process', {
        ids: selectedIds, action: batchAction, reason: batchReason
      })
      if (res.data.success) {
        setBatchResult(res.data.data)
        showNotification(res.data.message,
          res.data.data.fail_count > 0 ? 'warning' : 'success')
        await refreshAll()
        setSelectedIds([])
      }
    } catch (err) {
      showNotification(err.response?.data?.error || '批量处理失败', 'error')
    } finally {
      setBatchLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newBooking.team_name || !newBooking.contact_person || !newBooking.contact_phone
        || !newBooking.visitor_count || !newBooking.visit_date) {
      showNotification('请填写必填字段', 'warning')
      return
    }
    setCreateLoading(true)
    try {
      const res = await api.post('/bookings', newBooking)
      if (res.data.success) {
        showNotification(res.data.message, 'success')
        setShowCreateModal(false)
        setNewBooking({ team_name: '', contact_person: '', contact_phone: '',
          visitor_count: '', visit_date: '', visit_time: '', itinerary: '', requirements: '' })
        await refreshAll()
      }
    } catch (err) {
      const data = err.response?.data
      const extra = data?.missing_fields ? `（缺：${data.missing_fields.join('、')}）` : ''
      showNotification((data?.error || '创建失败') + extra, 'error')
    } finally {
      setCreateLoading(false)
    }
  }

  const canProcess = (booking) => {
    if (userRole === 'dispatcher' || userRole === 'manager') {
      return booking.status !== '已同步'
    }
    if (userRole === 'ticketing') return booking.status === '待审核'
    return false
  }
  const showBatchButton = userRole === 'dispatcher' || userRole === 'manager'

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>团队预约单列表（共 {displayList.length} 条）</h3>
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
            <div className="filter-group">
              <label>缺模块：</label>
              <select value={filterMissing} onChange={e => setFilterMissing(e.target.value)}>
                <option value="">全部</option>
                <option value="team_booking_info">缺团队预约</option>
                <option value="ticket_verification">缺票务核销</option>
                <option value="entry_statistics">缺入园统计</option>
              </select>
            </div>

            {Object.keys(missingSummary).length > 0 && (
              <div className="missing-chip-list" style={{ margin: 0 }}>
                {Object.entries(missingSummary).map(([k, v]) => (
                  <span key={k} className="missing-chip" onClick={() => setFilterMissing(k)} style={{ cursor: 'pointer' }}>
                    ⛔ 缺 {v.label} × {v.count}
                    <span className="owner">责任：{v.owner_label}</span>
                  </span>
                ))}
                {filterMissing && (
                  <span
                    className="missing-chip"
                    style={{ background: '#eef3ff', color: '#1a4a8a', borderColor: '#bcd0f5', cursor: 'pointer' }}
                    onClick={() => setFilterMissing('')}
                  >✕ 清除缺模块筛选</span>
                )}
              </div>
            )}

            {userRole === 'dispatcher' && (
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                + 新建预约单
              </button>
            )}

            {showBatchButton && (
              <>
                <button className="btn btn-primary" disabled={selectedIds.length === 0}
                  onClick={() => openBatch('process')}>
                  批量处理（{selectedIds.length}）
                </button>
                <button className="btn btn-warning" disabled={selectedIds.length === 0}
                  onClick={() => openBatch('return')}>
                  批量退回
                </button>
                {userRole === 'manager' && (
                  <button className="btn btn-danger" disabled={selectedIds.length === 0}
                    onClick={() => openBatch('advance_overdue')}>
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
                      <input type="checkbox"
                        checked={displayList.length > 0 && selectedIds.length === displayList.length}
                        onChange={toggleSelectAll} />
                    </th>
                  )}
                  <th>预约单号</th>
                  <th>团队名称</th>
                  <th>联系人/电话</th>
                  <th>人数</th>
                  <th>入园日期</th>
                  <th>状态</th>
                  <th>紧急度</th>
                  <th>当前处理人</th>
                  <th>缺证据模块</th>
                  <th>截止时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={showBatchButton ? 12 : 11} className="empty-state">加载中...</td></tr>
                ) : displayList.length === 0 ? (
                  <tr><td colSpan={showBatchButton ? 12 : 11} className="empty-state">暂无数据</td></tr>
                ) : (
                  displayList.map(b => (
                    <tr key={b.id}>
                      {showBatchButton && (
                        <td className="checkbox-col">
                          <input type="checkbox" checked={selectedIds.includes(b.id)}
                            onChange={() => toggleSelect(b.id)}
                            disabled={!canProcess(b)} />
                        </td>
                      )}
                      <td>
                        <span className="link" onClick={() => navigate(`/bookings/${b.id}`)}>
                          {b.booking_no}
                        </span>
                        <span style={{ fontSize: 11, color: '#999', marginLeft: 6 }}>v{b.version}</span>
                      </td>
                      <td>{b.team_name}</td>
                      <td>{b.contact_person}<br /><span style={{ color: '#888', fontSize: 12 }}>{b.contact_phone}</span></td>
                      <td>{b.visitor_count}人</td>
                      <td>{b.visit_date} {b.visit_time || ''}</td>
                      <td><span className={`status-tag ${b.status}`}>{b.status}</span></td>
                      <td><span className={`urgency-tag ${b.urgency}`}>{URGENCY_LABEL[b.urgency]}</span></td>
                      <td>{b.current_handler}</td>
                      <td>
                        {b.missing_modules && b.missing_modules.length > 0 ? (
                          <div className="missing-chip-list" style={{ margin: 0 }}>
                            {b.missing_modules.map(m => (
                              <span key={m.key} className="missing-chip">
                                {m.label}<span className="owner">{m.owner_label}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#28a745', fontSize: 12 }}>✓ 齐全</span>
                        )}
                      </td>
                      <td style={{
                        color: b.urgency === 'overdue' ? '#dc3545' : b.urgency === 'approaching' ? '#ffc107' : ''
                      }}>
                        {b.deadline ? dayjs(b.deadline).format('MM-DD HH:mm') : '-'}
                      </td>
                      <td>
                        <button className="btn btn-sm btn-default"
                          onClick={() => navigate(`/bookings/${b.id}`)}>详情/办理</button>
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
        <div className="modal-overlay" onClick={() => !batchLoading && setShowBatchModal(false)}>
          <div className="modal" style={{ width: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              {batchAction === 'process' && '批量处理预约单'}
              {batchAction === 'return' && '批量退回预约单'}
              {batchAction === 'advance_overdue' && '逾期批量推进'}
              <button className="modal-close"
                onClick={() => !batchLoading && setShowBatchModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12 }}>
                已选择 <strong>{selectedIds.length}</strong> 张预约单进行
                <strong>
                  {batchAction === 'process' ? '批量处理' :
                   batchAction === 'return' ? '批量退回补正' : '逾期批量推进至景区经理'}
                </strong>：
              </p>

              {batchAction === 'return' && (
                <div className="form-group">
                  <label>退回原因 *</label>
                  <textarea value={batchReason} onChange={e => setBatchReason(e.target.value)}
                    placeholder="（批量退回必填）请填写退回原因，将存入每条单据的异常原因..." />
                </div>
              )}

              {batchAction === 'advance_overdue' && (
                <div className="alert-banner warning">
                  <div className="alert-icon">⚠️</div>
                  <div className="alert-body">
                    <div className="alert-title">仅对「待审核」且「已逾期」的单据生效</div>
                    <div>会将处理人推进至景区经理；缺证据模块会继续保留异常原因并提示补正责任人。非逾期 / 非待审核 / 已在景区经理处 → 都会被逐条拦截，并给出具体失败原因。</div>
                  </div>
                </div>
              )}

              {batchAction === 'process' && (
                <div className="alert-banner info">
                  <div className="alert-icon">🔍</div>
                  <div className="alert-body">
                    <div className="alert-title">逐条校验：角色 / 当前处理人 / 状态 / 版本 / 三模块必填证据</div>
                    <div>任一校验不通过都会<strong>保留原状态</strong>，给出失败原因（缺证据时还会提示需谁补正）。</div>
                  </div>
                </div>
              )}

              {batchResult && (
                <div>
                  <div style={{ display: 'flex', gap: 24, marginBottom: 12, padding: '10px 14px', background: '#f8f9fa', borderRadius: 6 }}>
                    <div>成功：<strong style={{ color: '#28a745' }}>{batchResult.success_count}</strong></div>
                    <div>失败：<strong style={{ color: '#dc3545' }}>{batchResult.fail_count}</strong></div>
                    <div>总计：{batchResult.results.length}</div>
                  </div>
                  <div className="batch-result-list" style={{ maxHeight: 360 }}>
                    {batchResult.results.map((r, idx) => (
                      <div key={idx} className={`batch-result-item ${r.success ? 'success' : 'fail'}`}
                        style={{ display: 'block', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ fontWeight: 600 }}>
                            {r.booking_no || `#${r.id}`}
                            <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12 }}>
                              {r.success ? `✓ ${r.new_status || r.new_handler || '处理成功'}` : ''}
                            </span>
                          </div>
                          {r.success ? (
                            <span style={{ color: '#28a745', fontSize: 12 }}>成功</span>
                          ) : (
                            <span style={{ color: '#dc3545', fontSize: 12 }}>失败</span>
                          )}
                        </div>

                        {!r.success && (
                          <div className="fail-detail-box">
                            {r.fail_code && (
                              <span className="fail-chip-code">
                                {FAIL_CODE_LABEL[r.fail_code] || r.fail_code}
                              </span>
                            )}
                            {r.preserved && <span className="preserve-tag">原状态保留</span>}
                            <div style={{ marginTop: 4 }}>{r.fail_reason}</div>
                            {r.missing_details && r.missing_details.length > 0 && (
                              <ul style={{ marginTop: 4 }}>
                                {r.missing_details.map((m, mi) => (
                                  <li key={mi}>
                                    缺【{m.label}】 → 需要【{m.owner_label}】补正
                                  </li>
                                ))}
                              </ul>
                            )}
                            {r.expected_status && (
                              <div style={{ marginTop: 4, color: '#666' }}>
                                期望状态：{r.expected_status}；当前状态：{r.current_status}
                              </div>
                            )}
                            {r.current_handler && (
                              <div style={{ marginTop: 4, color: '#666' }}>
                                当前处理人：{r.current_handler}（{r.current_handler_role || '—'}）
                              </div>
                            )}
                            {r.submitted_version !== undefined && (
                              <div style={{ marginTop: 4, color: '#666' }}>
                                提交版本：v{r.submitted_version}；服务端版本：v{r.current_version}
                              </div>
                            )}
                          </div>
                        )}

                        {r.success && r.missing_modules && r.missing_modules.missing_details?.length > 0 && (
                          <div className="fail-detail-box"
                            style={{ background: '#fff9e6', borderColor: '#ffecb5', color: '#856404' }}>
                            <div style={{ fontWeight: 600 }}>⚠️ 处理成功，但仍缺以下证据（已记入异常原因）：</div>
                            <ul>
                              {r.missing_modules.missing_details.map((m, mi) => (
                                <li key={mi}>缺【{m.label}】 → 需要【{m.owner_label}】补正</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-default"
                disabled={batchLoading}
                onClick={() => { setShowBatchModal(false); setBatchResult(null) }}>
                {batchResult ? '关闭' : '取消'}
              </button>
              {!batchResult && (
                <button className="btn btn-primary" disabled={batchLoading}
                  onClick={handleBatchProcess}>
                  {batchLoading ? '处理中...' : '确认执行（逐条校验）'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !createLoading && setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              新建团队预约单
              <button className="modal-close"
                onClick={() => !createLoading && setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert-banner info">
                <div className="alert-icon">💡</div>
                <div className="alert-body">
                  新建后会自动生成 3 条「材料缺失」异常原因（票务核销 / 入园统计等），提示对应责任人补正。
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>团队名称 *</label>
                  <input value={newBooking.team_name}
                    onChange={e => setNewBooking({ ...newBooking, team_name: e.target.value })} /></div>
                <div className="form-group"><label>联系人 *</label>
                  <input value={newBooking.contact_person}
                    onChange={e => setNewBooking({ ...newBooking, contact_person: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>联系电话 *</label>
                  <input value={newBooking.contact_phone}
                    onChange={e => setNewBooking({ ...newBooking, contact_phone: e.target.value })} /></div>
                <div className="form-group"><label>游客人数 *</label>
                  <input type="number" value={newBooking.visitor_count}
                    onChange={e => setNewBooking({ ...newBooking, visitor_count: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>入园日期 *</label>
                  <input type="date" value={newBooking.visit_date}
                    onChange={e => setNewBooking({ ...newBooking, visit_date: e.target.value })} /></div>
                <div className="form-group"><label>入园时间</label>
                  <input type="time" value={newBooking.visit_time}
                    onChange={e => setNewBooking({ ...newBooking, visit_time: e.target.value })} /></div>
              </div>
              <div className="form-group"><label>行程安排</label>
                <textarea value={newBooking.itinerary}
                  onChange={e => setNewBooking({ ...newBooking, itinerary: e.target.value })}
                  placeholder="请填写团队行程..." /></div>
              <div className="form-group"><label>特殊需求</label>
                <textarea value={newBooking.requirements}
                  onChange={e => setNewBooking({ ...newBooking, requirements: e.target.value })}
                  placeholder="导游 / 团餐等特殊需求..." /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" disabled={createLoading}
                onClick={() => setShowCreateModal(false)}>取消</button>
              <button className="btn btn-primary" disabled={createLoading}
                onClick={handleCreate}>
                {createLoading ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
