import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../api.js'
import { useAuth } from '../App.jsx'
import BatchModal from '../components/BatchModal.jsx'
import CreateOrderModal from '../components/CreateOrderModal.jsx'

export default function OrderList() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [orders, setOrders] = useState([])
  const [statistics, setStatistics] = useState({
    total: 0, pending_review: 0, review_approved: 0, synced: 0, returned: 0,
    normal: 0, warning: 0, overdue: 0
  })
  const [loading, setLoading] = useState(false)

  const [statusFilter, setStatusFilter] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('')
  const [businessArea, setBusinessArea] = useState('')
  const [keyword, setKeyword] = useState('')
  const [defectOnly, setDefectOnly] = useState(false)
  const [businessAreas, setBusinessAreas] = useState([])

  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchAction, setBatchAction] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (urgencyFilter) params.urgency = urgencyFilter
      if (businessArea) params.business_area = businessArea
      if (keyword) params.keyword = keyword
      if (defectOnly) params.defect_only = true
      const [res1, res2, res3] = await Promise.all([
        api.get('/orders', { params }),
        api.get('/orders/statistics'),
        api.get('/business-areas')
      ])
      setOrders(res1.data)
      setStatistics(res2.data)
      setBusinessAreas(res3.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadData()
  }, [statusFilter, urgencyFilter, businessArea, keyword, defectOnly])

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(orders.map(o => o.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelect = (id, checked) => {
    const newSet = new Set(selectedIds)
    if (checked) newSet.add(id); else newSet.delete(id)
    setSelectedIds(newSet)
  }

  const openBatch = (action) => {
    if (selectedIds.size === 0) {
      alert('请先选择订单')
      return
    }
    setBatchAction(action)
    setShowBatchModal(true)
  }

  const canShowBatchApprove = user?.role === 'ophthalmologist'
  const canShowBatchSync = user?.role === 'operations_manager'
  const canShowBatchReturn = user?.role === 'ophthalmologist'
  const canCreate = user?.role === 'optometrist'

  const selectedOrders = useMemo(() => {
    return orders.filter(o => selectedIds.has(o.id))
  }, [selectedIds, orders])

  const renderUrgency = (urgency) => {
    const map = { normal: '正常', warning: '临期', overdue: '逾期' }
    return <span className={`urgency-tag ${urgency}`}>{map[urgency] || urgency}</span>
  }

  const renderStatus = (status) => {
    const map = {
      pending_review: '待审核',
      review_approved: '审核通过',
      synced: '已同步',
      returned_for_correction: '退回补正'
    }
    return <span className={`status-tag ${status}`}>{map[status] || status}</span>
  }

  return (
    <div>
      <div className="statistics-bar">
        <div className="stat-card">
          <div className="label">订单总数</div>
          <div className="value">{statistics.total}</div>
        </div>
        <div className="stat-card">
          <div className="label">待审核</div>
          <div className="value">{statistics.pending_review}</div>
        </div>
        <div className="stat-card">
          <div className="label">审核通过</div>
          <div className="value">{statistics.review_approved}</div>
        </div>
        <div className="stat-card">
          <div className="label">已同步</div>
          <div className="value">{statistics.synced}</div>
        </div>
        <div className="stat-card">
          <div className="label">退回补正</div>
          <div className="value">{statistics.returned}</div>
        </div>
        <div className="stat-card urgency-normal">
          <div className="label">正常</div>
          <div className="value">{statistics.normal}</div>
        </div>
        <div className="stat-card urgency-warning">
          <div className="label">临期</div>
          <div className="value">{statistics.warning}</div>
        </div>
        <div className="stat-card urgency-overdue">
          <div className="label">逾期</div>
          <div className="value">{statistics.overdue}</div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-item">
          <label>状态：</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">全部</option>
            <option value="pending_review">待审核</option>
            <option value="review_approved">审核通过</option>
            <option value="synced">已同步</option>
            <option value="returned_for_correction">退回补正</option>
          </select>
        </div>
        <div className="filter-item">
          <label>到期预警：</label>
          <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
            <option value="">全部</option>
            <option value="normal">正常</option>
            <option value="warning">临期</option>
            <option value="overdue">逾期</option>
          </select>
        </div>
        <div className="filter-item">
          <label>业务区：</label>
          <select value={businessArea} onChange={(e) => setBusinessArea(e.target.value)}>
            <option value="">全部</option>
            {businessAreas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="filter-item">
          <label>搜索：</label>
          <input type="text" placeholder="订单号/客户姓名/电话" value={keyword}
            onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <div className="filter-item">
          <label style={{ whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={defectOnly} onChange={(e) => setDefectOnly(e.target.checked)}
              style={{ marginRight: 4 }} />
            仅看缺材料
          </label>
        </div>
        <div className="actions">
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              + 新建配镜订单
            </button>
          )}
        </div>
      </div>

      <div className="action-bar">
        <div className="left">
          已选择 <strong style={{ color: '#1890ff' }}>{selectedIds.size}</strong> 条
          {selectedIds.size > 0 && (
            <button className="btn btn-default btn-sm" onClick={() => setSelectedIds(new Set())}>
              清空
            </button>
          )}
        </div>
        <div className="right">
          {canShowBatchApprove && (
            <button className="btn btn-success" onClick={() => openBatch('approve')}>
              ✓ 批量审核通过
            </button>
          )}
          {canShowBatchReturn && (
            <button className="btn btn-warning" onClick={() => openBatch('return')}>
              ↺ 批量退回补正
            </button>
          )}
          {canShowBatchSync && (
            <button className="btn btn-primary" onClick={() => openBatch('sync')}>
              ⇌ 批量同步
            </button>
          )}
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === orders.length}
                  onChange={handleSelectAll} />
              </th>
              <th>订单号</th>
              <th>客户姓名</th>
              <th>联系电话</th>
              <th>业务区</th>
              <th>状态</th>
              <th>到期预警</th>
              <th>当前处理人</th>
              <th>版本</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="11"><div className="empty-state">加载中...</div></td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan="11"><div className="empty-state">暂无订单数据</div></td></tr>
            ) : orders.map(o => (
              <tr key={o.id}>
                <td>
                  <input type="checkbox" checked={selectedIds.has(o.id)}
                    onChange={(e) => handleSelect(o.id, e.target.checked)} />
                </td>
                <td><strong>{o.order_no}</strong></td>
                <td>
                  {o.customer_name}
                  {o.has_defect && <span className="defect-badge">缺材料</span>}
                </td>
                <td>{o.customer_phone}</td>
                <td>{o.business_area}</td>
                <td>{renderStatus(o.status)}</td>
                <td>{renderUrgency(o.urgency_status)}</td>
                <td>{o.current_handler_name || '-'}</td>
                <td>v{o.version}</td>
                <td>{dayjs(o.created_at).format('MM-DD HH:mm')}</td>
                <td>
                  <button className="btn btn-default btn-sm"
                    onClick={() => navigate(`/orders/${o.id}`)}>查看详情</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showBatchModal && (
        <BatchModal
          action={batchAction}
          selectedOrders={selectedOrders}
          onClose={() => setShowBatchModal(false)}
          onSuccess={() => { setShowBatchModal(false); setSelectedIds(new Set()); loadData() }}
        />
      )}

      {showCreateModal && (
        <CreateOrderModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); loadData() }}
        />
      )}
    </div>
  )
}
