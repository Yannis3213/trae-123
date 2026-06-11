import { LitElement, html, css } from 'lit'
import { api } from '../api.js'

class OrderDetail extends LitElement {
  static properties = {
    orderId: { type: Number },
    currentUser: { type: Object },
    statuses: { type: Object },
    stages: { type: Object },
    roles: { type: Object },
    loading: { type: Boolean },
    detail: { type: Object },
    processForm: { type: Object },
    evidenceInputs: { type: Object }
  }

  constructor() {
    super()
    this.loading = true
    this.detail = null
    this.processForm = {
      action: 'approve',
      opinion: '',
      audit_remark: '',
      exception_reason: ''
    }
    this.evidenceInputs = {}
  }

  async firstUpdated() {
    await this.loadDetail()
  }

  async loadDetail() {
    this.loading = true
    try {
      this.detail = await api.getOrderDetail(this.orderId)
      
      if (this.detail.order) {
        this.evidenceInputs = {
          room_booking_evidence: this.detail.order.room_booking_evidence || '',
          equipment_evidence: this.detail.order.equipment_evidence || '',
          usage_evidence: this.detail.order.usage_evidence || ''
        }
      }
    } catch (error) {
      this.dispatchEvent(new CustomEvent('toast', {
        detail: { message: error.message, type: 'error' }
      }))
    } finally {
      this.loading = false
    }
  }

  getStageStatus(stage) {
    if (!this.detail?.order) return ''
    const stages = ['room_booking', 'equipment_prep', 'usage_confirm']
    const currentIdx = stages.indexOf(this.detail.order.current_stage)
    const stageIdx = stages.indexOf(stage)
    
    if (stageIdx < currentIdx) return 'done'
    if (stageIdx === currentIdx) return 'current'
    return ''
  }

  getEvidenceField(stage) {
    const map = {
      'room_booking': 'room_booking_evidence',
      'equipment_prep': 'equipment_evidence',
      'usage_confirm': 'usage_evidence'
    }
    return map[stage] || ''
  }

  canSubmit() {
    if (!this.detail?.can_operate) return false
    if (!this.processForm.action) return false
    
    if (this.processForm.action === 'approve') {
      if (!this.processForm.opinion) return false
      const evidenceField = this.detail.required_evidence
      if (evidenceField && !this.evidenceInputs[evidenceField]) return false
      if (this.detail.order.overdue_info?.level === 'overdue' && !this.processForm.audit_remark) {
        return false
      }
    }
    
    if (this.processForm.action === 'return' || this.processForm.action === 'exception') {
      if (!this.processForm.exception_reason) return false
    }
    
    return true
  }

  async handleSubmit() {
    if (!this.canSubmit()) return
    
    const evidenceField = this.detail.required_evidence
    const evidence = {}
    if (evidenceField && this.evidenceInputs[evidenceField]) {
      evidence[evidenceField] = this.evidenceInputs[evidenceField]
    }
    
    const processData = {
      order_ids: [this.orderId],
      action: this.processForm.action,
      opinion: this.processForm.opinion,
      audit_remark: this.processForm.audit_remark,
      exception_reason: this.processForm.exception_reason,
      version: this.detail.order.version,
      evidence: Object.keys(evidence).length > 0 ? evidence : null
    }
    
    try {
      const result = await api.batchProcess(processData)
      
      if (result.success_count > 0) {
        this.dispatchEvent(new CustomEvent('toast', {
          detail: { message: '处理成功', type: 'success' }
        }))
        this.dispatchEvent(new CustomEvent('updated'))
        this.dispatchEvent(new CustomEvent('close'))
      } else {
        const error = result.results.find(r => !r.success)
        this.dispatchEvent(new CustomEvent('toast', {
          detail: { message: error?.error || '处理失败', type: 'error' }
        }))
      }
    } catch (error) {
      this.dispatchEvent(new CustomEvent('toast', {
        detail: { message: error.message, type: 'error' }
      }))
    }
  }

  getActionLabel(action) {
    const labels = {
      'approve': '审核通过',
      'return': '退回补正',
      'exception': '异常回传'
    }
    return labels[action] || action
  }

  render() {
    if (this.loading) {
      return html`
        <div class="detail-modal" @click=${(e) => e.target === e.currentTarget && this.dispatchEvent(new CustomEvent('close'))}>
          <div class="detail-content">
            <div class="loading">加载中...</div>
          </div>
        </div>
      `
    }

    if (!this.detail) {
      return html`
        <div class="detail-modal" @click=${(e) => e.target === e.currentTarget && this.dispatchEvent(new CustomEvent('close'))}>
          <div class="detail-content">
            <div class="loading">加载失败</div>
          </div>
        </div>
      `
    }

    const { order, records, remarks, exceptions, can_operate, required_evidence } = this.detail

    return html`
      <div class="detail-modal" @click=${(e) => e.target === e.currentTarget && this.dispatchEvent(new CustomEvent('close'))}>
        <div class="detail-content">
          <div class="detail-header">
            <h2>
              ${order.order_no} - ${order.title}
              <span class="status-tag status-${order.status}" style="margin-left: 12px;">
                ${order.status_label}
              </span>
            </h2>
            <button class="close-btn" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>×</button>
          </div>
          
          <div class="detail-body">
            <div class="detail-section">
              <h3>基本信息</h3>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">单据号：</span>
                  <span class="value">${order.order_no}</span>
                </div>
                <div class="info-item">
                  <span class="label">版本：</span>
                  <span class="value">v${order.version}</span>
                </div>
                <div class="info-item">
                  <span class="label">会议标题：</span>
                  <span class="value">${order.title}</span>
                </div>
                <div class="info-item">
                  <span class="label">会议日期：</span>
                  <span class="value">${order.meeting_date}</span>
                </div>
                <div class="info-item">
                  <span class="label">会议时间：</span>
                  <span class="value">${order.start_time} - ${order.end_time}</span>
                </div>
                <div class="info-item">
                  <span class="label">会议室：</span>
                  <span class="value">${order.room_name || '-'}</span>
                </div>
                <div class="info-item">
                  <span class="label">参会人数：</span>
                  <span class="value">${order.attendees || '-'}</span>
                </div>
                <div class="info-item">
                  <span class="label">当前环节：</span>
                  <span class="value" style="color: #667eea; font-weight: 600;">
                    ${order.stage_label}
                  </span>
                </div>
                <div class="info-item">
                  <span class="label">当前角色：</span>
                  <span class="value">${order.role_label}</span>
                </div>
                <div class="info-item">
                  <span class="label">处理人：</span>
                  <span class="value">${order.handler_name || '-'}</span>
                </div>
                <div class="info-item">
                  <span class="label">创建人：</span>
                  <span class="value">${order.created_by_name || order.created_by}</span>
                </div>
                <div class="info-item">
                  <span class="label">创建时间：</span>
                  <span class="value">${order.created_at}</span>
                </div>
                <div class="info-item">
                  <span class="label">截止时间：</span>
                  <span class="value ${order.overdue_info?.level === 'overdue' ? 'overdue-overdue' : ''}">
                    ${order.deadline}
                    ${order.overdue_info ? html`
                      <span class="overdue-tag overdue-${order.overdue_info.level}">
                        ${order.overdue_info.label}
                      </span>
                    ` : ''}
                  </span>
                </div>
                <div class="info-item">
                  <span class="label">更新时间：</span>
                  <span class="value">${order.updated_at}</span>
                </div>
                <div class="info-item" style="grid-column: span 2;">
                  <span class="label">会议内容：</span>
                  <span class="value">${order.content || '-'}</span>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <h3>三阶段证据核对</h3>
              <div class="stage-evidence">
                ${Object.entries(this.stages).map(([stageKey, stageLabel]) => {
                  const status = this.getStageStatus(stageKey)
                  const field = this.getEvidenceField(stageKey)
                  const evidence = this.evidenceInputs[field] || order[field]
                  const isRequired = can_operate && required_evidence === field
                  
                  return html`
                    <div class="stage-card ${status}">
                      <h4>
                        ${status === 'done' ? '✓ ' : ''}
                        ${status === 'current' ? '➤ ' : ''}
                        ${stageLabel}
                      </h4>
                      ${can_operate && isRequired ? html`
                        <input
                          type="text"
                          class="evidence-input"
                          placeholder="请输入证据材料（如：会议室预约确认单编号）"
                          .value=${this.evidenceInputs[field] || ''}
                          @input=${(e) => { this.evidenceInputs = { ...this.evidenceInputs, [field]: e.target.value } }}
                        />
                        <div class="evidence-status ${evidence ? 'provided' : 'missing'}">
                          ${evidence ? '✓ 证据已提供' : '✗ 缺少证据'}
                        </div>
                      ` : html`
                        <div class="evidence-status ${evidence ? 'provided' : 'missing'}">
                          ${evidence || '暂未提供'}
                        </div>
                      `}
                    </div>
                  `
                })}
              </div>
            </div>

            ${exceptions && exceptions.length > 0 ? html`
              <div class="detail-section">
                <h3>异常记录</h3>
                ${exceptions.map(e => html`
                  <div style="background: #fef2f2; padding: 12px; border-radius: 6px; margin-bottom: 8px;">
                    <div style="font-weight: 500; color: #dc2626; margin-bottom: 4px;">
                      【${e.stage_label}】${e.reason}
                    </div>
                    <div style="font-size: 12px; color: #6b7280;">
                      ${e.reporter_name || e.reported_by} · ${e.created_at}
                    </div>
                  </div>
                `)}
              </div>
            ` : ''}

            ${remarks && remarks.length > 0 ? html`
              <div class="detail-section">
                <h3>审计备注</h3>
                ${remarks.map(r => html`
                  <div style="background: #fffbeb; padding: 12px; border-radius: 6px; margin-bottom: 8px;">
                    <div style="margin-bottom: 4px;">${r.remark}</div>
                    <div style="font-size: 12px; color: #6b7280;">
                      ${r.creator_name || r.created_by} · ${r.created_at}
                    </div>
                  </div>
                `)}
              </div>
            ` : ''}

            ${can_operate && order.status !== 'sign_complete' ? html`
              <div class="detail-section">
                <h3>办理操作</h3>
                <div class="process-form">
                  <div class="form-group">
                    <label>操作类型<span class="required">*</span></label>
                    <select
                      .value=${this.processForm.action}
                      @change=${(e) => { this.processForm = { ...this.processForm, action: e.target.value } }}
                      style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;"
                    >
                      <option value="approve">审核通过 → 进入下一环节</option>
                      ${order.status === 'pending_sign' ? html`
                        <option value="exception">异常回传 → 退回补正</option>
                      ` : ''}
                      ${order.status === 'exception_return' ? html`
                        <option value="return">退回补正 → 返回登记员</option>
                      ` : ''}
                    </select>
                  </div>

                  ${this.processForm.action === 'approve' ? html`
                    <div class="form-group">
                      <label>处理意见<span class="required">*</span></label>
                      <textarea
                        rows="3"
                        placeholder="请输入处理意见..."
                        .value=${this.processForm.opinion}
                        @input=${(e) => { this.processForm = { ...this.processForm, opinion: e.target.value } }}
                      ></textarea>
                    </div>
                    ${order.overdue_info?.level === 'overdue' ? html`
                      <div class="form-group">
                        <label>审计备注<span class="required">*</span></label>
                        <textarea
                          rows="2"
                          placeholder="该单据已逾期，必须填写审计备注..."
                          .value=${this.processForm.audit_remark}
                          @input=${(e) => { this.processForm = { ...this.processForm, audit_remark: e.target.value } }}
                        ></textarea>
                        <div class="warning-text">⚠️ 该单据已逾期，需审计经理特别说明</div>
                      </div>
                    ` : ''}
                  ` : ''}

                  ${(this.processForm.action === 'return' || this.processForm.action === 'exception') ? html`
                    <div class="form-group">
                      <label>异常原因<span class="required">*</span></label>
                      <textarea
                        rows="3"
                        placeholder="请详细说明异常原因..."
                        .value=${this.processForm.exception_reason}
                        @input=${(e) => { this.processForm = { ...this.processForm, exception_reason: e.target.value } }}
                      ></textarea>
                    </div>
                  ` : ''}

                  <div class="form-actions">
                    <button class="btn btn-secondary" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>
                      取消
                    </button>
                    <button
                      class="btn ${this.processForm.action === 'approve' ? 'btn-success' : 'btn-danger'}"
                      ?disabled=${!this.canSubmit()}
                      @click=${this.handleSubmit}
                    >
                      ${this.getActionLabel(this.processForm.action)}
                    </button>
                  </div>
                </div>
              </div>
            ` : ''}

            <div class="detail-section">
              <h3>处理记录（操作轨迹可反推责任）</h3>
              <div class="timeline">
                ${records.map(record => html`
                  <div class="timeline-item ${record.is_exception ? 'exception' : ''}">
                    <div class="timeline-header">
                      <span class="timeline-action">
                        ${this._formatAction(record.action)}
                        ${record.is_exception ? html`<span class="exception-badge">异常</span>` : ''}
                      </span>
                      <span class="timeline-time">${record.created_at}</span>
                    </div>
                    <div class="timeline-content">
                      ${record.opinion || record.exception_reason || '无详细说明'}
                    </div>
                    <div class="timeline-meta">
                      处理人：${record.handler_name || record.handler}（${record.role_label || record.handler_role}）
                      ${record.from_status ? ` · 状态：${this.statuses[record.from_status]} → ${this.statuses[record.to_status]}` : ''}
                      ${record.from_stage ? ` · 环节：${this.stages[record.from_stage]} → ${this.stages[record.to_stage]}` : ''}
                      · 版本：v${record.order_version}
                    </div>
                  </div>
                `)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  _formatAction(action) {
    const map = {
      'create': '创建单据',
      'approve': '审核通过',
      'return': '退回补正',
      'exception': '异常回传'
    }
    return map[action] || action
  }

  static styles = css`
    :host {
      display: block;
    }
    .overdue-overdue {
      color: #dc2626 !important;
      font-weight: 600;
    }
  `
}

customElements.define('order-detail', OrderDetail)
