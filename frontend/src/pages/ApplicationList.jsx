import { useEffect, useState } from 'preact/hooks'
import {
  applications,
  pagination,
  filters,
  selectedIds,
  stats,
  loading,
  error,
  batchResults,
  currentRole,
  currentModule,
  moduleName,
  loadApplications,
  loadStats,
  toggleSelect,
  selectAll,
  setFilter,
  setPage,
  batchProcess,
  batchAdvanceOverdue,
  clearBatchResults,
} from '../store.js'
import BatchResults from '../components/BatchResults.jsx'
import { statusLabel, warningLabel, formatDate } from '../utils/format.js'

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'pending_assign', label: '待分派' },
  { value: 'transferred', label: '已转办' },
  { value: 'visited', label: '已回访' },
  { value: 'correction', label: '待补正' },
  { value: 'returned', label: '已退回' },
  { value: 'archived', label: '已归档' },
]

const warningOptions = [
  { value: '', label: '全部预警' },
  { value: 'normal', label: '正常' },
  { value: 'approaching', label: '临期' },
  { value: 'overdue', label: '逾期' },
]

function ApplicationList() {
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchAction, setBatchAction] = useState('')
  const [batchOpinion, setBatchOpinion] = useState('')

  useEffect(() => {
    loadApplications()
    loadStats()
  }, [currentModule.value, pagination.value.page, filters.value])

  const handleView = (id) => {
    window.location.hash = `/application/${id}`
  }

  const handleBatchClick = (action) => {
    if (selectedIds.value.size === 0) {
      alert('请先选择要处理的申请单')
      return
    }
    setBatchAction(action)
    setBatchOpinion('')
    setShowBatchModal(true)
  }

  const handleBatchConfirm = async () => {
    try {
      if (batchAction === 'advance') {
        await batchAdvanceOverdue()
      } else {
        await batchProcess(batchAction, batchOpinion)
      }
      setShowBatchModal(false)
    } catch (e) {
      console.error('Batch operation failed:', e)
    }
  }

  const canBatchAssign = currentRole.value === 'registrar' && currentModule.value === 'application'
  const canBatchVisit = currentRole.value === 'agent' && currentModule.value === 'application'
  const canBatchReview = currentRole.value === 'director' && currentModule.value === 'application'
  const canBatchCorrect = currentRole.value === 'registrar' && currentModule.value === 'correction'
  const canBatchAdvance = currentRole.value === 'registrar' && currentModule.value === 'application'

  const totalPages = Math.ceil(pagination.value.total / pagination.value.pageSize)

  return (
    <div>
      <div className="page-header">
        <h1>{moduleName.value}列表</h1>
      </div>

      {stats.value && (
        <div className="stats-bar">
          <div className="stat-card">
            <div className="stat-value">{stats.value.total || 0}</div>
            <div className="stat-label">申请单总数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.value.pending_assign || 0}</div>
            <div className="stat-label">待分派</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.value.transferred || 0}</div>
            <div className="stat-label">已转办</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.value.visited || 0}</div>
            <div className="stat-label">已回访</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{stats.value.approaching || 0}</div>
            <div className="stat-label">临期</div>
          </div>
          <div className="stat-card danger">
            <div className="stat-value">{stats.value.overdue || 0}</div>
            <div className="stat-label">逾期</div>
          </div>
          <div className="stat-card success">
            <div className="stat-value">{stats.value.archived || 0}</div>
            <div className="stat-label">已归档</div>
          </div>
        </div>
      )}

      {error.value && (
        <div className="alert alert-error">{error.value}</div>
      )}

      {batchResults.value && (
        <BatchResults results={batchResults.value} onClose={clearBatchResults} />
      )}

      <div className="toolbar">
        <div className="toolbar-row">
          <div className="search-box">
            <input
              type="text"
              placeholder="搜索申请单号、申请人、商标名称..."
              value={filters.value.keyword}
              onInput={(e) => setFilter('keyword', e.target.value)}
            />
          </div>
          <select
            className="filter-select"
            value={filters.value.status}
            onChange={(e) => setFilter('status', e.target.value)}
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            className="filter-select"
            value={filters.value.warning}
            onChange={(e) => setFilter('warning', e.target.value)}
          >
            {warningOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="toolbar-row">
          {canBatchAssign && (
            <button className="btn btn-primary" onClick={() => handleBatchClick('assign')}>
              批量分派
            </button>
          )}
          {canBatchVisit && (
            <button className="btn btn-success" onClick={() => handleBatchClick('visit')}>
              批量回访
            </button>
          )}
          {canBatchReview && (
            <button className="btn btn-primary" onClick={() => handleBatchClick('review')}>
              批量复核
            </button>
          )}
          {canBatchCorrect && (
            <button className="btn btn-warning" onClick={() => handleBatchClick('correct')}>
              批量补正
            </button>
          )}
          {canBatchAdvance && (
            <button className="btn btn-danger" onClick={() => handleBatchClick('advance')}>
              批量推进逾期
            </button>
          )}
          <span style={{ marginLeft: 'auto', color: '#888', fontSize: '13px' }}>
            已选择 {selectedIds.value.size} 项
          </span>
        </div>
      </div>

      <div className="table-container">
        {loading.value ? (
          <div className="loading-spinner">加载中...</div>
        ) : applications.value.length === 0 ? (
          <div className="empty-state">暂无数据</div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedIds.value.size > 0 && selectedIds.value.size === applications.value.length}
                        onChange={selectAll}
                      />
                    </th>
                    <th>申请单号</th>
                    <th>申请人</th>
                    <th>商标名称</th>
                    <th>商标类别</th>
                    <th>状态</th>
                    <th>预警状态</th>
                    <th>当前节点</th>
                    <th>责任人</th>
                    <th>截止日期</th>
                    <th>材料</th>
                    <th>证据</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.value.map(app => (
                    <tr key={app.id} className={selectedIds.value.has(app.id) ? 'selected' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selectedIds.value.has(app.id)}
                          onChange={() => toggleSelect(app.id)}
                        />
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{app.application_no}</td>
                      <td>{app.applicant_name}</td>
                      <td>{app.trademark_name}</td>
                      <td>第{app.trademark_class}类</td>
                      <td>
                        <span className={`status-tag status-${app.status}`}>
                          {statusLabel(app.status)}
                        </span>
                      </td>
                      <td>
                        <span className={`warning-tag warning-${app.warning_status}`}>
                          {warningLabel(app.warning_status)}
                        </span>
                      </td>
                      <td>{app.current_node || '-'}</td>
                      <td>{app.node_responsible || '-'}</td>
                      <td>{app.node_due_date ? formatDate(app.node_due_date) : '-'}</td>
                      <td>
                        <span className={`badge ${app.material_complete ? 'badge-green' : 'badge-red'}`}>
                          {app.material_complete ? '齐全' : '缺件'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${app.evidence_complete ? 'badge-green' : 'badge-red'}`}>
                          {app.evidence_complete ? '齐全' : '缺件'}
                        </span>
                      </td>
                      <td>
                        <div className="action-links">
                          <button onClick={() => handleView(app.id)}>详情</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>共 {pagination.value.total} 条</span>
              <button
                disabled={pagination.value.page <= 1}
                onClick={() => setPage(pagination.value.page - 1)}
              >
                上一页
              </button>
              <span>第 {pagination.value.page} / {totalPages || 1} 页</span>
              <button
                disabled={pagination.value.page >= totalPages}
                onClick={() => setPage(pagination.value.page + 1)}
              >
                下一页
              </button>
            </div>
          </>
        )}
      </div>

      {showBatchModal && (
        <div className="modal-overlay" onClick={() => setShowBatchModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {batchAction === 'assign' && '批量分派'}
                {batchAction === 'visit' && '批量回访'}
                {batchAction === 'review' && '批量复核'}
                {batchAction === 'correct' && '批量补正'}
                {batchAction === 'advance' && '批量推进逾期'}
              </h2>
              <button className="modal-close" onClick={() => setShowBatchModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px' }}>
                即将处理 <strong>{selectedIds.value.size}</strong> 条申请单
              </p>
              {batchAction !== 'advance' && (
                <div className="form-group">
                  <label>处理意见</label>
                  <textarea
                    placeholder="请输入处理意见（可选）"
                    value={batchOpinion}
                    onInput={(e) => setBatchOpinion(e.target.value)}
                  />
                </div>
              )}
              {batchAction === 'advance' && (
                <div className="alert alert-warning">
                  批量推进逾期申请单会逐条校验，不满足条件的将被拦截并记录异常原因。
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowBatchModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleBatchConfirm}>确认处理</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ApplicationList
