import { useState, useMemo } from 'preact/hooks'
import { STATUS, STATUS_NAMES, STATUS_COLORS, PRIORITY_NAMES, PRIORITY_COLORS, WARNING_LEVEL, WARNING_NAMES, WARNING_COLORS, ROLES } from '../types'
import { formatDateShort, daysUntil } from '../utils'

export default function HazardList({ store, onViewDetail, onCreate, onBatchProcess }) {
  const { hazards, loading, filters, setFilters, currentUser } = store
  const [selectedIds, setSelectedIds] = useState([])
  const [activeWarningGroup, setActiveWarningGroup] = useState('')

  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: STATUS.PENDING_ASSIGN, label: STATUS_NAMES[STATUS.PENDING_ASSIGN] },
    { value: STATUS.TRANSFERRED, label: STATUS_NAMES[STATUS.TRANSFERRED] },
    { value: STATUS.REVISITED, label: STATUS_NAMES[STATUS.REVISITED] },
    { value: STATUS.DRAFT, label: STATUS_NAMES[STATUS.DRAFT] },
    { value: STATUS.ASSIGNED, label: STATUS_NAMES[STATUS.ASSIGNED] },
    { value: STATUS.RECTIFYING, label: STATUS_NAMES[STATUS.RECTIFYING] },
    { value: STATUS.RECHECKING, label: STATUS_NAMES[STATUS.RECHECKING] },
    { value: STATUS.RETURNED, label: STATUS_NAMES[STATUS.RETURNED] },
    { value: STATUS.CLOSED, label: STATUS_NAMES[STATUS.CLOSED] }
  ]

  const priorityOptions = [
    { value: '', label: '全部优先级' },
    { value: 'urgent', label: '紧急' },
    { value: 'high', label: '高' },
    { value: 'medium', label: '中' },
    { value: 'low', label: '低' }
  ]

  const groupedHazards = useMemo(() => {
    if (!activeWarningGroup) return hazards
    return hazards.filter(h => h.warning_level === activeWarningGroup)
  }, [hazards, activeWarningGroup])

  const overdueCount = hazards.filter(h => h.warning_level === WARNING_LEVEL.OVERDUE).length
  const nearCount = hazards.filter(h => h.warning_level === WARNING_LEVEL.NEAR_DUE).length
  const normalCount = hazards.filter(h => h.warning_level === WARNING_LEVEL.NORMAL).length

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === groupedHazards.length && groupedHazards.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(groupedHazards.map(h => h.id))
    }
  }

  const canCreate = currentUser.role === ROLES.FIRE_CLERK
  const canBatchProcess = selectedIds.length > 0 && (
    currentUser.role === ROLES.FIRE_CLERK ||
    currentUser.role === ROLES.FIRE_SUPERVISOR ||
    currentUser.role === ROLES.STATION_CHIEF
  )

  const getBatchActions = () => {
    const actions = []
    if (currentUser.role === ROLES.FIRE_CLERK) {
      actions.push({ value: 'assign', label: '分派处理', toStatus: STATUS.ASSIGNED })
      actions.push({ value: 'transfer', label: '转办', toStatus: STATUS.TRANSFERRED })
    }
    if (currentUser.role === ROLES.FIRE_SUPERVISOR) {
      actions.push({ value: 'start_rectify', label: '下发整改通知', toStatus: STATUS.RECTIFYING })
      actions.push({ value: 'start_recheck', label: '进入复查', toStatus: STATUS.RECHECKING })
      actions.push({ value: 'return', label: '退回补正', toStatus: STATUS.RETURNED })
    }
    if (currentUser.role === ROLES.STATION_CHIEF) {
      actions.push({ value: 'revisit', label: '标记已回访', toStatus: STATUS.REVISITED })
      actions.push({ value: 'close', label: '销项归档', toStatus: STATUS.CLOSED })
    }
    return actions
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          📋 消防隐患单列表
          {loading && <span style={{fontSize: '13px', color: '#6b7280', fontWeight: 'normal'}}>加载中...</span>}
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
          {canCreate && (
            <button className="btn btn-primary" onClick={onCreate}>
              ➕ 新建隐患单
            </button>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <div className="warning-tabs">
          <button
            className={`warning-tab ${activeWarningGroup === '' ? 'active' : ''}`}
            onClick={() => setActiveWarningGroup('')}
          >
            全部 ({hazards.length})
          </button>
          <button
            className={`warning-tab ${activeWarningGroup === WARNING_LEVEL.NORMAL ? 'active' : ''}`}
            onClick={() => setActiveWarningGroup(WARNING_LEVEL.NORMAL)}
          >
            🟢 正常 ({normalCount})
          </button>
          <button
            className={`warning-tab near ${activeWarningGroup === WARNING_LEVEL.NEAR_DUE ? 'active' : ''}`}
            onClick={() => setActiveWarningGroup(WARNING_LEVEL.NEAR_DUE)}
          >
            🟡 临期 ({nearCount})
          </button>
          <button
            className={`warning-tab overdue ${activeWarningGroup === WARNING_LEVEL.OVERDUE ? 'active' : ''}`}
            onClick={() => setActiveWarningGroup(WARNING_LEVEL.OVERDUE)}
          >
            🔴 逾期 ({overdueCount})
          </button>
        </div>

        <div className="filter-group">
          <span className="filter-label">状态：</span>
          <select
            className="filter-select"
            value={filters.status}
            onChange={e => setFilters({...filters, status: e.target.value})}
          >
            {statusOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">优先级：</span>
          <select
            className="filter-select"
            value={filters.priority}
            onChange={e => setFilters({...filters, priority: e.target.value})}
          >
            {priorityOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">搜索：</span>
          <input
            type="text"
            className="filter-input"
            placeholder="输入单号/标题/描述"
            value={filters.keyword}
            onChange={e => setFilters({...filters, keyword: e.target.value})}
          />
        </div>
      </div>

      <div className="table-container">
        {selectedIds.length > 0 && (
          <div className="batch-bar">
            <div className="batch-info">
              ✅ 已选择 <strong>{selectedIds.length}</strong> 条隐患单
            </div>
            <div className="batch-actions">
              {canBatchProcess && getBatchActions().map(a => (
                <button
                  key={a.value}
                  className={`btn btn-sm ${a.value === 'return' ? 'btn-danger' : a.value === 'close' ? 'btn-success' : 'btn-primary'}`}
                  onClick={() => onBatchProcess({ ids: [...selectedIds], action: a.value, toStatus: a.toStatus, label: a.label })}
                >
                  批量{a.label}
                </button>
              ))}
              <button className="btn btn-sm" onClick={() => setSelectedIds([])}>取消选择</button>
            </div>
          </div>
        )}

        <table className="data-table">
          <thead>
            <tr>
              <th style={{width: '40px'}}>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={groupedHazards.length > 0 && selectedIds.length === groupedHazards.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>单号</th>
              <th>标题</th>
              <th>优先级</th>
              <th>责任人</th>
              <th>当前处理人</th>
              <th>状态</th>
              <th>截止时间</th>
              <th>预警</th>
              <th>异常标签</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {groupedHazards.length === 0 ? (
              <tr>
                <td colSpan="11">
                  <div className="empty-state">暂无符合条件的消防隐患单</div>
                </td>
              </tr>
            ) : groupedHazards.map(h => {
              const days = daysUntil(h.deadline)
              return (
                <tr key={h.id} className={selectedIds.includes(h.id) ? 'selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selectedIds.includes(h.id)}
                      onChange={() => toggleSelect(h.id)}
                    />
                  </td>
                  <td style={{fontFamily: 'monospace', fontSize: '12px', color: '#2563eb'}}>{h.hazard_no}</td>
                  <td>
                    <div style={{fontWeight: '500', color: '#111827'}}>{h.title}</div>
                    <div style={{fontSize: '12px', color: '#6b7280', marginTop: '2px'}}>{h.location || '-'}</div>
                  </td>
                  <td>
                    <span className="tag priority-tag" style={{background: PRIORITY_COLORS[h.priority] + '20', color: PRIORITY_COLORS[h.priority]}}>
                      {PRIORITY_NAMES[h.priority]}
                    </span>
                  </td>
                  <td>{h.responsible || '-'}</td>
                  <td>{h.current_handler || '-'}</td>
                  <td>
                    <span className="status-badge" style={{background: STATUS_COLORS[h.status] + '20', color: STATUS_COLORS[h.status]}}>
                      {STATUS_NAMES[h.status]}
                    </span>
                  </td>
                  <td>
                    <div>{formatDateShort(h.deadline)}</div>
                    {days !== null && days !== 0 && (
                      <div style={{fontSize: '11px', color: days < 0 ? '#dc2626' : '#6b7280', marginTop: '2px'}}>
                        {days < 0 ? `已逾期${-days}天` : `剩余${days}天`}
                      </div>
                    )}
                  </td>
                  <td>
                    <span>
                      <span className="warning-icon" style={{background: WARNING_COLORS[h.warning_level]}}></span>
                      <span style={{color: WARNING_COLORS[h.warning_level], fontWeight: '500'}}>
                        {WARNING_NAMES[h.warning_level]}
                      </span>
                    </span>
                  </td>
                  <td>
                    {(h.abnormal_tags || []).map((t, i) => (
                      <span key={i} className="tag tag-sm abnormal-tag">{t}</span>
                    ))}
                    {(!h.abnormal_tags || h.abnormal_tags.length === 0) && <span style={{color: '#9ca3af', fontSize: '12px'}}>-</span>}
                  </td>
                  <td>
                    <button className="link-btn" onClick={() => onViewDetail(h.id)}>查看/办理</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
