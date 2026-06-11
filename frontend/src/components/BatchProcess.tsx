import { createSignal, Show, For, createMemo } from 'solid-js'
import { batchUpdate } from '../api'
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

function BatchProcess(props: { selectedOrders: RepairOrder[] }) {
  const [action, setAction] = createSignal('已接单')
  const [remark, setRemark] = createSignal('')
  const [results, setResults] = createSignal<BatchResult[] | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal('')

  const successResults = createMemo(() => results()?.filter(r => r.success) || [])
  const failResults = createMemo(() => results()?.filter(r => !r.success) || [])

  const getCurrentHandler = (order: RepairOrder): string => {
    if (order.technician_id && order.technician_id > 0) {
      return `师傅调度(ID:${order.technician_id})`
    }
    if (order.manager_id && order.manager_id > 0) {
      return `服务经理(ID:${order.manager_id})`
    }
    return '待分配'
  }

  const handleSubmit = async () => {
    if (props.selectedOrders.length === 0) {
      setError('请选择要处理的工单')
      return
    }
    setLoading(true)
    setError('')
    try {
      const orderIds = props.selectedOrders.map(o => o.id)
      const data: any = { order_ids: orderIds, status: action() }
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
                  <th>当前状态</th>
                  <th>优先级</th>
                  <th>当前处理人</th>
                  <th>版本</th>
                  <th>截止日期</th>
                  <th>到期状态</th>
                </tr>
              </thead>
              <tbody>
                <For each={props.selectedOrders}>
                  {(order) => {
                    const expiry = calcExpiry(order.deadline, order.status)
                    return (
                      <tr>
                        <td>{order.order_no}</td>
                        <td>{order.title}</td>
                        <td>
                          <span class={`badge ${statusColorMap[order.status] || ''}`}>
                            {order.status}
                          </span>
                        </td>
                        <td>
                          {order.priority === 'urgent' ? (
                            <span class="badge badge-urgent">紧急</span>
                          ) : '普通'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', 'font-size': '13px' }}>
                          {getCurrentHandler(order)}
                        </td>
                        <td style={{ 'font-family': 'monospace' }}>
                          v{order.version}
                        </td>
                        <td>{formatDate(order.deadline)}</td>
                        <td>
                          <span class={`badge badge-expiry-${expiry}`}>
                            {expiryLabels[expiry]}
                          </span>
                        </td>
                      </tr>
                    )
                  }}
                </For>
              </tbody>
            </table>
          </div>

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

          <div style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
            <button class="btn btn-primary" onClick={handleSubmit} disabled={loading()}>
              {loading() ? '处理中...' : '提交批量操作'}
            </button>
            <span style={{ color: 'var(--text-secondary)', 'font-size': '12px' }}>
              提交后系统将逐条校验，不符合条件的工单会被跳过并返回失败原因
            </span>
          </div>

          <Show when={error()}>
            <div class="error-message">{error()}</div>
          </Show>
        </Show>
      </div>

      <Show when={results()}>
        <div class="card batch-results">
          <h3>处理结果</h3>
          <div style={{ display: 'flex', gap: '16px', 'margin-bottom': '16px' }}>
            <span class="badge badge-approved">
              成功 {successResults().length} 条
            </span>
            <span class="badge badge-returned">
              失败 {failResults().length} 条
            </span>
            <span class="badge badge-accepted">
              共 {results()!.length} 条
            </span>
          </div>

          <Show when={successResults().length > 0}>
            <h4 style={{ color: 'var(--status-approved)', 'margin-top': '0' }}>
              ✅ 成功 ({successResults().length} 条)
            </h4>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>工单号</th>
                    <th>状态变更</th>
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
                        <td>
                          <span class="badge badge-approved">成功</span>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>

          <Show when={failResults().length > 0}>
            <h4 style={{ color: 'var(--status-returned)', 'margin-top': '20px' }}>
              ❌ 失败 ({failResults().length} 条)
            </h4>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>工单号</th>
                    <th>原状态</th>
                    <th>目标状态</th>
                    <th>失败原因</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={failResults()}>
                    {(r) => (
                      <tr>
                        <td>{r.order_no || `#${r.order_id}`}</td>
                        <td>
                          <span class={`badge ${statusColorMap[r.from_status] || ''}`}>
                            {r.from_status || '-'}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {r.to_status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--status-returned)' }}>
                          {r.message}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
            <p style={{ 'font-size': '13px', color: 'var(--text-secondary)', 'margin-top': '8px' }}>
              失败的工单状态保持不变，请根据失败原因调整后再试
            </p>
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default BatchProcess
