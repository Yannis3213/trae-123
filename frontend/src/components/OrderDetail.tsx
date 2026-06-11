import { createSignal, createEffect, Show, For } from 'solid-js'
import { getOrder, updateStatus, addAttachment, addAuditNote } from '../api'
import { isKefu, isShifu, isJingli } from '../store'
import type { OrderDetail as OrderDetailType } from '../types'
import AuditTrail from './AuditTrail'

const statusColorMap: Record<string, string> = {
  '待接单': 'badge-pending',
  '已接单': 'badge-accepted',
  '施工中': 'badge-in-progress',
  '待验收': 'badge-awaiting',
  '验收通过': 'badge-approved',
  '退回补正': 'badge-returned',
  '已归档': 'badge-archived'
}

const expiryLabels: Record<string, string> = {
  normal: '正常',
  approaching: '临期',
  overdue: '逾期'
}

function OrderDetail(props: { orderId: number }) {
  const [order, setOrder] = createSignal<OrderDetailType | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [remark, setRemark] = createSignal('')
  const [fileName, setFileName] = createSignal('')
  const [category, setCategory] = createSignal('施工证据')
  const [error, setError] = createSignal('')
  const [success, setSuccess] = createSignal('')

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const res = await getOrder(props.orderId)
      if (res.code === 0) {
        const d = res.data as any
        const flat: OrderDetailType = {
          ...d.order,
          attachments: d.attachments || [],
          process_records: d.process_records || [],
          audit_notes: d.audit_notes || [],
          exception_reasons: d.exception_reasons || [],
          expiry_status: d.expiry_status || 'normal'
        }
        setOrder(flat)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  createEffect(() => {
    fetchOrder()
  })

  const handleAction = async (targetStatus: string) => {
    setError('')
    setSuccess('')
    const o = order()
    if (!o) return

    const data: any = { status: targetStatus, version: o.version }

    if (remark()) {
      data.remark = remark()
    }

    const attachments: { file_name: string; category: string }[] = []
    if ((targetStatus === '待验收' || targetStatus === '验收通过') && fileName()) {
      attachments.push({ file_name: fileName(), category: category() })
    }
    if (attachments.length > 0) {
      data.attachments = attachments
    }

    try {
      const res = await updateStatus(o.id, data)
      if (res.code === 0) {
        setSuccess('操作成功')
        setRemark('')
        setFileName('')
        fetchOrder()
      } else {
        setError(res.message || '操作失败')
      }
    } catch (err: any) {
      setError(err.message || '操作失败')
    }
  }

  const handleAddAttachment = async () => {
    if (!fileName()) return
    setError('')
    const o = order()
    if (!o) return
    try {
      const res = await addAttachment(o.id, { file_name: fileName(), category: category() })
      if (res.code === 0) {
        setFileName('')
        fetchOrder()
      } else {
        setError(res.message || '添加附件失败')
      }
    } catch (err: any) {
      setError(err.message || '添加附件失败')
    }
  }

  const handleAddNote = async () => {
    if (!remark()) return
    setError('')
    const o = order()
    if (!o) return
    try {
      const res = await addAuditNote(o.id, remark())
      if (res.code === 0) {
        setRemark('')
        fetchOrder()
      } else {
        setError(res.message || '添加备注失败')
      }
    } catch (err: any) {
      setError(err.message || '添加备注失败')
    }
  }

  const formatDate = (d: string) => {
    if (!d) return '-'
    return new Date(d).toLocaleString('zh-CN')
  }

  const getAvailableActions = () => {
    const o = order()
    if (!o) return []
    const actions: { label: string; status: string; variant: string; requireAttachment?: boolean }[] = []

    if (isShifu()) {
      if (o.status === '待接单') actions.push({ label: '接单', status: '已接单', variant: 'btn-primary' })
      if (o.status === '已接单') actions.push({ label: '开始施工', status: '施工中', variant: 'btn-primary' })
      if (o.status === '施工中') actions.push({ label: '完工', status: '待验收', variant: 'btn-success', requireAttachment: true })
      if (o.status === '退回补正') actions.push({ label: '重新接单', status: '已接单', variant: 'btn-warning' })
    }

    if (isJingli()) {
      if (o.status === '待验收') {
        actions.push({ label: '验收通过', status: '验收通过', variant: 'btn-success', requireAttachment: true })
        actions.push({ label: '退回补正', status: '退回补正', variant: 'btn-danger' })
      }
      if (o.status === '验收通过') actions.push({ label: '归档', status: '已归档', variant: 'btn-primary' })
    }

    return actions
  }

  return (
    <Show when={!loading() && order()} fallback={<div class="loading">加载中...</div>}>
      {(o) => (
        <div>
          <div class="back-link" onClick={() => { window.location.hash = '#/' }}>
            ← 返回列表
          </div>

          <div class="card detail-section">
            <h3>基本信息</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">工单号：</span>
                <span class="detail-value">{o().order_no}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">标题：</span>
                <span class="detail-value">{o().title}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">状态：</span>
                <span class="detail-value">
                  <span class={`badge ${statusColorMap[o().status] || ''}`}>{o().status}</span>
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">优先级：</span>
                <span class="detail-value">{o().priority === 'urgent' ? <span class="badge badge-urgent">紧急</span> : '普通'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">截止日期：</span>
                <span class="detail-value">{formatDate(o().deadline)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">到期状态：</span>
                <span class="detail-value">
                  <span class={`badge badge-expiry-${o().expiry_status}`}>{expiryLabels[o().expiry_status] || o().expiry_status}</span>
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">异常类型：</span>
                <span class="detail-value">{o().exception_type || '-'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">创建时间：</span>
                <span class="detail-value">{formatDate(o().created_at)}</span>
              </div>
            </div>
            <Show when={o().description}>
              <div style={{ "margin-top": '12px' }}>
                <span class="detail-label">描述：</span>
                <span>{o().description}</span>
              </div>
            </Show>
          </div>

          <div class="card detail-section">
            <h3>状态流转</h3>
            <AuditTrail orderId={o().id} records={o().process_records} />
          </div>

          <div class="card detail-section">
            <h3>附件列表</h3>
            <Show when={o().attachments.length > 0} fallback={<p style={{ color: 'var(--text-secondary)' }}>暂无附件</p>}>
              <div class="attachment-list">
                <For each={o().attachments}>
                  {(att) => (
                    <div class="attachment-item">
                      <span>{att.file_name}</span>
                      <span class="badge badge-accepted">{att.category}</span>
                      <span style={{ color: 'var(--text-secondary)', "font-size": '12px' }}>{att.upload_role} · {formatDate(att.created_at)}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div class="card detail-section">
            <h3>审计备注</h3>
            <Show when={o().audit_notes.length > 0} fallback={<p style={{ color: 'var(--text-secondary)' }}>暂无备注</p>}>
              <For each={o().audit_notes}>
                {(note) => (
                  <div class="note-item">
                    <div class="note-meta">{note.author_role} · {formatDate(note.created_at)}</div>
                    <div>{note.note}</div>
                  </div>
                )}
              </For>
            </Show>
          </div>

          <Show when={o().exception_reasons.length > 0}>
            <div class="card detail-section">
              <h3>异常原因</h3>
              <For each={o().exception_reasons}>
                {(ex) => (
                  <div class="note-item">
                    <div class="note-meta">{ex.reason_type} · {formatDate(ex.created_at)}</div>
                    <div>{ex.description}</div>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={!isKefu()}>
            <div class="card detail-section">
              <h3>操作</h3>
              <div class="action-form">
                <div class="form-group">
                  <label>备注</label>
                  <textarea
                    value={remark()}
                    onInput={(e) => setRemark(e.currentTarget.value)}
                    placeholder="输入备注信息"
                  />
                </div>
                <div class="form-group">
                  <label>附件文件名</label>
                  <input
                    type="text"
                    value={fileName()}
                    onInput={(e) => setFileName(e.currentTarget.value)}
                    placeholder="输入附件文件名"
                  />
                </div>
                <div class="form-group">
                  <label>附件类别</label>
                  <select value={category()} onChange={(e) => setCategory(e.currentTarget.value)}>
                    <option value="施工证据">施工证据</option>
                    <option value="验收证据">验收证据</option>
                    <option value="登记证据">登记证据</option>
                    <option value="补正证据">补正证据</option>
                    <option value="其他">其他</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px', "flex-wrap": 'wrap' }}>
                  <For each={getAvailableActions()}>
                    {(act) => (
                      <button
                        class={`btn ${act.variant}`}
                        onClick={() => handleAction(act.status)}
                      >
                        {act.label}
                        <Show when={act.requireAttachment && !fileName()}>{' (需附件)'}</Show>
                      </button>
                    )}
                  </For>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button class="btn btn-ghost" onClick={handleAddNote} disabled={!remark()}>
                    添加备注
                  </button>
                  <button class="btn btn-ghost" onClick={handleAddAttachment} disabled={!fileName()}>
                    添加附件
                  </button>
                </div>
              </div>

              <Show when={error()}>
                <div class="error-message">{error()}</div>
              </Show>
              <Show when={success()}>
                <div class="success-message">{success()}</div>
              </Show>
            </div>
          </Show>
        </div>
      )}
    </Show>
  )
}

export default OrderDetail
