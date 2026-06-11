import { createSignal, Show, For, createMemo } from 'solid-js'
import { batchUpdate, updateStatus } from '../api'
import { loadStatistics } from '../store'
import type { BatchResult, RepairOrder } from '../types'

const actionOptions = [
  { key: '已接单', label: '接单', fromStatus: '待接单' },
  { key: '施工中', label: '开始施工', fromStatus: '已接单' },
  { key: '待验收', label: '完工', fromStatus: '施工中' },
  { key: '退回补正', label: '退回补正', fromStatus: '待验收' },
  { key: '已归档', label: '归档', fromStatus: '验收通过' }
]

const statusColorMap: Record<string, string> = {
  '待接单': 'badge-pending',
  '已接单': 'badge-accepted',
  '施工中': 'badge-in-progress',
  '待验收': 'badge-awaiting',
  '验收通过': 'badge-approved',
  '退回补正': 'badge-returned',
  '已归档': 'badge-archived'
}

interface DisplayRow extends RepairOrder {
  _result: BatchResult | null
  _displayStatus: string
  _displayVersion: number
  _displayTechId: number
  _displayManId: number
  _success?: boolean
  _failMsg?: string
  _retryLoading?: boolean
}

function BatchProcess(props: { selectedOrders: RepairOrder[] }) {
  const [action, setAction] = createSignal('已接单')
  const [remark, setRemark] = createSignal('')
  const [results, setResults] = createSignal<BatchResult[] | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [retryLoading, setRetryLoading] = createSignal<Set<number>>(new Set())
  const [error, setError] = createSignal('')

  const successResults = createMemo(() => results()?.filter(r => r.success) || [])
  const failResults = createMemo(() => results()?.filter(r => !r.success) || [])

  const handleSubmit = async () => {
    if (props.selectedOrders.length === 0) {
      setError('请选择要处理的工单')
      return
    }
    setLoading(true)
    setError('')
    try {
      const orders = props.selectedOrders.map(o => ({ order_id: o.id, version: o.version }))
      const data: any = { orders, status: action() }
      if (remark()) data.remark = remark()
      const res = await batchUpdate(data)
      if (res.code === 0) {
        setResults(res.data)
        loadStatistics()
      } else {
        setError(res.message || '批量操作失败')
      }
    } catch (err: any) {
      setError(err.message || '批量操作失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async (r: BatchResult) => {
    setRetryLoading(prev => {
      const next = new Set(prev)
      next.add(r.order_id)
      return next
    })
    try {
      const res = await updateStatus(r.order_id, {
        status: r.to_status,
        version: r.current_version
      })
      if (res.code === 0) {
        setResults(prev => {
          if (!prev) return prev
          return prev.map((x): BatchResult => {
            if (x.order_id !== r.order_id) return x
            const order = res.data
            return {
              ...x,
              success: true,
              message: '重试成功',
              to_status: order.status,
              version: order.version,
              current_version: order.version,
              technician_id: order.technician_id || 0,
              manager_id: order.manager_id || 0
            }
          })
        })
        loadStatistics()
      } else {
        setResults(prev => {
          if (!prev) return prev
          return prev.map(x => x.order_id === r.order_id ? { ...x, message: res.message || '重试失败' } : x)
        })
      }
    } catch (err: any) {
      setResults(prev => {
        if (!prev) return prev
        return prev.map(x => x.order_id === r.order_id ? { ...x, message: err.message || '重试失败' } : x)
      })
    } finally {
      setRetryLoading(prev => {
        const next = new Set(prev)
        next.delete(r.order_id)
        return next
      })
    }
  }

  const handleRetryAllFailed = async () => {
    const failed = failResults()
    if (failed.length === 0) return
    setLoading(true)
    setError('')
    try {
      const orders = failed.map(r => ({ order_id: r.order_id, version: r.current_version }))
      const data: any = { orders, status: failed[0].to_status }
      if (remark()) data.remark = remark()
      const res = await batchUpdate(data)
      if (res.code === 0) {
        setResults(prev => {
          if (!prev) return res.data
          const merged = [...prev]
          res.data.forEach(newR => {
            const idx = merged.findIndex(m => m.order_id === newR.order_id)
            if (idx >= 0) merged[idx] = newR
          })
          return merged
        })
        loadStatistics()
      } else {
        setError(res.message || '重试批量操作失败')
      }
    } catch (err: any) {
      setError(err.message || '重试批量操作失败')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (d: string) => {
    if (!d) return '-'
    return new Date(d).toLocaleString('zh-CN')
  }

  const calcExpiry = (deadline: string, status: string): string => {
    if (!deadline) return 'normal'
    if (status === '验收通过' || status === '已归档') return 'normal'
    const d = new Date(deadline)
    const now = new Date()
    if (d < now) return 'overdue'
    if (d <= new Date(now.getTime() + 3 * 24 * 3600 * 1000)) return 'approaching'
    return 'normal'
  }

  const expiryLabels: Record<string, string> = {
    normal: '正常',
    approaching: '临期',
    overdue: '逾期'
  }

  const selectedCount = props.selectedOrders.length

  const getMergedDisplayList = createMemo<DisplayRow[]>(() => {
    if (!results()) {
      return props.selectedOrders.map((o): DisplayRow => ({
        ...o,
        _result: null,
        _displayStatus: o.status,
        _displayVersion: o.version,
        _displayTechId: o.technician_id || 0,
        _displayManId: o.manager_id || 0
      }))
    }
    return props.selectedOrders.map((o): DisplayRow => {
      const r = results()!.find(x => x.order_id === o.id)
      if (r && r.success) {
        return {
          ...o,
          _result: r,
          _displayStatus: r.to_status,
          _displayVersion: r.version,
          _displayTechId: r.technician_id,
          _displayManId: r.manager_id,
          _success: true
        }
      }
      if (r && !r.success) {
        return {
          ...o,
          _result: r,
          _displayStatus: r.from_status,
          _displayVersion: r.current_version,
          _displayTechId: o.technician_id || 0,
          _displayManId: o.manager_id || 0,
          _success: false,
          _failMsg: r.message
        }
      }
      return {
        ...o,
        _result: null,
        _displayStatus: o.status,
        _displayVersion: o.version,
        _displayTechId: o.technician_id || 0,
        _displayManId: o.manager_id || 0
      }
    })
  })

  const getHandlerFromIds = (techId: number, manId: number): string => {
    if (techId && techId > 0) return `师傅调度(ID:${techId})`
    if (manId && manId > 0) return `服务经理(ID:${manId})`
    return '待分配'
  }

  return (
    <div>
      <div class="batch-header">
        <h2>批量处理</h2>
        <button class="btn btn-ghost" onClick={() => { window.location.hash = '#/' }}>
          ← 返回列表
        </button>
      </div>

      <div class="card">
        <h3 style={{ "margin-top": 0 }}>待处理工单 ({selectedCount} 个)</h3>
        <Show when={selectedCount === 0}>
          <p style={{ color: 'var(--text-secondary)' }}>未选择工单，请返回列表选择后再操作</p>
        </Show>
        <Show when={selectedCount > 0}>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>工单号</th>
                  <th>标题</th>
                  <th>状态</th>
                  <th>优先级</th>
                  <th>当前处理人</th>
                  <th>版本</th>
                  <th>截止日期</th>
                  <th>到期状态</th>
                  <Show when={results()}>
                    <th>目标动作</th>
                    <th>结果</th>
                  </Show>
                </tr>
              </thead>
              <tbody>
                <For each={getMergedDisplayList()}>
                  {(item) => {
                    const expiry = calcExpiry(item.deadline, item._displayStatus)
                    const submittedVer = item._result ? item._result.submitted_version : item.version
                    const hasVerDiff = item._result && !item._success && submittedVer !== item._displayVersion
                    return (
                      <tr class={item._result ? (item._success ? 'row-success' : 'row-fail') : ''}>
                        <td>{item.order_no}</td>
                        <td>{item.title}</td>
                        <td>
                          <span class={`badge ${statusColorMap[item._displayStatus] || ''}`}>
                            {item._displayStatus}
                          </span>
                          <Show when={item._result && item._success}>
                            <span style={{ "margin-left": '4px', "font-size": '11px', color: 'var(--status-approved)' }}>
                              ↻ 已更新
                            </span>
                          </Show>
                        </td>
                        <td>
                          {item.priority === 'urgent' ? (
                            <span class="badge badge-urgent">紧急</span>
                          ) : '普通'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', 'font-size': '13px' }}>
                          {getHandlerFromIds(item._displayTechId, item._displayManId)}
                        </td>
                        <td style={{ 'font-family': 'monospace' }}>
                          <span title="数据库当前版本">v{item._displayVersion}</span>
                          <Show when={hasVerDiff}>
                            <span style={{ "margin-left": '6px', "font-size": '11px', color: 'var(--status-returned)' }}>
                              (提交 v{submittedVer} 不匹配)
                            </span>
                          </Show>
                        </td>
                        <td>{formatDate(item.deadline)}</td>
                        <td>
                          <span class={`badge badge-expiry-${expiry}`}>
                            {expiryLabels[expiry]}
                          </span>
                        </td>
                        <Show when={results()}>
                          <td>
                            <Show when={item._result}>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {item._result!.from_status}
                              </span>
                              {' → '}
                              <span class={`badge ${statusColorMap[item._result!.to_status] || ''}`}>
                                {item._result!.to_status}
                              </span>
                            </Show>
                          </td>
                          <td>
                            <Show when={item._success}>
                              <span class="badge badge-approved">成功</span>
                            </Show>
                            <Show when={item._success === false}>
                              <span class="badge badge-returned">失败</span>
                            </Show>
                          </td>
                        </Show>
                      </tr>
                    )
                  }}
                </For>
              </tbody>
            </table>
          </div>

          <Show when={!results()}>
            <div style={{ display: 'flex', gap: '12px', 'margin-top': '20px', 'flex-wrap': 'wrap' }}>
              <div class="form-group" style={{ flex: '1', 'min-width': '200px' }}>
                <label>操作类型</label>
                <select value={action()} onChange={(e) => setAction(e.currentTarget.value)}>
                  <For each={actionOptions}>
                    {(opt) => <option value={opt.key}>{opt.label}（从 {opt.fromStatus} 开始）</option>}
                  </For>
                </select>
              </div>
              <div class="form-group" style={{ flex: '2', 'min-width': '300px' }}>
                <label>备注</label>
                <textarea
                  value={remark()}
                  onInput={(e) => setRemark(e.currentTarget.value)}
                  placeholder="输入备注（可选）"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', 'align-items': 'center', 'flex-wrap': 'wrap' }}>
              <button class="btn btn-primary" onClick={handleSubmit} disabled={loading()}>
                {loading() ? '处理中...' : '提交批量操作'}
              </button>
              <span style={{ color: 'var(--text-secondary)', 'font-size': '12px' }}>
                提交时将逐条携带版本号 v{props.selectedOrders.map(o => o.version).join('/v')}
              </span>
            </div>
          </Show>

          <Show when={results()}>
            <div style={{ display: 'flex', gap: '8px', 'margin-top': '20px', 'align-items': 'center', 'flex-wrap': 'wrap' }}>
              <span style={{ color: 'var(--text-secondary)', 'font-size': '12px' }}>
                ✅ 成功 {successResults().length} 条 / ❌ 失败 {failResults().length} 条
              </span>
              <Show when={failResults().length > 0}>
                <button
                  class="btn btn-secondary"
                  onClick={handleRetryAllFailed}
                  disabled={loading()}
                  title="使用当前版本批量重试所有失败项"
                >
                  {loading() ? '重试中...' : `批量重试失败项(${failResults().length})`}
                </button>
              </Show>
              <button class="btn btn-ghost" onClick={() => { setResults(null); setError('') }}>
                重新选择操作
              </button>
            </div>
          </Show>

          <Show when={error()}>
            <div class="error-message">{error()}</div>
          </Show>
        </Show>
      </div>

      <Show when={results() && failResults().length > 0}>
        <div class="card batch-results">
          <h4 style={{ color: 'var(--status-returned)', 'margin-top': '0' }}>
            ❌ 失败详情 ({failResults().length} 条)
          </h4>
          <p style={{ "font-size": '13px', color: 'var(--text-secondary)', "margin-top": '-8px' }}>
            失败工单状态保持不变，请根据原因调整后再试。单条重试将使用数据库当前版本。
          </p>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>工单号</th>
                  <th>原状态</th>
                  <th>目标状态</th>
                  <th>提交版本</th>
                  <th>当前版本</th>
                  <th>失败原因</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <For each={failResults()}>
                  {(r) => {
                    const verMismatch = r.submitted_version !== r.current_version
                    const isRetryLoading = retryLoading().has(r.order_id)
                    return (
                      <tr>
                        <td>{r.order_no || `#${r.order_id}`}</td>
                        <td>
                          <span class={`badge ${statusColorMap[r.from_status] || ''}`}>
                            {r.from_status || '-'}
                          </span>
                        </td>
                        <td>
                          <span class={`badge ${statusColorMap[r.to_status] || ''}`}>
                            {r.to_status}
                          </span>
                        </td>
                        <td style={{ 'font-family': 'monospace' }}>
                          v{r.submitted_version}
                        </td>
                        <td style={{ 'font-family': 'monospace' }}>
                          <span class={verMismatch ? 'ver-mismatch' : ''}>
                            v{r.current_version}
                          </span>
                          <Show when={verMismatch}>
                            <span style={{ "margin-left": '4px', "font-size": '11px', color: 'var(--status-returned)' }}>
                              (版本冲突)
                            </span>
                          </Show>
                        </td>
                        <td style={{ color: 'var(--status-returned)' }}>
                          {r.message}
                        </td>
                        <td>
                          <button
                            class="btn btn-sm btn-secondary"
                            onClick={() => handleRetry(r)}
                            disabled={isRetryLoading}
                          >
                            {isRetryLoading ? '重试中...' : '单条重试'}
                          </button>
                        </td>
                      </tr>
                    )
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>

      <Show when={results() && successResults().length > 0}>
        <div class="card batch-results">
          <h4 style={{ color: 'var(--status-approved)', 'margin-top': '0' }}>
            ✅ 成功详情 ({successResults().length} 条)
          </h4>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>工单号</th>
                  <th>状态变更</th>
                  <th>版本</th>
                  <th>处理人</th>
                  <th>结果</th>
                </tr>
              </thead>
              <tbody>
                <For each={successResults()}>
                  {(r) => (
                    <tr>
                      <td>{r.order_no}</td>
                      <td>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {r.from_status}
                        </span>
                        {' → '}
                        <span class={`badge ${statusColorMap[r.to_status] || ''}`}>
                          {r.to_status}
                        </span>
                      </td>
                      <td style={{ 'font-family': 'monospace' }}>
                        v{r.submitted_version} → v{r.version}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', 'font-size': '13px' }}>
                        {getHandlerFromIds(r.technician_id, r.manager_id)}
                      </td>
                      <td>
                        <span class="badge badge-approved">成功</span>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>
    </div>
  )
}

export default BatchProcess
