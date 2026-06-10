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
  NOT_OVERDUE: '非逾期', DUPLICATE_ACTION: '重复操作', DB_ERROR: '数据库异常',
  INVALID_ACTION: '无效动作', EMPTY_IDS: '未选中单据'
}

export default function WarningQueue() {
  const navigate = useNavigate()
  const { showNotification, refreshAll, userRole, fetchBookings, missingSummary, currentFilters } = useApp()
  const [activeTab, setActiveTab] = useState('all')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [batchResult, setBatchResult] = useState(null)
  const [showBatchResult, setShowBatchResult] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = activeTab === 'all' ? '' : `?urgency=${activeTab}`
      const res = await api.get(`/bookings${params}`)
      if (res.data.success) {
        setList(res.data.data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredList.length) setSelectedIds([])
    else setSelectedIds(filteredList.map(b => b.id))
  }

  const handleAdvanceOverdue = async () => {
    const overdueIds = list.filter(b => b.urgency === 'overdue').map(b => b.id)
    const targetIds = selectedIds.length > 0
      ? selectedIds.filter(id => list.find(b => b.id === id)?.urgency === 'overdue')
      : overdueIds

    if (targetIds.length === 0) {
      showNotification('没有可推进的逾期单据', 'warning')
      return
    }

    setBatchLoading(true)
    try {
      const res = await api.post('/bookings/batch-process', {
        ids: targetIds,
        action: 'advance_overdue'
      })
      if (res.data.success) {
        setBatchResult(res.data.data)
        setShowBatchResult(true)
        showNotification(res.data.message,
          res.data.data.fail_count > 0 ? 'warning' : 'success')
        setSelectedIds([])
        await refreshAll()
        loadData()
      }
    } catch (err) {
      showNotification(err.response?.data?.error || '批量推进失败', 'error')
    } finally {
      setBatchLoading(false)
    }
  }

  const tabs = [
    { key: 'all', label: '全部', color: '#2d7dd2' },
    { key: 'normal', label: '正常', color: '#28a745' },
    { key: 'approaching', label: '临期（4小时内）', color: '#ffc107' },
    { key: 'overdue', label: '已逾期', color: '#dc3545' }
  ]

  const counts = {
    all: list.length,
    normal: list.filter(b => b.urgency === 'normal').length,
    approaching: list.filter(b => b.urgency === 'approaching').length,
    overdue: list.filter(b => b.urgency === 'overdue').length
  }

  const filteredList = activeTab === 'all' ? list : list.filter(b => b.urgency === activeTab)
  const overdueSelectedCount = selectedIds.filter(id => list.find(b => b.id === id)?.urgency === 'overdue').length

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>到期预警队列（共 {filteredList.length} 条）</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {userRole === 'manager' && (
              <button className="btn btn-danger" disabled={batchLoading} onClick={handleAdvanceOverdue}>
                {batchLoading ? '推进中...' :
                  (selectedIds.length > 0
                    ? `批量推进选中的逾期（${overdueSelectedCount}）`
                    : '批量推进全部逾期')}
              </button>
            )}
          </div>
        </div>
        <div className="card-body">
          {userRole === 'manager' && (
            <div className="alert-banner warning" style={{ marginBottom: 16 }}>
              <div className="alert-icon">⚠️</div>
              <div className="alert-body">
                <div className="alert-title">逾期批量推进规则</div>
                <div>仅景区经理可执行。逐条校验 5 要素：非逾期、非待审核、已在景区经理处都会被拦截，保留原状态并给出失败原因；缺证据模块会继续保留异常原因并提示补正责任人。</div>
              </div>
            </div>
          )}

          <div className="nav-tabs" style={{ marginBottom: 20 }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                className={`nav-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab.key); setSelectedIds([]) }}
                style={activeTab === tab.key ? { color: tab.color } : {}}
              >
                {tab.label}（{counts[tab.key]}）
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 16, fontSize: 13, color: '#666' }}>
            <strong>说明：</strong>
            <span className="urgency-tag normal" style={{ margin: '0 4px' }}>正常</span> 距截止 4 小时以上 ·
            <span className="urgency-tag approaching" style={{ margin: '0 4px' }}>临期</span> 距截止不足 4 小时 ·
            <span className="urgency-tag overdue" style={{ margin: '0 4px' }}>逾期</span> 已超过处理期限
          </div>

          {Object.keys(missingSummary || {}).some(k => missingSummary[k]?.count > 0) && (
            <div className="missing-chip-list" style={{ marginBottom: 16 }}>
              {Object.entries(missingSummary).map(([k, v]) => (
                v.count > 0 && (
                  <span key={k} className="missing-chip">
                    ⛔ 缺 {v.label} × {v.count}
                    <span className="owner">责任：{v.owner_label}</span>
                  </span>
                )
              ))}
            </div>
          )}

          {loading ? (
            <div className="empty-state">加载中...</div>
          ) : filteredList.length === 0 ? (
            <div className="empty-state">该分类下暂无单据</div>
          ) : (
            <div>
              <table>
                <thead>
                  <tr>
                    <th className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={filteredList.length > 0 && selectedIds.length === filteredList.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>预约单号</th>
                    <th>团队名称</th>
                    <th>状态</th>
                    <th>紧急度</th>
                    <th>当前处理人</th>
                    <th>缺证据模块</th>
                    <th>截止时间</th>
                    <th>超时计算（责任人）</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map(b => {
                    const hoursLeft = b.deadline
                      ? Math.round((dayjs(b.deadline).valueOf() - Date.now()) / 3600000)
                      : 0
                    return (
                      <tr key={b.id}>
                        <td className="checkbox-col">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(b.id)}
                            onChange={() => toggleSelect(b.id)}
                          />
                        </td>
                        <td>
                          <span className="link" onClick={() => navigate(`/bookings/${b.id}`)}>{b.booking_no}</span>
                          <span style={{ fontSize: 11, color: '#999', marginLeft: 6 }}>v{b.version}</span>
                        </td>
                        <td>{b.team_name}</td>
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
                          color: b.urgency === 'overdue' ? '#dc3545' : b.urgency === 'approaching' ? '#ffc107' : '',
                          fontWeight: b.urgency !== 'normal' ? 600 : 400
                        }}>
                          {b.deadline ? dayjs(b.deadline).format('MM-DD HH:mm') : '-'}
                        </td>
                        <td style={{
                          color: hoursLeft < 0 ? '#dc3545' : hoursLeft < 4 ? '#ffc107' : '#28a745',
                          fontWeight: 600
                        }}>
                          {hoursLeft >= 0 ? `剩余 ${hoursLeft} 小时` : `已超时 ${Math.abs(hoursLeft)} 小时`}
                          <div style={{ fontSize: 12, color: '#999', fontWeight: 400 }}>
                            责任人：{b.current_handler}
                          </div>
                        </td>
                        <td>
                          <button className="btn btn-sm btn-default" onClick={() => navigate(`/bookings/${b.id}`)}>
                            详情/处理
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showBatchResult && batchResult && (
        <div className="modal-overlay" onClick={() => !batchLoading && setShowBatchResult(false)}>
          <div className="modal" style={{ width: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              逾期批量推进结果
              <button className="modal-close"
                disabled={batchLoading}
                onClick={() => setShowBatchResult(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 24, marginBottom: 12, padding: '10px 14px', background: '#f8f9fa', borderRadius: 6 }}>
                <div>成功：<strong style={{ color: '#28a745' }}>{batchResult.success_count}</strong></div>
                <div>失败：<strong style={{ color: '#dc3545' }}>{batchResult.fail_count}</strong></div>
                <div>总计：{batchResult.results.length}</div>
              </div>

              {batchResult.summary?.by_fail_code && Object.keys(batchResult.summary.by_fail_code).length > 0 && (
                <div style={{ marginBottom: 12, padding: 12, background: '#fff5f5', borderRadius: 6 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>失败分类汇总：</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {Object.entries(batchResult.summary.by_fail_code).map(([fc, info]) => (
                      <span key={fc} className="fail-chip-code">
                        {FAIL_CODE_LABEL[fc] || fc} × {info.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="batch-result-list" style={{ maxHeight: 360 }}>
                {batchResult.results.map((r, idx) => (
                  <div key={idx} className={`batch-result-item ${r.success ? 'success' : 'fail'}`}
                    style={{ display: 'block', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 600 }}>
                        {r.booking_no || `#${r.id}`}
                        <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12 }}>
                          {r.success ? `✓ 推进至 ${r.new_handler || '景区经理'}` : ''}
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
                      </div>
                    )}

                    {r.success && r.missing_modules && r.missing_modules.missing_details?.length > 0 && (
                      <div className="fail-detail-box"
                        style={{ background: '#fff9e6', borderColor: '#ffecb5', color: '#856404' }}>
                        <div style={{ fontWeight: 600 }}>⚠️ 推进成功，但仍缺以下证据（已记入异常原因）：</div>
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
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowBatchResult(false)}>确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
