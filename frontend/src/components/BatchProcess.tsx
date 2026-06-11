import { createSignal, Show, For } from 'solid-js'
import { batchUpdate } from '../api'
import type { BatchResult } from '../types'

const actionOptions = [
  { key: '已接单', label: '接单' },
  { key: '施工中', label: '开始施工' },
  { key: '待验收', label: '完工' },
  { key: '退回补正', label: '退回补正' },
  { key: '已归档', label: '归档' }
]

function BatchProcess(props: { selectedIds: number[] }) {
  const [action, setAction] = createSignal('已接单')
  const [remark, setRemark] = createSignal('')
  const [results, setResults] = createSignal<BatchResult[] | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal('')

  const handleSubmit = async () => {
    if (props.selectedIds.length === 0) {
      setError('请选择要处理的工单')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data: any = { order_ids: props.selectedIds, status: action() }
      if (remark()) data.remark = remark()
      const res = await batchUpdate(data)
      if (res.code === 0) {
        setResults(res.data)
      } else {
        setError(res.message || '批量操作失败')
      }
    } catch (err: any) {
      setError(err.message || '批量操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div class="batch-header">
        <h2>批量处理</h2>
        <button class="btn btn-ghost" onClick={() => { window.location.hash = '#/' }}>
          返回列表
        </button>
      </div>

      <div class="card">
        <div class="form-group">
          <label>已选工单 ({props.selectedIds.length} 个)</label>
          <div style={{ "font-size": '14px', color: 'var(--text-secondary)' }}>
            {props.selectedIds.join(', ')}
          </div>
        </div>

        <div class="form-group">
          <label>操作类型</label>
          <select value={action()} onChange={(e) => setAction(e.currentTarget.value)}>
            <For each={actionOptions}>
              {(opt) => <option value={opt.key}>{opt.label}</option>}
            </For>
          </select>
        </div>

        <div class="form-group">
          <label>备注</label>
          <textarea
            value={remark()}
            onInput={(e) => setRemark(e.currentTarget.value)}
            placeholder="输入备注（可选）"
          />
        </div>

        <button class="btn btn-primary" onClick={handleSubmit} disabled={loading()}>
          {loading() ? '处理中...' : '提交'}
        </button>

        <Show when={error()}>
          <div class="error-message">{error()}</div>
        </Show>
      </div>

      <Show when={results()}>
        <div class="card batch-results">
          <h3>处理结果</h3>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>工单ID</th>
                  <th>结果</th>
                  <th>消息</th>
                </tr>
              </thead>
              <tbody>
                <For each={results()!}>
                  {(r) => (
                    <tr>
                      <td>{r.order_id}</td>
                      <td>
                        <span class={`badge ${r.success ? 'badge-approved' : 'badge-returned'}`}>
                          {r.success ? '成功' : '失败'}
                        </span>
                      </td>
                      <td>{r.message}</td>
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
