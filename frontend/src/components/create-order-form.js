import { LitElement, html, css } from 'lit'
import { api } from '../api.js'

class CreateOrderForm extends LitElement {
  static properties = {
    visible: { type: Boolean },
    stages: { type: Object },
    evidenceLabels: { type: Object },
    loading: { type: Boolean },
    formData: { type: Object }
  }

  constructor() {
    super()
    this.visible = false
    this.stages = {}
    this.evidenceLabels = {}
    this.loading = false
    this._resetForm()
  }

  _resetForm() {
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const deadline = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    
    const formatDate = (d) => d.toISOString().split('T')[0]
    const formatTime = (d) => d.toTimeString().slice(0, 5)
    const formatDateTime = (d) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}:00`
    }

    this.formData = {
      title: '',
      meeting_date: formatDate(tomorrow),
      start_time: '09:00',
      end_time: '10:00',
      room_name: '',
      attendees: 10,
      content: '',
      deadline: formatDateTime(deadline),
      evidence: {
        room_booking_evidence: '',
        equipment_evidence: '',
        usage_evidence: ''
      }
    }
  }

  _handleInput(e) {
    const field = e.target.dataset.field
    const value = e.target.value
    this.formData = { ...this.formData, [field]: value }
  }

  _handleEvidenceInput(e) {
    const field = e.target.dataset.field
    const value = e.target.value
    this.formData = {
      ...this.formData,
      evidence: {
        ...this.formData.evidence,
        [field]: value
      }
    }
  }

  get isValid() {
    if (!this.formData.title) return false
    if (!this.formData.meeting_date) return false
    if (!this.formData.start_time) return false
    if (!this.formData.end_time) return false
    if (!this.formData.deadline) return false
    return true
  }

  async _handleSubmit() {
    if (!this.isValid || this.loading) return

    this.loading = true
    try {
      const evidence = {}
      if (this.formData.evidence.room_booking_evidence) {
        evidence.room_booking_evidence = this.formData.evidence.room_booking_evidence
      }
      
      const result = await api.createOrder({
        title: this.formData.title,
        meeting_date: this.formData.meeting_date,
        start_time: this.formData.start_time,
        end_time: this.formData.end_time,
        room_name: this.formData.room_name || null,
        attendees: this.formData.attendees || null,
        content: this.formData.content || null,
        deadline: this.formData.deadline,
        evidence: Object.keys(evidence).length > 0 ? evidence : null
      })

      this.dispatchEvent(new CustomEvent('success', {
        detail: result
      }))
      
      this._resetForm()
      this.dispatchEvent(new CustomEvent('close'))
    } catch (error) {
      this.dispatchEvent(new CustomEvent('error', {
        detail: { message: error.message, code: error.code }
      }))
    } finally {
      this.loading = false
    }
  }

  _handleClose() {
    if (this.loading) return
    this._resetForm()
    this.dispatchEvent(new CustomEvent('close'))
  }

  render() {
    if (!this.visible) return ''

    return html`
      <div class="modal-overlay" @click=${(e) => e.target === e.currentTarget && this._handleClose()}>
        <div class="modal-content">
          <div class="modal-header">
            <h2>📋 新建会议预约单</h2>
            <button class="close-btn" @click=${this._handleClose} ?disabled=${this.loading}>×</button>
          </div>

          <div class="modal-body">
            <div class="form-section">
              <h3>基本信息</h3>
              
              <div class="form-grid">
                <div class="form-group full-width">
                  <label>会议标题 <span class="required">*</span></label>
                  <input
                    type="text"
                    placeholder="请输入会议标题"
                    .value=${this.formData.title}
                    data-field="title"
                    @input=${this._handleInput}
                    ?disabled=${this.loading}
                  />
                </div>

                <div class="form-group">
                  <label>会议日期 <span class="required">*</span></label>
                  <input
                    type="date"
                    .value=${this.formData.meeting_date}
                    data-field="meeting_date"
                    @input=${this._handleInput}
                    ?disabled=${this.loading}
                  />
                </div>

                <div class="form-group">
                  <label>会议室</label>
                  <input
                    type="text"
                    placeholder="请输入会议室名称"
                    .value=${this.formData.room_name}
                    data-field="room_name"
                    @input=${this._handleInput}
                    ?disabled=${this.loading}
                  />
                </div>

                <div class="form-group">
                  <label>开始时间 <span class="required">*</span></label>
                  <input
                    type="time"
                    .value=${this.formData.start_time}
                    data-field="start_time"
                    @input=${this._handleInput}
                    ?disabled=${this.loading}
                  />
                </div>

                <div class="form-group">
                  <label>结束时间 <span class="required">*</span></label>
                  <input
                    type="time"
                    .value=${this.formData.end_time}
                    data-field="end_time"
                    @input=${this._handleInput}
                    ?disabled=${this.loading}
                  />
                </div>

                <div class="form-group">
                  <label>参会人数</label>
                  <input
                    type="number"
                    placeholder="请输入参会人数"
                    .value=${this.formData.attendees}
                    data-field="attendees"
                    @input=${this._handleInput}
                    min="1"
                    ?disabled=${this.loading}
                  />
                </div>

                <div class="form-group full-width">
                  <label>截止时间 <span class="required">*</span></label>
                  <input
                    type="datetime-local"
                    .value=${this.formData.deadline.replace(' ', 'T').slice(0, 16)}
                    @input=${(e) => {
                      const val = e.target.value.replace('T', ' ') + ':00'
                      this.formData = { ...this.formData, deadline: val }
                    }}
                    ?disabled=${this.loading}
                  />
                  <div class="help-text">月底集中处理的截止时间，逾期需审计备注</div>
                </div>

                <div class="form-group full-width">
                  <label>会议内容</label>
                  <textarea
                    rows="3"
                    placeholder="请输入会议内容描述..."
                    .value=${this.formData.content}
                    data-field="content"
                    @input=${this._handleInput}
                    ?disabled=${this.loading}
                  ></textarea>
                </div>
              </div>
            </div>

            <div class="form-section">
              <h3>证据材料（可选）</h3>
              <p class="section-desc">可在创建时预先填写，也可由审核环节补充</p>
              
              <div class="evidence-grid">
                <div class="evidence-card">
                  <h4>🏢 会议室预约</h4>
                  <textarea
                    rows="2"
                    placeholder="会议室预约确认单编号..."
                    .value=${this.formData.evidence.room_booking_evidence}
                    data-field="room_booking_evidence"
                    @input=${this._handleEvidenceInput}
                    ?disabled=${this.loading}
                  ></textarea>
                </div>

                <div class="evidence-card">
                  <h4>🎯 设备准备</h4>
                  <textarea
                    rows="2"
                    placeholder="设备清单及准备情况..."
                    .value=${this.formData.evidence.equipment_evidence}
                    data-field="equipment_evidence"
                    @input=${this._handleEvidenceInput}
                    ?disabled=${this.loading}
                  ></textarea>
                </div>

                <div class="evidence-card">
                  <h4>✅ 使用确认</h4>
                  <textarea
                    rows="2"
                    placeholder="使用确认凭证..."
                    .value=${this.formData.evidence.usage_evidence}
                    data-field="usage_evidence"
                    @input=${this._handleEvidenceInput}
                    ?disabled=${this.loading}
                  ></textarea>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" @click=${this._handleClose} ?disabled=${this.loading}>
              取消
            </button>
            <button
              class="btn btn-primary"
              @click=${this._handleSubmit}
              ?disabled=${!this.isValid || this.loading}
            >
              ${this.loading ? '提交中...' : '创建预约单'}
            </button>
          </div>
        </div>
      </div>
    `
  }

  static styles = css`
    .modal-overlay {
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

    .modal-content {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 700px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }

    .modal-header h2 {
      font-size: 18px;
      color: #111;
      margin: 0;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
      line-height: 1;
      padding: 0;
      width: 32px;
      height: 32px;
    }

    .close-btn:hover:not(:disabled) {
      color: #333;
    }

    .close-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .modal-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }

    .form-section {
      margin-bottom: 24px;
    }

    .form-section:last-child {
      margin-bottom: 0;
    }

    .form-section h3 {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }

    .section-desc {
      font-size: 12px;
      color: #6b7280;
      margin-top: -8px;
      margin-bottom: 12px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
    }

    .form-group.full-width {
      grid-column: span 2;
    }

    .form-group label {
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 6px;
    }

    .form-group label .required {
      color: #dc2626;
    }

    .form-group input,
    .form-group textarea {
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .form-group input:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-group input:disabled,
    .form-group textarea:disabled {
      background: #f3f4f6;
      cursor: not-allowed;
    }

    .help-text {
      font-size: 11px;
      color: #6b7280;
      margin-top: 4px;
    }

    .evidence-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .evidence-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
    }

    .evidence-card h4 {
      font-size: 13px;
      margin: 0 0 8px 0;
      color: #374151;
    }

    .evidence-card textarea {
      width: 100%;
      padding: 8px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 12px;
      font-family: inherit;
      resize: vertical;
      box-sizing: border-box;
    }

    .evidence-card textarea:focus {
      outline: none;
      border-color: #667eea;
    }

    .evidence-card textarea:disabled {
      background: #f3f4f6;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e5e7eb;
      flex-shrink: 0;
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
  `
}

customElements.define('create-order-form', CreateOrderForm)
