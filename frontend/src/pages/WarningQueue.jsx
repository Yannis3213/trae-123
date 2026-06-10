import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../api'
import { useApp } from '../context/AppContext.jsx'

export default function WarningQueue() {
  const navigate = useNavigate()
  const { showNotification, refreshAll, userRole } = useApp()
  const [activeTab, setActiveTab] = useState('all')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [batchResult, setBatchResult] = useState(null)
  const [showBatchResult, setShowBatchResult] = useState(false)

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

  const handleAdvanceOverdue = async () => {
    const overdueIds = list.filter(b => b.urgency === 'overdue').map(b => b.id)
    const targetIds = selectedIds.length > 0 ? selectedIds.filter(id => list.find(b => b.id === id)?.urgency === 'overdue') : overdueIds

    if (targetIds.length === 0) {
      showNotification('没有可推进的逾期单据', 'warning')
      return
    }

    try {
      const res = await api.post('/bookings/batch-process', {
        ids: targetIds,
        action: 'advance_overdue'
      })
      if (res.data.success) {
        setBatchResult(res.data.data)
        setShowBatchResult(true)
        showNotification(res.data.message, 'success')
        setSelectedIds([])
        await refreshAll()
        loadData()
      }
    } catch (err) {
      showNotification(err.response?.data?.error || '批量推进失败', 'error')
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
          <h3>到期预警队列</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {userRole === 'manager' && (
              <button className="btn btn-danger" onClick={handleAdvanceOverdue}>
                {selectedIds.length > 0 ? `批量推进选中的逾期（${overdueSelectedCount}）` : '批量推进全部逾期'}
              </button>
            )}
          </div>
        </div>
        <div className="card-body">
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
                        onChange={() => {
                          if (selectedIds.length === filteredList.length) {
                            setSelectedIds([])
                          } else {
                            setSelectedIds(filteredList.map(b => b.id))
                          }
                        }}
                      />
                    </th>
                    <th>预约单号</th>
                    <th>团队名称</th>
                    <th>状态</th>
                    <th>紧急度</th>
                    <th>当前处理人</th>
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
                        <td><span className="link" onClick={() => navigate(`/bookings/${b.id}`)}>{b.booking_no}</span></td>
                        <td>{b.team_name}</td>
                        <td><span className={`status-tag ${b.status}`}>{b.status}</span></td>
                        <td><span className={`urgency-tag ${b.urgency}`}>{
                          b.urgency === 'normal' ? '正常' : b.urgency === 'approaching' ? '临期' : '逾期'
                        }</span></td>
                        <td>{b.current_handler}</td>
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
        <div className="modal-overlay" onClick={() => setShowBatchResult(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              逾期批量推进结果
              <button className="modal-close" onClick={() => setShowBatchResult(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                成功 <strong style={{ color: '#28a745' }}>{batchResult.success_count}</strong> 条，
                失败 <strong style={{ color: '#dc3545' }}>{batchResult.fail_count}</strong> 条
              </div>
              <div className="batch-result-list">
                {batchResult.results.map((r, idx) => (
                  <div key={idx} className={`batch-result-item ${r.success ? 'success' : 'fail'}`}>
                    <span>{r.booking_no || `#${r.id}`}</span>
                    <span>{r.success ? `✓ 推进至 ${r.new_handler}` : `✗ ${r.reason}`}</span>
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
