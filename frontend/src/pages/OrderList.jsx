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

  const allSelected = orders.length > 0 && selectedIds.size === orders.length

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

  const normalOrders = orders.filter(o => o.urgency_status === 'normal')
  const warningOrders = orders.filter(o => o.urgency_status === 'warning')
  const overdueOrders = orders.filter(o => o.urgency_status === 'overdue')

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

  const renderOrderCard = (o) => (
    <div key={o.id} className={`order-card urgency-${o.urgency_status}`}>
      <div className="card-top">
        <label>
          <input type="checkbox" checked={selectedIds.has(o.id)}
            onChange={(e) => handleSelect(o.id, e.target.checked)} />
        </label>
        <div className="order-main">
          <div className="order-title">
            <strong>{o.order_no}</strong>
            <span className="cust-name">{o.customer_name}</span>
            {o.has_defect && <span className="defect-badge">缺材料</span>}
          </div>
          <div className="order-sub">
            {renderStatus(o.status)}
            {renderUrgency(o.urgency_status)}
            <span className="version">v{o.version}</span>
          </div>
        </div>
        <div className="card-actions">
          <button className="btn btn-default btn-sm"
            onClick={() => navigate(`/orders/${o.id}`)}>详情</button>
        </div>
      </div>
      <div className="card-info">
        <span>📞 {o.customer_phone}</span>
        <span>📍 {o.business_area}</span>
        <span>👤 {o.current_handler_name || '-'}</span>
        <span>🕐 {dayjs(o.created_at).format('MM-DD HH:mm')}</span>
      </div>
    </div>
  )

  const renderColumn = (title, cls, list, emptyText) => (
    <div className={`urgency-column ${cls}`}>
      <div className="column-header">
        <h3>{title}</h3>
        <span className="count">{list.length}</span>
      </div>
      <div className="column-body">
        {list.length === 0 ? (
          <div className="empty-state">{emptyText}</div>
        ) : (
          list.map(renderOrderCard)
        )}
      </div>
    </div>
  )

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
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={allSelected} onChange={handleSelectAll} />
            <span>全选</span>
          </label>
          <span style={{ marginLeft: 12 }}>
            已选择 <strong style={{ color: '#1890ff' }}>{selectedIds.size}</strong> / {orders.length} 条
          </span>
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

      <div className="urgency-columns">
        {renderColumn('🟢 正常队列', 'col-normal', normalOrders, '暂无正常订单')}
        {renderColumn('🟡 临期队列（≤2天）', 'col-warning', warningOrders, '暂无临期订单')}
        {renderColumn('🔴 逾期队列', 'col-overdue', overdueOrders, '暂无逾期订单')}
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
