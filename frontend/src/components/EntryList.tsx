import { useState, useEffect, useCallback } from 'react'
import type { User, Entry, BatchResult, BatchProcessEntry } from '../types'
import { STATUS_LABELS, PRIORITY_LABELS, CATEGORY_LABELS, OVERDUE_GROUP_LABELS } from '../types'
import * as api from '../api'

interface EntryListProps {
  user: User
  onEntryClick: (id: number) => void
  onRefresh: () => void
}

export function EntryList({ user, onEntryClick, onRefresh }: EntryListProps) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [overdueFilter, setOverdueFilter] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchAction, setBatchAction] = useState('')
  const [batchResult, setBatchResult] = useState('')
  const [batchReturnReason, setBatchReturnReason] = useState('')
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null)
  const [batchLoading, setBatchLoading] = useState(false)
  const [error, setError] = useState('')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    title: '',
    subcontractor_name: '',
    priority: 'medium',
    category: 'subcontractor_entry',
    responsible_person: '',
    deadline: '',
  })
  const [createLoading, setCreateLoading] = useState(false)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      if (categoryFilter) params.category = categoryFilter
      if (overdueFilter) params.overdue_group = overdueFilter
      const data = await api.listEntries(params)
      setEntries(data.entries || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, priorityFilter, categoryFilter, overdueFilter])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === entries.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(entries.map(e => e.id)))
    }
  }

  const handleBatchProcess = async () => {
    if (!batchAction || selected.size === 0) return
    setBatchLoading(true)
    setBatchResults(null)
    try {
      const batchEntries: BatchProcessEntry[] = entries
        .filter(e => selected.has(e.id))
        .map(e => ({ entry_id: e.id, version: e.version }))

      const data = await api.batchProcess({
        entries: batchEntries,
        action: batchAction,
        result: batchAction === 'return' ? batchReturnReason : batchResult,
      })
      setBatchResults(data.results || [])
      setSelected(new Set())
      fetchEntries()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBatchLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!createForm.title || !createForm.subcontractor_name || !createForm.deadline) {
      setError('标题、分包单位名称和截止时间为必填项')
      return
    }
    setCreateLoading(true)
    try {
      await api.createEntry({
        ...createForm,
        responsible_person: createForm.responsible_person || user.name,
      })
      setShowCreateModal(false)
      setCreateForm({ title: '', subcontractor_name: '', priority: 'medium', category: 'subcontractor_entry', responsible_person: '', deadline: '' })
      fetchEntries()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreateLoading(false)
    }
  }

  const formatDeadline = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch {
      return d
    }
  }

  const canCreate = user.role === 'document_clerk'
  const canBatchApprove = user.role === 'construction_manager'
  const canBatchConfirm = user.role === 'project_manager'

  return (
    <div>
      {error && <div className="error-msg">{error}<button style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setError('')}>✕</button></div>}

      <div className="toolbar">
        <div className="filter-group">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">全部状态</option>
            <option value="pending_review">待审核</option>
            <option value="approved">审核通过</option>
            <option value="returned">已退回</option>
            <option value="synced">已同步</option>
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="">全部优先级</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">全部类型</option>
            <option value="subcontractor_entry">分包进场</option>
            <option value="qualification_review">资质审核</option>
            <option value="safety_briefing">安全交底</option>
          </select>
          <select value={overdueFilter} onChange={e => setOverdueFilter(e.target.value)}>
            <option value="">到期状态</option>
            <option value="normal">正常</option>
            <option value="near_due">临期</option>
            <option value="overdue">逾期</option>
          </select>
        </div>
        <div style={{ flex: 1 }} />
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>新建分包进场单</button>
        )}
        {selected.size > 0 && (
          <button className="btn btn-warning" onClick={() => { setShowBatchModal(true); setBatchResults(null); }}>
            批量处理 ({selected.size})
          </button>
        )}
      </div>

      {loading ? (
        <div className="empty-state"><div className="icon">⏳</div><p>加载中...</p></div>
      ) : entries.length === 0 ? (
        <div className="empty-state"><div className="icon">📋</div><p>暂无分包进场单</p></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="entry-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox" checked={selected.size === entries.length && entries.length > 0} onChange={toggleAll} />
                </th>
                <th>标题 / 分包单位</th>
                <th>类型</th>
                <th>状态</th>
                <th>优先级</th>
                <th>责任人</th>
                <th>当前处理人</th>
                <th>截止时间</th>
                <th>异常</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} onClick={() => onEntryClick(entry.id)}>
                  <td onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(entry.id)}
                      onChange={() => toggleSelect(entry.id)}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{entry.title}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>{entry.subcontractor_name}</div>
                  </td>
                  <td><span style={{ fontSize: 12 }}>{CATEGORY_LABELS[entry.category]}</span></td>
                  <td>
                    <span className={`status-tag status-${entry.status}`}>
                      {STATUS_LABELS[entry.status]}
                    </span>
                  </td>
                  <td>
                    <span className={`priority-${entry.priority}`}>
                      <span className="priority-dot" />
                      {PRIORITY_LABELS[entry.priority]}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{entry.responsible_person}</td>
                  <td style={{ fontSize: 12 }}>{entry.current_handler || '-'}</td>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {formatDeadline(entry.deadline)}
                    <span className={`overdue-tag ${entry.overdue_group}`}>
                      {OVERDUE_GROUP_LABELS[entry.overdue_group]}
                    </span>
                  </td>
                  <td>
                    {entry.exception_tags && entry.exception_tags.split(',').filter(Boolean).map((tag, i) => (
                      <span key={i} className="exception-tag">{tag}</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showBatchModal && (
        <div className="modal-overlay" onClick={() => setShowBatchModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>批量处理分包进场单</h3>
            <p style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 16 }}>
              已选择 {selected.size} 条记录
            </p>

            {batchResults ? (
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>处理结果</p>
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {batchResults.map((r, i) => (
                    <div key={i} className={`batch-result-item ${r.success ? 'success' : 'fail'}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{r.entry_title || `单据 #${r.entry_id}`}</span>
                        <span style={{ fontSize: 12 }}>{r.success ? '✓ ' : '✕ '}{r.reason}</span>
                      </div>
                      {!r.success && (
                        <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                          单据 #{r.entry_id}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: '#8c8c8c' }}>
                  成功 {batchResults.filter(r => r.success).length} 条，失败 {batchResults.filter(r => !r.success).length} 条
                </div>
                <div className="modal-actions">
                  <button className="btn btn-primary" onClick={() => { setShowBatchModal(false); onRefresh(); }}>确定</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="form-group">
                  <label>操作类型</label>
                  <select value={batchAction} onChange={e => setBatchAction(e.target.value)}>
                    <option value="">请选择操作</option>
                    {canBatchApprove && <option value="approve">批量审核通过</option>}
                    {canBatchConfirm && <option value="confirm">批量确认同步</option>}
                    <option value="return">批量退回</option>
                  </select>
                </div>
                {batchAction === 'return' ? (
                  <div className="form-group">
                    <label>退回原因</label>
                    <textarea
                      rows={3}
                      value={batchReturnReason}
                      onChange={e => setBatchReturnReason(e.target.value)}
                      placeholder="请输入退回原因"
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>处理意见（选填）</label>
                    <input
                      type="text"
                      value={batchResult}
                      onChange={e => setBatchResult(e.target.value)}
                      placeholder="批量处理意见"
                    />
                  </div>
                )}
                <div className="modal-actions">
                  <button className="btn btn-default" onClick={() => setShowBatchModal(false)}>取消</button>
                  <button
                    className="btn btn-primary"
                    onClick={handleBatchProcess}
                    disabled={!batchAction || batchLoading}
                  >
                    {batchLoading ? '处理中...' : '确认处理'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>新建分包进场单</h3>
            <div className="form-group">
              <label>标题 *</label>
              <input
                type="text"
                value={createForm.title}
                onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                placeholder="如：XX集团分包进场申请"
              />
            </div>
            <div className="form-group">
              <label>分包单位名称 *</label>
              <input
                type="text"
                value={createForm.subcontractor_name}
                onChange={e => setCreateForm(f => ({ ...f, subcontractor_name: e.target.value }))}
                placeholder="如：XX建设集团"
              />
            </div>
            <div className="form-group">
              <label>类型</label>
              <select
                value={createForm.category}
                onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
              >
                <option value="subcontractor_entry">分包进场</option>
                <option value="qualification_review">资质审核</option>
                <option value="safety_briefing">安全交底</option>
              </select>
            </div>
            <div className="form-group">
              <label>优先级</label>
              <select
                value={createForm.priority}
                onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value }))}
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
            <div className="form-group">
              <label>责任人</label>
              <input
                type="text"
                value={createForm.responsible_person}
                onChange={e => setCreateForm(f => ({ ...f, responsible_person: e.target.value }))}
                placeholder={user.name}
              />
            </div>
            <div className="form-group">
              <label>截止时间 *</label>
              <input
                type="datetime-local"
                value={createForm.deadline}
                onChange={e => setCreateForm(f => ({ ...f, deadline: e.target.value }))}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setShowCreateModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={createLoading}>
                {createLoading ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
