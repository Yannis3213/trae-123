import { createSignal, createEffect, onMount, For, Show, onCleanup } from 'solid-js'
import { api } from '../utils/api'
import { useAuth } from '../stores/authStore'
import {
  StatusNames, StatusColors, SourceModuleNames,
  PriorityNames, PriorityColors, ActionNames, RoleNames,
  RoleAllowedActions, OrderStatus, Action,
} from '../utils/constants'

const OrderDetail = (props) => {
  const auth = useAuth()
  const [order, setOrder] = createSignal(null)
  const [records, setRecords] = createSignal([])
  const [attachments, setAttachments] = createSignal([])
  const [audits, setAudits] = createSignal([])
  const [exceptions, setExceptions] = createSignal([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal('')
  const [success, setSuccess] = createSignal('')
  const [editing, setEditing] = createSignal(false)
  const [formData, setFormData] = createSignal({})
  const [action, setAction] = createSignal('')
  const [actionOpinion, setActionOpinion] = createSignal('')
  const [hasEvidence, setHasEvidence] = createSignal(false)
  const [activeTab, setActiveTab] = createSignal('records')

  const fetchData = async () => {
    if (!props.orderId) return
    setLoading(true)
    setError('')
    try {
      const data = await api.get(`/api/orders/${props.orderId}`)
      setOrder(data.order)
      setRecords(data.records)
      setAttachments(data.attachments)
      setAudits(data.audits)
      setExceptions(data.exceptions)
      setFormData({
        title: data.order.title,
        owner_name: data.order.owner_name || '',
        owner_phone: data.order.owner_phone || '',
        address: data.order.address || '',
        repair_type: data.order.repair_type || '',
        description: data.order.description || '',
        priority: data.order.priority,
        deadline: data.order.deadline || '',
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  onMount(fetchData)

  const canEdit = () => order() && order().status !== OrderStatus.ARCHIVED

  const saveEdit = async () => {
    try {
      setError('')
      const result = await api.put(`/api/orders/${props.orderId}`, formData())
      setOrder(result.order)
      setEditing(false)
      setSuccess('补正保存成功')
      fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message)
    }
  }

  const executeAction = async () => {
    if (!action()) {
      setError('请选择操作')
      return
    }
    try {
      setError('')
      const result = await api.post(`/api/orders/${props.orderId}/action`, {
        action: action(),
        version: order().version,
        opinion: actionOpinion(),
        has_evidence: hasEvidence(),
      })
      setOrder(result.order)
      setAction('')
      setActionOpinion('')
      setHasEvidence(false)
      setSuccess(result.message || '操作成功')
      fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message)
    }
  }

  const getAvailableActions = () => {
    if (!order()) return []
    const allowed = RoleAllowedActions[auth.user()?.role] || []
    const os = order().status
    const result = []

    for (const a of allowed) {
      let valid = false
      switch (a) {
        case Action.DISPATCH:
          valid = [OrderStatus.PENDING_DISPATCH, OrderStatus.CORRECTED].includes(os)
          break
        case Action.CORRECT:
          valid = os === OrderStatus.RETURNED_FOR_CORRECTION
          break
        case Action.SUBMIT_REVIEW:
          valid = os === OrderStatus.VISITED
          break
        case Action.START_PROCESS:
          valid = [OrderStatus.DISPATCHED, OrderStatus.TRANSFERRED, OrderStatus.CORRECTED].includes(os)
          break
        case Action.TRANSFER:
          valid = [OrderStatus.DISPATCHED, OrderStatus.IN_PROGRESS].includes(os)
          break
        case Action.RETURN_FOR_CORRECTION:
          valid = [
            OrderStatus.DISPATCHED, OrderStatus.IN_PROGRESS, OrderStatus.TRANSFERRED,
            OrderStatus.COMPLETED, OrderStatus.VISITED, OrderStatus.REVIEWING,
          ].includes(os)
          break
        case Action.COMPLETE:
          valid = [OrderStatus.IN_PROGRESS, OrderStatus.TRANSFERRED].includes(os)
          break
        case Action.VISIT:
          valid = os === OrderStatus.COMPLETED
          break
        case Action.REVIEW_APPROVE:
        case Action.ARCHIVE:
          valid = os === OrderStatus.REVIEWING
          break
        case Action.REVIEW_REJECT:
          valid = os === OrderStatus.REVIEWING
          break
      }
      if (valid) result.push({ value: a, label: ActionNames[a] })
    }
    return result
  }

  return (
    <div>
      <a class="back-link" onClick={props.onBack}>← 返回工单列表</a>
      <h2 class="page-title">报修工单详情</h2>

      <Show when={error()}>
        <div class="banner-error">⚠️ {error()}</div>
      </Show>
      <Show when={success()}>
        <div class="banner-success">✅ {success()}</div>
      </Show>

      <Show when={loading()}>
        <div class="empty-state">加载中...</div>
      </Show>

      <Show when={!loading() && order()}>
        <Show when={exceptions().filter(e => !e.resolved).length > 0}>
          <div class="banner-warning">
            ⚠️ 存在未解决的异常：
            {exceptions().filter(e => !e.resolved).map(e => e.reason_text).join('；')}
          </div>
        </Show>

        <div class="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 class="section-title" style={{ border: 'none', margin: 0, padding: 0 }}>
                {order().order_no} - {order().title}
              </h3>
              <div style={{ marginTop: '8px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span class="status-tag" style={{ background: StatusColors[order().status] }}>
                  {StatusNames[order().status]}
                </span>
                <span class="priority-tag" style={{ background: PriorityColors[order().priority] }}>
                  {PriorityNames[order().priority]}
                </span>
                <span>{SourceModuleNames[order().source_module]}</span>
                {order().is_overdue && <span class="overdue-badge">已逾期</span>}
                {!order().is_overdue && order().is_near_deadline && <span class="near-badge">临期预警</span>}
              </div>
            </div>
            <div>
              <Show when={canEdit()}>
                <button class="btn btn-warning" onClick={() => setEditing(!editing())}>
                  {editing() ? '取消编辑' : '✏️ 补正信息'}
                </button>
              </Show>
            </div>
          </div>

          <div class="detail-grid">
            <div class="detail-field">
              <label>工单编号</label>
              <div class="value">{order().order_no}</div>
            </div>
            <div class="detail-field">
              <label>当前版本</label>
              <div class="value">v{order().version}</div>
            </div>
            <div class="detail-field">
              <label>当前处理人</label>
              <div class="value">{order().current_handler || '-'}</div>
            </div>
            <div class="detail-field">
              <label>截止时间</label>
              <div class="value">{order().deadline || '-'}</div>
            </div>
          </div>

          <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />

          <div class="detail-grid">
            <div class="detail-field">
              <label>工单标题</label>
              {editing() ? (
                <input
                  value={formData().title}
                  onInput={(e) => setFormData({ ...formData(), title: e.target.value })}
                />
              ) : (
                <div class="value">{order().title}</div>
              )}
            </div>
            <div class="detail-field">
              <label>业主姓名</label>
              {editing() ? (
                <input
                  value={formData().owner_name}
                  onInput={(e) => setFormData({ ...formData(), owner_name: e.target.value })}
                />
              ) : (
                <div class="value">{order().owner_name || '-'}</div>
              )}
            </div>
            <div class="detail-field">
              <label>业主电话</label>
              {editing() ? (
                <input
                  value={formData().owner_phone}
                  onInput={(e) => setFormData({ ...formData(), owner_phone: e.target.value })}
                />
              ) : (
                <div class="value">{order().owner_phone || '-'}</div>
              )}
            </div>
            <div class="detail-field">
              <label>报修地址</label>
              {editing() ? (
                <input
                  value={formData().address}
                  onInput={(e) => setFormData({ ...formData(), address: e.target.value })}
                />
              ) : (
                <div class="value">{order().address || '-'}</div>
              )}
            </div>
            <div class="detail-field">
              <label>报修类型</label>
              {editing() ? (
                <input
                  value={formData().repair_type}
                  onInput={(e) => setFormData({ ...formData(), repair_type: e.target.value })}
                />
              ) : (
                <div class="value">{order().repair_type || '-'}</div>
              )}
            </div>
            <div class="detail-field">
              <label>优先级</label>
              {editing() ? (
                <select
                  value={formData().priority}
                  onChange={(e) => setFormData({ ...formData(), priority: e.target.value })}
                >
                  <option value="low">低</option>
                  <option value="normal">普通</option>
                  <option value="high">高</option>
                  <option value="urgent">紧急</option>
                </select>
              ) : (
                <div class="value">{PriorityNames[order().priority]}</div>
              )}
            </div>
            <div class="detail-field" style={{ gridColumn: '1 / -1' }}>
              <label>报修描述</label>
              {editing() ? (
                <textarea
                  rows={3}
                  value={formData().description}
                  onInput={(e) => setFormData({ ...formData(), description: e.target.value })}
                />
              ) : (
                <div class="value">{order().description || '-'}</div>
              )}
            </div>
          </div>

          <Show when={editing()}>
            <div style={{ marginTop: '16px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button class="btn btn-secondary" onClick={() => setEditing(false)}>取消</button>
              <button class="btn btn-primary" onClick={saveEdit}>💾 保存补正</button>
            </div>
          </Show>

          <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />

          <Show when={order().last_opinion}>
            <div class="banner-warning">
              📝 上一处理人意见：{order().last_opinion}
            </div>
          </Show>

          <Show when={getAvailableActions().length > 0}>
            <div class="action-bar">
              <h4 style={{ width: '100%', marginBottom: '8px' }}>办理操作</h4>
              <div style={{ width: '100%', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={action()}
                  onChange={(e) => setAction(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                >
                  <option value="">请选择操作...</option>
                  <For each={getAvailableActions()}>
                    {(a) => <option value={a.value}>{a.label}</option>}
                  </For>
                </select>
                <label class="checkbox-field">
                  <input
                    type="checkbox"
                    checked={hasEvidence()}
                    onChange={(e) => setHasEvidence(e.target.checked)}
                  />
                  已提供证据附件
                </label>
              </div>
              <textarea
                placeholder="填写处理意见..."
                value={actionOpinion()}
                onInput={(e) => setActionOpinion(e.target.value)}
              />
              <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                <button class="btn btn-primary" onClick={executeAction}>✅ 确认提交</button>
              </div>
            </div>
          </Show>
        </div>

        <div class="tabs">
          <div
            class={`tab ${activeTab() === 'records' ? 'active' : ''}`}
            onClick={() => setActiveTab('records')}
          >
            📜 处理记录 ({records().length})
          </div>
          <div
            class={`tab ${activeTab() === 'attachments' ? 'active' : ''}`}
            onClick={() => setActiveTab('attachments')}
          >
            📎 附件 ({attachments().length})
          </div>
          <div
            class={`tab ${activeTab() === 'exceptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('exceptions')}
          >
            ⚠️ 异常原因 ({exceptions().length})
          </div>
          <div
            class={`tab ${activeTab() === 'audits' ? 'active' : ''}`}
            onClick={() => setActiveTab('audits')}
          >
            🔍 审计备注 ({audits().length})
          </div>
        </div>

        <div class="card">
          <Show when={activeTab() === 'records'}>
            <h3 class="section-title">处理记录 (操作轨迹)</h3>
            <Show when={records().length === 0}>
              <div class="empty-state">暂无处理记录</div>
            </Show>
            <ul class="timeline">
              <For each={records()}>
                {(r) => (
                  <li class="timeline-item">
                    <div class="timeline-dot" />
                    <div class="timeline-content">
                      <div class="timeline-header">
                        <span class="timeline-handler">
                          {r.handler} <small style={{ color: '#6b7280', fontWeight: 'normal' }}>({RoleNames[r.handler_role] || r.handler_role})</small>
                        </span>
                        <span class="timeline-time">{r.created_at}</span>
                      </div>
                      <div class="timeline-meta">
                        <span>操作: <b>{ActionNames[r.action] || r.action}</b></span>
                        <Show when={r.from_status}>
                          <span>
                            {StatusNames[r.from_status]} → {StatusNames[r.to_status]}
                          </span>
                        </Show>
                        <span>版本: v{r.version}</span>
                        {r.evidence_provided ? <span>✅ 已附证据</span> : null}
                      </div>
                      <Show when={r.opinion}>
                        <div class="timeline-opinion">{r.opinion}</div>
                      </Show>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>

          <Show when={activeTab() === 'attachments'}>
            <h3 class="section-title">证据附件</h3>
            <Show when={attachments().length === 0}>
              <div class="empty-state">暂无附件</div>
            </Show>
            <table class="data-table">
              <thead>
                <tr>
                  <th>文件名</th>
                  <th>上传人</th>
                  <th>上传时间</th>
                </tr>
              </thead>
              <tbody>
                <For each={attachments()}>
                  {(a) => (
                    <tr>
                      <td>📎 {a.file_name}</td>
                      <td>{a.uploaded_by || '-'}</td>
                      <td>{a.uploaded_at}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Show>

          <Show when={activeTab() === 'exceptions'}>
            <h3 class="section-title">异常原因</h3>
            <Show when={exceptions().length === 0}>
              <div class="empty-state">暂无异常记录</div>
            </Show>
            <table class="data-table">
              <thead>
                <tr>
                  <th>异常代码</th>
                  <th>异常描述</th>
                  <th>关联字段</th>
                  <th>发现人</th>
                  <th>状态</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                <For each={exceptions()}>
                  {(e) => (
                    <tr>
                      <td><code>{e.reason_code}</code></td>
                      <td>{e.reason_text}</td>
                      <td>{e.field_name || '-'}</td>
                      <td>{e.detected_by || '-'}</td>
                      <td>
                        {e.resolved
                          ? <span class="status-tag" style={{ background: '#10b981' }}>已解决</span>
                          : <span class="status-tag" style={{ background: '#ef4444' }}>未解决</span>}
                      </td>
                      <td>{e.created_at}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Show>

          <Show when={activeTab() === 'audits'}>
            <h3 class="section-title">审计备注 (拦截/复核追溯)</h3>
            <Show when={audits().length === 0}>
              <div class="empty-state">暂无审计记录</div>
            </Show>
            <ul class="timeline">
              <For each={audits()}>
                {(a) => (
                  <li class="timeline-item">
                    <div class={`timeline-dot ${a.note_type}`} />
                    <div class="timeline-content">
                      <div class="timeline-header">
                        <span class="timeline-handler">
                          {a.operator || '系统'}
                          <small style={{ color: '#6b7280', fontWeight: 'normal', marginLeft: '6px' }}>
                            [{a.note_type === 'exception' ? '异常记录' :
                              a.note_type === 'intercept' ? '操作拦截' :
                              a.note_type === 'review' ? '复核记录' :
                              a.note_type === 'correction' ? '补正记录' :
                              a.note_type === 'overdue' ? '超期记录' : a.note_type}]
                          </small>
                        </span>
                        <span class="timeline-time">{a.created_at}</span>
                      </div>
                      <div class="timeline-opinion">{a.content}</div>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default OrderDetail
