import { createSignal, createEffect, onMount, For, Show } from 'solid-js'
import { api } from '../utils/api'
import { useAuth } from '../stores/authStore'
import {
  StatusNames, StatusColors, SourceModuleNames,
  PriorityNames, PriorityColors, Action, ActionNames,
  RoleAllowedActions, OrderStatus,
} from '../utils/constants'

const OrderList = (props) => {
  const auth = useAuth()
  const [orders, setOrders] = createSignal([])
  const [stats, setStats] = createSignal({})
  const [constants, setConstants] = createSignal({})
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal('')
  const [successMsg, setSuccessMsg] = createSignal('')
  const [groupFilter, setGroupFilter] = createSignal('')
  const [statusFilter, setStatusFilter] = createSignal('')
  const [sourceFilter, setSourceFilter] = createSignal('')
  const [search, setSearch] = createSignal('')
  const [selectedIds, setSelectedIds] = createSignal(new Set())
  const [batchAction, setBatchAction] = createSignal('')
  const [batchOpinion, setBatchOpinion] = createSignal('')

  const [batchResult, setBatchResult] = createSignal(null)
  const [showBatchModal, setShowBatchModal] = createSignal(false)

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (groupFilter()) params.append('group', groupFilter())
      if (statusFilter()) params.append('status', statusFilter())
      if (sourceFilter()) params.append('source_module', sourceFilter())
      if (search()) params.append('search', search())
      const data = await api.get(`/api/orders?${params.toString()}`)
      setOrders(data.orders)
      setStats(data.stats)
      setConstants(data.constants)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  onMount(fetchData)

  createEffect(() => {
    if (auth.user()) fetchData()
  })

  const toggleSelect = (id) => {
    const next = new Set(selectedIds())
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const toggleSelectAll = () => {
    if (selectedIds().size === orders().length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders().map(o => o.id)))
    }
  }

  const openBatchModal = () => {
    if (selectedIds().size === 0) {
      setError('请先选择要批量处理的工单')
      return
    }
    setBatchResult(null)
    setShowBatchModal(true)
  }

  const executeBatch = async () => {
    if (!batchAction()) {
      setError('请选择批量操作')
      return
    }
    const versions = {}
    orders().forEach(o => {
      if (selectedIds().has(o.id)) versions[o.id] = o.version
    })
    setError('')
    try {
      const result = await api.post('/api/orders/batch', {
        action: batchAction(),
        order_ids: Array.from(selectedIds()),
        order_versions: versions,
        opinion: batchOpinion(),
      })
      setBatchResult(result)
      setShowBatchModal(false)
      setSelectedIds(new Set())
      setBatchAction('')
      setBatchOpinion('')
      fetchData()
    } catch (e) {
      setError(e.message)
    }
  }

  const getAvailableBatchActions = () => {
    const allowed = RoleAllowedActions[auth.user()?.role] || []
    return allowed.map(a => ({ value: a, label: ActionNames[a] }))
  }

  return (
    <div>
      <h2 class="page-title">报修工单列表</h2>

      <Show when={error()}>
        <div class="banner-error">⚠️ {error()}</div>
      </Show>
      <Show when={successMsg()}>
        <div class="banner-success">✅ {successMsg()}</div>
      </Show>

      <Show when={batchResult()}>
        <div class="card">
          <h3 class="section-title">批量处理结果</h3>
          <div class="batch-summary">
            <div>共处理: <b>{batchResult().total}</b> 条</div>
            <div class="success">成功: {batchResult().success_count}</div>
            <div class="failed">失败: {batchResult().failed_count}</div>
          </div>
          <div class="batch-items">
            <For each={batchResult().items}>
              {(item) => (
                <div class={`batch-item ${item.success ? 'success' : 'failed'}`}>
                  <span>
                    📋 {item.order_no}
                    {item.from_status && (
                      <span style="margin-left:8px;font-size:12px;color:#64748b;">
                        [{StatusNames[item.from_status] || item.from_status}
                        {item.to_status && item.success ? ` → ${StatusNames[item.to_status] || item.to_status}` : ''}]
                      </span>
                    )}
                  </span>
                  <span>
                    {item.success ? '✅ ' : '❌ '}
                    {item.message}
                    {item.error_code ? <code style="margin-left:6px;">[{item.error_code}]</code> : ''}
                  </span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      <div class="stats-grid">
        <div class="stat-card group-1">
          <div class="stat-value">{stats()['待分派'] || 0}</div>
          <div class="stat-label">待分派</div>
        </div>
        <div class="stat-card group-2">
          <div class="stat-value">{stats()['已转办'] || 0}</div>
          <div class="stat-label">已转办</div>
        </div>
        <div class="stat-card group-3">
          <div class="stat-value">{stats()['已回访'] || 0}</div>
          <div class="stat-label">已回访</div>
        </div>
        <div class="stat-card normal">
          <div class="stat-value">{stats()['正常'] || 0}</div>
          <div class="stat-label">🟢 正常</div>
        </div>
        <div class="stat-card near">
          <div class="stat-value">{stats()['临期'] || 0}</div>
          <div class="stat-label">🟡 临期</div>
        </div>
        <div class="stat-card overdue">
          <div class="stat-value">{stats()['逾期'] || 0}</div>
          <div class="stat-label">🔴 逾期</div>
        </div>
      </div>

      <div class="toolbar">
        <input
          class="search-input"
          placeholder="🔍 搜索工单号/标题/业主..."
          value={search()}
          onInput={(e) => setSearch(e.target.value)}
        />
        <select value={groupFilter()} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="">全部分组</option>
          <option value="待分派">待分派</option>
          <option value="已转办">已转办</option>
          <option value="已回访">已回访</option>
        </select>
        <select value={statusFilter()} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">全部状态</option>
          <For each={Object.entries(StatusNames)}>
            {([k, v]) => <option value={k}>{v}</option>}
          </For>
        </select>
        <select value={sourceFilter()} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="">全部来源</option>
          <For each={Object.entries(SourceModuleNames)}>
            {([k, v]) => <option value={k}>{v}</option>}
          </For>
        </select>
        <button class="btn btn-secondary" onClick={fetchData}>🔄 刷新</button>
        <Show when={selectedIds().size > 0}>
          <button class="btn btn-primary" onClick={openBatchModal}>
            ⚡ 批量处理 ({selectedIds().size})
          </button>
        </Show>
      </div>

      <Show when={showBatchModal()}>
        <div class="modal-mask" onClick={() => setShowBatchModal(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>批量处理工单 ({selectedIds().size} 条)</h3>
              <button class="modal-close" onClick={() => setShowBatchModal(false)}>×</button>
            </div>
            <div class="detail-grid">
              <div class="detail-field">
                <label>选择操作</label>
                <select value={batchAction()} onChange={(e) => setBatchAction(e.target.value)}>
                  <option value="">请选择操作...</option>
                  <For each={getAvailableBatchActions()}>
                    {(a) => <option value={a.value}>{a.label}</option>}
                  </For>
                </select>
              </div>
              <div class="detail-field">
                <label>处理意见</label>
                <textarea
                  placeholder="填写批量处理意见..."
                  value={batchOpinion()}
                  onInput={(e) => setBatchOpinion(e.target.value)}
                />
              </div>
              <div class="detail-field">
                <div class="hint" style="font-size:12px;color:#64748b;">
                  ⚠️ 完成维修、回访、复核归档等动作会校验每条工单下真实附件数量，缺证据的工单会被拦截并写入审计备注。
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button class="btn btn-secondary" onClick={() => setShowBatchModal(false)}>取消</button>
              <button class="btn btn-primary" onClick={executeBatch}>确认批量处理</button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={loading()}>
        <div class="empty-state">加载中...</div>
      </Show>

      <Show when={!loading() && orders().length === 0}>
        <div class="empty-state">暂无工单数据</div>
      </Show>

      <Show when={!loading() && orders().length > 0}>
        <table class="data-table">
          <thead>
            <tr>
              <th class="checkbox-cell">
                <input
                  type="checkbox"
                  checked={selectedIds().size === orders().length && orders().length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>工单号</th>
              <th>标题</th>
              <th>来源</th>
              <th>业主</th>
              <th>优先级</th>
              <th>状态</th>
              <th>当前处理人</th>
              <th>截止时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <For each={orders()}>
              {(o) => (
                <tr
                  class={o.is_overdue ? 'row-overdue' : o.is_near_deadline ? 'row-near' : ''}
                  onClick={(e) => { if (e.target.tagName !== 'INPUT') props.onOrderClick(o.id) }}
                  style="cursor:pointer;"
                >
                  <td class="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds().has(o.id)}
                      onChange={() => toggleSelect(o.id)}
                    />
                  </td>
                  <td>
                    {o.order_no}
                    {o.is_overdue && <span class="overdue-badge">逾期</span>}
                    {!o.is_overdue && o.is_near_deadline && <span class="near-badge">临期</span>}
                  </td>
                  <td>{o.title}</td>
                  <td>{SourceModuleNames[o.source_module] || o.source_module}</td>
                  <td>{o.owner_name || '-'}</td>
                  <td>
                    <span class="priority-tag" style={{ background: PriorityColors[o.priority] || '#6b7280' }}>
                      {PriorityNames[o.priority] || o.priority}
                    </span>
                  </td>
                  <td>
                    <span class="status-tag" style={{ background: StatusColors[o.status] || '#6b7280' }}>
                      {StatusNames[o.status] || o.status}
                    </span>
                  </td>
                  <td>{o.current_handler || '-'}</td>
                  <td>{o.deadline || '-'}</td>
                  <td>
                    <button class="btn btn-primary" style="padding:4px 10px;font-size:12px;">详情</button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  )
}

export default OrderList
