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
    evidenceInputs: { type: Object },
    submitting: { type: Boolean }
  }

  constructor() {
    super()
    this.loading = true
    this.detail = null
    this.submitting = false
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

  async updated(changedProps) {
    if (changedProps.has('orderId') && this.orderId) {
      this.loading = true
      await this.loadDetail()
    }
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

  canEditEvidence(stage) {
    if (!this.detail?.can_edit_evidence) return false
    if (!this.detail.allowed_actions?.includes('resubmit') && 
        !this.detail.allowed_actions?.includes('approve')) return false
    
    const status = this.detail.order.status
    const currentStage = this.detail.order.current_stage
    
    if (status === 'exception_return' && this.currentUser?.role === 'register') {
      return true
    }
    
    if (status === 'pending_sign' && stage === currentStage) {
      return true
    }
    
    return false
  }

  canSubmit() {
    if (!this.detail?.can_operate) return false
    if (!this.processForm.action) return false
    if (this.submitting) return false
    
    const action = this.processForm.action
    
    if (action === 'approve') {
      if (!this.processForm.opinion) return false
      const evidenceField = this.detail.required_evidence
      if (evidenceField && !this.evidenceInputs[evidenceField]) return false
      if (this.detail.order.overdue_info?.level === 'overdue' && !this.processForm.audit_remark) {
        return false
      }
    }
    
    if (action === 'resubmit') {
      const hasEvidence = Object.values(this.evidenceInputs).some(v => v && v.trim())
      if (!hasEvidence) return false
      if (this.detail.order.overdue_info?.level === 'overdue' && !this.processForm.audit_remark) {
        return false
      }
    }
    
    if ((action === 'return' || action === 'exception') && !this.processForm.exception_reason) {
      return false
    }
    
    return true
  }

  async handleSubmit() {
    if (!this.canSubmit()) return
    
    this.submitting = true
    const action = this.processForm.action
    
    try {
      if (action === 'resubmit') {
        const evidence = {}
        Object.entries(this.evidenceInputs).forEach(([key, value]) => {
          if (value && value.trim()) {
            evidence[key] = value.trim()
          }
        })
        
        const result = await api.resubmitOrder(this.orderId, {
          version: this.detail.order.version,
          evidence: evidence,
          opinion: this.processForm.opinion || '补正后重新提交',
          audit_remark: this.processForm.audit_remark || null
        })
        
        this.dispatchEvent(new CustomEvent('toast', {
          detail: { message: result.message || '补正提交成功', type: 'success' }
        }))
        this.dispatchEvent(new CustomEvent('updated'))
        this.dispatchEvent(new CustomEvent('close'))
      } else {
        const evidenceField = this.detail.required_evidence
        const evidence = {}
        if (evidenceField && this.evidenceInputs[evidenceField]) {
          evidence[evidenceField] = this.evidenceInputs[evidenceField]
        }
        
        const result = await api.batchProcess({
          order_ids: [this.orderId],
          action: action,
          opinion: this.processForm.opinion,
          audit_remark: this.processForm.audit_remark,
          exception_reason: this.processForm.exception_reason,
          version: this.detail.order.version,
          evidence: Object.keys(evidence).length > 0 ? evidence : null
        })
        
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
      }
    } catch (error) {
      this.dispatchEvent(new CustomEvent('toast', {
        detail: { message: error.message, type: 'error' }
      }))
    } finally {
      this.submitting = false
    }
  }

  getActionLabel(action) {
    const labels = {
      'approve': '审核通过',
      'return': '退回补正',
      'exception': '异常回传',
      'resubmit': '补正提交'
    }
    return labels[action] || action
  }

  getActionClass(action) {
    const classes = {
      'approve': 'btn-success',
      'return': 'btn-danger',
      'exception': 'btn-warning',
      'resubmit': 'btn-primary'
    }
    return classes[action] || 'btn-primary'
  }

  render() {
    if (this.loading || !this.detail) {
      return html`
        <div class="detail-modal" @click=${(e) => e.target === e.currentTarget && this.dispatchEvent(new CustomEvent('close'))}>
          <div class="detail-content">
            <div class="loading">加载中...</div>
          </div>
        </div>
      `
    }

    const { order, records, remarks, exceptions, can_operate, allowed_actions } = this.detail

    return html`
      <div class="detail-modal" @click=${(e) => e.target === e.currentTarget && this.dispatchEvent(new CustomEvent('close'))}>
        <div class="detail-content">
          <div class="detail-header">
            <div>
              <span class="status-tag status-${order.status}">
                ${order.status_label}
              </span>
              <span class="stage-tag">
                ${order.stage_label}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 16px;">
              <span style="font-size: 14px; color: #6b7280;">
                ${order.order_no}
              </span>
              <button class="close-btn" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>×</button>
            </div>
          </div>
          
          <div class="detail-body">
            <div class="detail-section">
              <h3>📋 基本信息</h3>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">会议标题：</span>
                  <span class="value">${order.title}</span>
                </div>
                <div class="info-item">
                  <span class="label">版本：</span>
                  <span class="value">v${order.version}</span>
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
                  <span class="label">当前角色：</span>
                  <span class="value" style="color: #667eea; font-weight: 600;">
                    ${order.role_label}
                  </span>
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
                  <span class="value ${order.overdue_info?.level === 'overdue' ? 'text-danger' : ''}">
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
                <div class="info-item full-width">
                  <span class="label">会议内容：</span>
                  <span class="value">${order.content || '-'}</span>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <h3>🔍 三阶段证据核对</h3>
              <div class="stage-evidence">
                ${Object.entries(this.stages).map(([stageKey, stageLabel]) => {
                  const status = this.getStageStatus(stageKey)
                  const field = this.getEvidenceField(stageKey)
                  const evidence = this.evidenceInputs[field] || order[field] || ''
                  const canEdit = this.canEditEvidence(stageKey)
                  const isRequired = stageKey === order.current_stage && can_operate
                  
                  return html`
                    <div class="stage-card ${status}">
                      <div class="stage-header">
                        <h4>
                          ${status === 'done' ? '✓ ' : ''}
                          ${status === 'current' ? '➤ ' : ''}
                          ${stageLabel}
                        </h4>
                        ${status === 'done' ? html`<span class="stage-badge done">已完成</span>` : ''}
                        ${status === 'current' ? html`<span class="stage-badge current">当前环节</span>` : ''}
                      </div>
                      ${canEdit ? html`
                        <textarea
                          class="evidence-input"
                          rows="3"
                          placeholder="请输入证据材料说明..."
                          .value=${this.evidenceInputs[field] || ''}
                          @input=${(e) => { 
                            this.evidenceInputs = { ...this.evidenceInputs, [field]: e.target.value }
                            this.requestUpdate()
                          }}
                          ?disabled=${this.submitting}
                        ></textarea>
                        <div class="evidence-status ${evidence ? 'provided' : 'missing'}">
                          ${evidence ? '✓ 证据已提供' : '✗ 缺少证据'}
                          ${isRequired ? ' <span class="required-mark">*必填</span>' : ''}
                        </div>
                      ` : html`
                        <div class="evidence-display">
                          ${evidence || '暂未提供证据'}
                        </div>
                        <div class="evidence-status ${evidence ? 'provided' : 'missing'}">
                          ${evidence ? '✓ 已提供' : '✗ 未提供'}
                        </div>
                      `}
                    </div>
                  `
                })}
              </div>
            </div>

            ${exceptions && exceptions.length > 0 ? html`
              <div class="detail-section">
                <h3>⚠️ 异常记录</h3>
                ${exceptions.map(e => html`
                  <div class="exception-card">
                    <div class="exception-header">
                      <span class="exception-stage">【${e.stage_label}】</span>
                      <span class="exception-time">${e.created_at}</span>
                    </div>
                    <div class="exception-reason">${e.reason}</div>
                    <div class="exception-meta">
                      上报人：${e.reporter_name || e.reported_by}
                    </div>
                  </div>
                `)}
              </div>
            ` : ''}

            ${remarks && remarks.length > 0 ? html`
              <div class="detail-section">
                <h3>📝 审计备注</h3>
                ${remarks.map(r => html`
                  <div class="remark-card">
                    <div class="remark-content">${r.remark}</div>
                    <div class="remark-meta">
                      ${r.creator_name || r.created_by} · ${r.created_at}
                    </div>
                  </div>
                `)}
              </div>
            ` : ''}

            ${can_operate && order.status !== 'sign_complete' ? html`
              <div class="detail-section">
                <h3>⚙️ 办理操作</h3>
                <div class="process-form">
                  <div class="form-group">
                    <label>操作类型 <span class="required">*</span></label>
                    <select
                      .value=${this.processForm.action}
                      @change=${(e) => { 
                        this.processForm = { ...this.processForm, action: e.target.value }
                        this.requestUpdate()
                      }}
                      ?disabled=${this.submitting}
                      class="form-select"
                    >
                      ${allowed_actions.map(action => html`
                        <option value=${action}>${this.getActionLabel(action)}</option>
                      `)}
                    </select>
                  </div>

                  ${(this.processForm.action === 'approve' || this.processForm.action === 'resubmit') ? html`
                    <div class="form-group">
                      <label>处理意见 ${this.processForm.action === 'approve' ? html`<span class="required">*</span>` : ''}</label>
                      <textarea
                        rows="2"
                        placeholder="请输入处理意见..."
                        .value=${this.processForm.opinion}
                        @input=${(e) => { 
                          this.processForm = { ...this.processForm, opinion: e.target.value }
                          this.requestUpdate()
                        }}
                        ?disabled=${this.submitting}
                      ></textarea>
                    </div>
                  ` : ''}

                  ${(this.processForm.action === 'return' || this.processForm.action === 'exception') ? html`
                    <div class="form-group">
                      <label>异常原因 <span class="required">*</span></label>
                      <textarea
                        rows="3"
                        placeholder="请详细说明异常原因..."
                        .value=${this.processForm.exception_reason}
                        @input=${(e) => { 
                          this.processForm = { ...this.processForm, exception_reason: e.target.value }
                          this.requestUpdate()
                        }}
                        ?disabled=${this.submitting}
                      ></textarea>
                    </div>
                  ` : ''}

                  ${(this.processForm.action === 'approve' || this.processForm.action === 'resubmit') && 
                    order.overdue_info?.level === 'overdue' ? html`
                    <div class="form-group">
                      <label>审计备注 <span class="required">*</span></label>
                      <textarea
                        rows="2"
                        placeholder="该单据已逾期，请填写审计备注..."
                        .value=${this.processForm.audit_remark}
                        @input=${(e) => { 
                          this.processForm = { ...this.processForm, audit_remark: e.target.value }
                          this.requestUpdate()
                        }}
                        ?disabled=${this.submitting}
                      ></textarea>
                      <div class="warning-text">⚠️ 该单据已逾期，需特别说明</div>
                    </div>
                  ` : ''}

                  <div class="form-actions">
                    <button 
                      class="btn btn-secondary" 
                      @click=${() => this.dispatchEvent(new CustomEvent('close'))}
                      ?disabled=${this.submitting}
                    >
                      取消
                    </button>
                    <button
                      class="btn ${this.getActionClass(this.processForm.action)}"
                      ?disabled=${!this.canSubmit()}
                      @click=${this.handleSubmit}
                    >
                      ${this.submitting ? '处理中...' : this.getActionLabel(this.processForm.action)}
                    </button>
                  </div>
                </div>
              </div>
            ` : ''}

            <div class="detail-section">
              <h3>📜 处理记录（操作轨迹可反推责任）</h3>
              <div class="timeline">
                ${records.map(record => html`
                  <div class="timeline-item ${record.is_exception ? 'exception' : ''}">
                    <div class="timeline-header">
                      <span class="timeline-action">
                        ${record.action_label || record.action}
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

  static styles = css`
    .detail-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .detail-content {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 900px;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    }

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #e5e7eb;
      position: sticky;
      top: 0;
      background: white;
      z-index: 10;
    }

    .detail-header h2 {
      font-size: 16px;
      margin: 0;
    }

    .status-tag {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      margin-right: 8px;
    }

    .status-pending_sign {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .status-exception_return {
      background: #fee2e2;
      color: #dc2626;
    }

    .status-sign_complete {
      background: #dcfce7;
      color: #16a34a;
    }

    .stage-tag {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      background: #ede9fe;
      color: #6d28d9;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
      line-height: 1;
      padding: 0;
    }

    .close-btn:hover {
      color: #333;
    }

    .detail-body {
      padding: 20px 24px;
    }

    .detail-section {
      margin-bottom: 20px;
    }

    .detail-section h3 {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px 20px;
    }

    .info-item {
      display: flex;
      font-size: 13px;
    }

    .info-item.full-width {
      grid-column: span 2;
    }

    .info-item .label {
      color: #6b7280;
      min-width: 90px;
      flex-shrink: 0;
    }

    .info-item .value {
      color: #111827;
      font-weight: 500;
      flex: 1;
    }

    .text-danger {
      color: #dc2626 !important;
      font-weight: 600 !important;
    }

    .overdue-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
      margin-left: 4px;
    }

    .overdue-normal {
      background: #dcfce7;
      color: #16a34a;
    }

    .overdue-urgent {
      background: #fef3c7;
      color: #d97706;
    }

    .overdue-overdue {
      background: #fee2e2;
      color: #dc2626;
    }

    .stage-evidence {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .stage-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px;
      transition: all 0.2s;
    }

    .stage-card.current {
      border-color: #667eea;
      background: #f5f3ff;
    }

    .stage-card.done {
      border-color: #10b981;
      background: #f0fdf4;
    }

    .stage-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .stage-card h4 {
      font-size: 13px;
      margin: 0;
      color: #374151;
    }

    .stage-badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
    }

    .stage-badge.current {
      background: #ddd6fe;
      color: #5b21b6;
    }

    .stage-badge.done {
      background: #a7f3d0;
      color: #065f46;
    }

    .evidence-input {
      width: 100%;
      padding: 8px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 12px;
      font-family: inherit;
      resize: vertical;
      box-sizing: border-box;
    }

    .evidence-input:focus {
      outline: none;
      border-color: #667eea;
    }

    .evidence-display {
      font-size: 12px;
      color: #4b5563;
      padding: 8px;
      background: #f9fafb;
      border-radius: 4px;
      min-height: 40px;
    }

    .evidence-status {
      font-size: 11px;
      margin-top: 8px;
    }

    .evidence-status.missing {
      color: #dc2626;
    }

    .evidence-status.provided {
      color: #16a34a;
    }

    .required-mark {
      color: #dc2626;
      font-weight: 600;
    }

    .exception-card {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
    }

    .exception-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .exception-stage {
      font-weight: 600;
      color: #dc2626;
      font-size: 13px;
    }

    .exception-time {
      font-size: 11px;
      color: #9ca3af;
    }

    .exception-reason {
      font-size: 13px;
      color: #1f2937;
      margin-bottom: 6px;
    }

    .exception-meta {
      font-size: 11px;
      color: #6b7280;
    }

    .remark-card {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
    }

    .remark-content {
      font-size: 13px;
      color: #1f2937;
      margin-bottom: 4px;
    }

    .remark-meta {
      font-size: 11px;
      color: #92400e;
    }

    .process-form {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
    }

    .form-group {
      margin-bottom: 14px;
    }

    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 6px;
    }

    .form-group label .required {
      color: #dc2626;
    }

    .form-group textarea,
    .form-group input,
    .form-select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
      font-family: inherit;
      resize: vertical;
      box-sizing: border-box;
    }

    .form-group textarea:focus,
    .form-group input:focus,
    .form-select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .warning-text {
      color: #d97706;
      font-size: 12px;
      margin-top: 4px;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 16px;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .btn-success {
      background: #10b981;
      color: white;
    }

    .btn-success:hover:not(:disabled) {
      background: #059669;
    }

    .btn-danger {
      background: #ef4444;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #dc2626;
    }

    .btn-warning {
      background: #f59e0b;
      color: white;
    }

    .btn-warning:hover:not(:disabled) {
      background: #d97706;
    }

    .btn-secondary {
      background: #6b7280;
      color: white;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #4b5563;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .timeline {
      position: relative;
      padding-left: 24px;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 8px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #e5e7eb;
    }

    .timeline-item {
      position: relative;
      padding-bottom: 16px;
    }

    .timeline-item::before {
      content: '';
      position: absolute;
      left: -20px;
      top: 4px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #667eea;
      border: 2px solid white;
      box-shadow: 0 0 0 2px #667eea;
    }

    .timeline-item.exception::before {
      background: #ef4444;
      box-shadow: 0 0 0 2px #ef4444;
    }

    .timeline-item .timeline-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .timeline-item .timeline-action {
      font-weight: 600;
      color: #111827;
      font-size: 13px;
    }

    .timeline-item .timeline-time {
      color: #9ca3af;
      font-size: 11px;
    }

    .timeline-item .timeline-content {
      background: #f9fafb;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 12px;
      color: #4b5563;
    }

    .timeline-item .timeline-meta {
      font-size: 11px;
      color: #6b7280;
      margin-top: 4px;
    }

    .timeline-item .exception-badge {
      display: inline-block;
      background: #fee2e2;
      color: #dc2626;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      margin-left: 6px;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #6b7280;
    }
  `
}

customElements.define('order-detail', OrderDetail)
