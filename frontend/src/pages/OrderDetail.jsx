import { createSignal, createEffect, onMount, For, Show, onCleanup } from 'solid-js'
import { api } from '../utils/api'
import { useAuth } from '../stores/authStore'
import {
  StatusNames, StatusColors, SourceModuleNames,
  PriorityNames, PriorityColors, ActionNames, RoleNames,
  RoleAllowedActions, OrderStatus, Action, Role,
} from '../utils/constants'

const REQUIRED_EVIDENCE_ACTIONS = [Action.COMPLETE, Action.VISIT, Action.REVIEW_APPROVE, Action.ARCHIVE]

const ACTION_AVAILABLE_STATUSES = {
  [Action.DISPATCH]: [OrderStatus.PENDING_DISPATCH, OrderStatus.CORRECTED],
  [Action.START_PROCESS]: [OrderStatus.DISPATCHED, OrderStatus.TRANSFERRED, OrderStatus.CORRECTED],
  [Action.TRANSFER]: [OrderStatus.DISPATCHED, OrderStatus.IN_PROGRESS],
  [Action.COMPLETE]: [OrderStatus.IN_PROGRESS, OrderStatus.TRANSFERRED],
  [Action.RETURN_FOR_CORRECTION]: [OrderStatus.DISPATCHED, OrderStatus.IN_PROGRESS, OrderStatus.TRANSFERRED, OrderStatus.COMPLETED, OrderStatus.VISITED, OrderStatus.REVIEWING],
  [Action.CORRECT]: [OrderStatus.RETURNED_FOR_CORRECTION],
  [Action.VISIT]: [OrderStatus.COMPLETED],
  [Action.SUBMIT_REVIEW]: [OrderStatus.VISITED],
  [Action.REVIEW_APPROVE]: [OrderStatus.REVIEWING],
  [Action.REVIEW_REJECT]: [OrderStatus.REVIEWING],
  [Action.ARCHIVE]: [OrderStatus.REVIEWING],
}

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
  const [correctionOpinion, setCorrectionOpinion] = createSignal('')
  const [activeTab, setActiveTab] = createSignal('records')
  const [uploading, setUploading] = createSignal(false)
  const [pendingFiles, setPendingFiles] = createSignal([])
  const [submitting, setSubmitting] = createSignal(false)

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

  const isArchived = () => order() && order().status === OrderStatus.ARCHIVED

  const canCorrect = () => {
    if (!order() || isArchived()) return false
    if (auth.role() !== Role.REGISTRAR) return false
    return order().status === OrderStatus.RETURNED_FOR_CORRECTION
  }

  const canShowCorrectionEntry = () => {
    if (!order() || isArchived()) return false
    if (auth.role() !== Role.REGISTRAR) return false
    return [OrderStatus.PENDING_DISPATCH, OrderStatus.RETURNED_FOR_CORRECTION, OrderStatus.CORRECTED, OrderStatus.VISITED].includes(order().status)
  }

  const availableActions = () => {
    if (!order() || isArchived() || submitting()) return []
    const role = auth.role()
    const allowedByRole = RoleAllowedActions[role] || []
    const status = order().status
    return allowedByRole.filter(a => {
      const st = ACTION_AVAILABLE_STATUSES[a]
      return st && st.includes(status)
    })
  }

  const actionNeedsEvidence = () => REQUIRED_EVIDENCE_ACTIONS.includes(action())

  const evidenceCount = () => attachments().length

  const lastHandler = () => {
    const recs = records()
    if (!recs || recs.length === 0) return null
    for (const r of recs) {
      if (r.opinion && r.action !== 'create') {
        return r
      }
    }
    return null
  }

  const pendingExceptions = () => (exceptions() || []).filter(e => !e.resolved)

  const saveCorrection = async () => {
    if (!order()) return
    try {
      setError('')
      setSubmitting(true)
      const payload = {
        ...formData(),
        version: order().version,
        correction_opinion: correctionOpinion() || undefined,
      }
      const result = await api.put(`/api/orders/${props.orderId}`, payload)
      setOrder(result.order)
      setEditing(false)
      setCorrectionOpinion('')
      setSuccess('补正保存成功')
      fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(`${e.errorCode ? `[${e.errorCode}] ` : ''}${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const executeAction = async () => {
    if (!action()) {
      setError('请选择办理动作')
      return
    }
    if (actionNeedsEvidence() && evidenceCount() === 0) {
      setError(`执行【${ActionNames[action()] || action()}】必须先上传证据附件，请先在附件 Tab 上传`)
      return
    }
    if (!order()) return
    try {
      setError('')
      setSubmitting(true)
      const result = await api.post(`/api/orders/${props.orderId}/action`, {
        action: action(),
        version: order().version,
        opinion: actionOpinion() || undefined,
      })
      setOrder(result.order)
      setAction('')
      setActionOpinion('')
      setSuccess(result.message || '操作成功')
      fetchData()
      setTimeout(() => setSuccess(''), 3500)
    } catch (e) {
      setError(`${e.errorCode ? `[${e.errorCode}] ` : ''}${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const onFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    setPendingFiles(files)
  }

  const uploadFiles = async () => {
    if (pendingFiles().length === 0) {
      setError('请先选择文件')
      return
    }
    try {
      setUploading(true)
      setError('')
      await api.upload(`/api/orders/${props.orderId}/attachments`, pendingFiles())
      setPendingFiles([])
      setSuccess('附件上传成功')
      fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const auditNoteTypeLabel = (t) => {
    const m = {
      intercept: '拦截',
      exception: '异常',
      review: '复核',
      correction: '补正',
      evidence: '证据',
      action: '动作',
      create: '创建',
      view: '查看',
      overdue: '超期',
    }
    return m[t] || t
  }

  const auditDotColor = (t) => {
    const m = {
      intercept: '#ef4444',
      exception: '#f59e0b',
      review: '#6366f1',
      correction: '#10b981',
      evidence: '#0ea5e9',
      action: '#3b82f6',
      create: '#8b5cf6',
      view: '#9ca3af',
      overdue: '#dc2626',
    }
    return m[t] || '#6b7280'
  }

  if (loading()) {
    return <div class="page"><div class="loading">加载工单详情...</div></div>
  }
  if (!order()) {
    return <div class="page"><div class="empty">工单不存在</div></div>
  }

  const o = order()

  return (
    <div class="page detail-page">
      <div class="detail-header">
        <div>
          <button class="btn btn-ghost" onClick={props.onBack}>← 返回列表</button>
          <h2 style="display:inline-block;margin-left:12px;">{o.order_no} — {o.title}</h2>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <span class="badge" style={`background:${StatusColors[o.status] || '#6b7280'};color:#fff;`}>
            {StatusNames[o.status] || o.status}
          </span>
          <span class="badge" style={`background:${PriorityColors[o.priority] || '#6b7280'};color:#fff;`}>
            {PriorityNames[o.priority] || o.priority}
          </span>
          <Show when={o.is_overdue}>
            <span class="badge" style="background:#dc2626;color:#fff;">已逾期</span>
          </Show>
          <Show when={!o.is_overdue && o.is_near_deadline}>
            <span class="badge" style="background:#f59e0b;color:#fff;">临期预警</span>
          </Show>
          <span class="badge">v{o.version}</span>
        </div>
      </div>

      <Show when={success()}>
        <div class="alert alert-success">{success()}</div>
      </Show>
      <Show when={error()}>
        <div class="alert alert-error">{error()}</div>
      </Show>

      <Show when={pendingExceptions().length > 0}>
        <div class="alert alert-warning">
          <strong>存在未解决异常（{pendingExceptions().length}项）：</strong>
          <For each={pendingExceptions()}>
            {e => <div>• [{e.reason_code}] {e.reason_text}</div>}
          </For>
        </div>
      </Show>

      <Show when={lastHandler()}>
        <div class="alert alert-info" style="background:#fffbeb;border-color:#fbbf24;">
          <strong>上一处理人意见（{lastHandler().handler} / {RoleNames[lastHandler().handler_role] || lastHandler().handler_role}）：</strong>
          <div style="margin-top:4px;">{lastHandler().opinion}</div>
        </div>
      </Show>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">工单信息</div>
          <Show when={!editing}>
            <table class="kv">
              <tr><td width="120">来源模块</td><td>{SourceModuleNames[o.source_module] || o.source_module}</td></tr>
              <tr><td>业主姓名</td><td>{o.owner_name || '—'}</td></tr>
              <tr><td>联系电话</td><td>{o.owner_phone || '—'}</td></tr>
              <tr><td>报修地址</td><td>{o.address || '—'}</td></tr>
              <tr><td>报修类型</td><td>{o.repair_type || '—'}</td></tr>
              <tr><td>问题描述</td><td>{o.description || '—'}</td></tr>
              <tr><td>截止期限</td><td>{o.deadline || '—'}</td></tr>
              <tr><td>当前处理人</td><td>{o.current_handler || '—'}（{RoleNames[o.current_handler_role] || o.current_handler_role || '—'}）</td></tr>
              <tr><td>创建人</td><td>{o.created_by || '—'}</td></tr>
              <tr><td>创建时间</td><td>{o.created_at}</td></tr>
              <tr><td>更新时间</td><td>{o.updated_at}</td></tr>
              <tr><td>最新意见</td><td>{o.last_opinion || '—'}</td></tr>
            </table>
            <Show when={canShowCorrectionEntry()}>
              <button class="btn btn-primary" disabled={submitting()} onClick={() => setEditing(true)}>
                补正工单信息
              </button>
            </Show>
          </Show>
          <Show when={editing}>
            <div class="form">
              <div class="form-row">
                <label>标题</label>
                <input value={formData().title} onInput={e => setFormData({...formData(), title: e.target.value})} />
              </div>
              <div class="form-row">
                <label>业主姓名</label>
                <input value={formData().owner_name} onInput={e => setFormData({...formData(), owner_name: e.target.value})} />
              </div>
              <div class="form-row">
                <label>联系电话</label>
                <input value={formData().owner_phone} onInput={e => setFormData({...formData(), owner_phone: e.target.value})} />
              </div>
              <div class="form-row">
                <label>报修地址</label>
                <input value={formData().address} onInput={e => setFormData({...formData(), address: e.target.value})} />
              </div>
              <div class="form-row">
                <label>报修类型</label>
                <input value={formData().repair_type} onInput={e => setFormData({...formData(), repair_type: e.target.value})} />
              </div>
              <div class="form-row">
                <label>问题描述</label>
                <textarea rows="3" value={formData().description} onInput={e => setFormData({...formData(), description: e.target.value})} />
              </div>
              <div class="form-row">
                <label>优先级</label>
                <select value={formData().priority} onInput={e => setFormData({...formData(), priority: e.target.value})}>
                  <option value="urgent">紧急</option>
                  <option value="high">高</option>
                  <option value="normal">普通</option>
                  <option value="low">低</option>
                </select>
              </div>
              <div class="form-row">
                <label>截止期限</label>
                <input type="datetime-local" value={formData().deadline || ''} onInput={e => setFormData({...formData(), deadline: e.target.value})} />
              </div>
              <div class="form-row">
                <label>补正意见</label>
                <textarea rows="2" value={correctionOpinion()} onInput={e => setCorrectionOpinion(e.target.value)} placeholder="说明补正内容..." />
              </div>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-primary" disabled={submitting()} onClick={saveCorrection}>保存补正</button>
                <button class="btn btn-ghost" onClick={() => { setEditing(false); setCorrectionOpinion(''); }}>取消</button>
              </div>
            </div>
          </Show>
        </div>

        <div class="card">
          <div class="card-title">办理操作</div>
          <div class="form">
            <div class="form-row">
              <label>可选动作（当前角色：{RoleNames[auth.role()] || auth.role()}）</label>
              <select value={action()} onInput={e => setAction(e.target.value)} disabled={submitting() || availableActions().length === 0}>
                <option value="">请选择...</option>
                <For each={availableActions()}>
                  {a => <option value={a}>{ActionNames[a] || a}</option>}
                </For>
              </select>
            </div>
            <div class="form-row">
              <label>办理意见</label>
              <textarea rows="3" value={actionOpinion()} onInput={e => setActionOpinion(e.target.value)} placeholder="请填写办理意见..." />
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <button class="btn btn-primary" disabled={submitting() || !action()} onClick={executeAction}>
                提交办理（基于版本 v{o.version}）
              </button>
              <span class="hint">
                已存证据附件：<strong>{evidenceCount()}</strong> 份
                <Show when={actionNeedsEvidence() && evidenceCount() === 0}>
                  <span style="color:#dc2626;"> （此动作必须上传证据，请至附件 Tab）</span>
                </Show>
              </span>
            </div>
            <div style="margin-top:12px;padding:10px;background:#f8fafc;border-radius:6px;font-size:12px;color:#475569;">
              <div>当前工单：{StatusNames[o.status]}，当前处理角色：{RoleNames[o.current_handler_role] || o.current_handler_role || '—'}</div>
              <div>您的角色：{RoleNames[auth.role()] || auth.role()}（{auth.user()?.name}）</div>
              <Show when={availableActions().length === 0 && !isArchived()}>
                <div style="color:#b45309;margin-top:4px;">⚠ 当前状态下您没有可执行的动作</div>
              </Show>
              <Show when={isArchived()}>
                <div style="color:#6b7280;margin-top:4px;">该工单已归档，所有动作已关闭</div>
              </Show>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="tabs">
          <button class={`tab ${activeTab() === 'records' ? 'active' : ''}`} onClick={() => setActiveTab('records')}>处理记录（{records().length}）</button>
          <button class={`tab ${activeTab() === 'attachments' ? 'active' : ''}`} onClick={() => setActiveTab('attachments')}>附件（{attachments().length}）</button>
          <button class={`tab ${activeTab() === 'exceptions' ? 'active' : ''}`} onClick={() => setActiveTab('exceptions')}>异常原因（{exceptions().length}）</button>
          <button class={`tab ${activeTab() === 'audits' ? 'active' : ''}`} onClick={() => setActiveTab('audits')}>审计备注（{audits().length}）</button>
        </div>

        <div class="tab-content">
          <Show when={activeTab() === 'records'}>
            <div class="timeline">
              <For each={records()}>
                {r => (
                  <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <div class="timeline-title">
                        <strong>{ActionNames[r.action] || r.action}</strong>
                        <span class="badge" style="margin-left:8px;">v{r.version}</span>
                        <Show when={r.evidence_provided > 0}>
                          <span class="badge" style="background:#0ea5e9;color:#fff;margin-left:4px;">证据{r.evidence_provided}份</span>
                        </Show>
                      </div>
                      <div class="timeline-meta">
                        {r.handler}（{RoleNames[r.handler_role] || r.handler_role}）· {r.created_at}
                        <Show when={r.from_status || r.to_status}>
                          · {StatusNames[r.from_status] || r.from_status || '—'} → {StatusNames[r.to_status] || r.to_status || '—'}
                        </Show>
                      </div>
                      <Show when={r.opinion}>
                        <div class="timeline-opinion">{r.opinion}</div>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
              <Show when={records().length === 0}>
                <div class="empty">暂无处理记录</div>
              </Show>
            </div>
          </Show>

          <Show when={activeTab() === 'attachments'}>
            <div style="margin-bottom:12px;">
              <input type="file" multiple onChange={onFileSelect} disabled={isArchived()} />
              <button class="btn btn-primary" style="margin-left:8px;" onClick={uploadFiles} disabled={uploading() || pendingFiles().length === 0}>
                {uploading() ? '上传中...' : `上传选中文件（${pendingFiles().length}）`}
              </button>
              <span class="hint" style="margin-left:8px;">
                完成维修、回访、复核归档必须绑定至少 1 份真实附件
              </span>
            </div>
            <table class="data-table">
              <thead>
                <tr><th>文件名</th><th>上传人</th><th>角色</th><th>上传时间</th></tr>
              </thead>
              <tbody>
                <For each={attachments()}>
                  {a => (
                    <tr>
                      <td>{a.file_name}</td>
                      <td>{a.uploaded_by}</td>
                      <td>{RoleNames[a.uploaded_by_role] || a.uploaded_by_role}</td>
                      <td>{a.uploaded_at}</td>
                    </tr>
                  )}
                </For>
                <Show when={attachments().length === 0}>
                  <tr><td colspan="4" class="empty-cell">暂无附件</td></tr>
                </Show>
              </tbody>
            </table>
          </Show>

          <Show when={activeTab() === 'exceptions'}>
            <table class="data-table">
              <thead>
                <tr><th>异常代码</th><th>异常说明</th><th>关联字段</th><th>检测人</th><th>状态</th><th>解决人/时间</th><th>创建时间</th></tr>
              </thead>
              <tbody>
                <For each={exceptions()}>
                  {e => (
                    <tr>
                      <td><code>{e.reason_code}</code></td>
                      <td>{e.reason_text}</td>
                      <td>{e.field_name || '—'}</td>
                      <td>{e.detected_by}（{RoleNames[e.detected_by_role] || e.detected_by_role}）</td>
                      <td>
                        <span class="badge" style={`background:${e.resolved ? '#10b981' : '#ef4444'};color:#fff;`}>
                          {e.resolved ? '已解决' : '未解决'}
                        </span>
                      </td>
                      <td>{e.resolved ? `${e.resolved_by} · ${e.resolved_at}` : '—'}</td>
                      <td>{e.created_at}</td>
                    </tr>
                  )}
                </For>
                <Show when={exceptions().length === 0}>
                  <tr><td colspan="7" class="empty-cell">暂无异常记录</td></tr>
                </Show>
              </tbody>
            </table>
          </Show>

          <Show when={activeTab() === 'audits'}>
            <div class="timeline">
              <For each={audits()}>
                {a => (
                  <div class="timeline-item">
                    <div class="timeline-dot" style={`background:${auditDotColor(a.note_type)};`}></div>
                    <div class="timeline-content">
                      <div class="timeline-title">
                        <span class="badge" style={`background:${auditDotColor(a.note_type)};color:#fff;`}>
                          {auditNoteTypeLabel(a.note_type)}
                        </span>
                        <span style="margin-left:8px;">{a.operator || '系统'}（{RoleNames[a.operator_role] || a.operator_role || '—'}）</span>
                      </div>
                      <div class="timeline-meta">{a.created_at}</div>
                      <div class="timeline-opinion">{a.content}</div>
                    </div>
                  </div>
                )}
              </For>
              <Show when={audits().length === 0}>
                <div class="empty">暂无审计记录</div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}

export default OrderDetail
