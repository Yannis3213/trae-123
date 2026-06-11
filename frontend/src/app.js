import { LitElement, html, css } from 'lit'
import { api, setCurrentUser, getCurrentUser } from './api.js'
import './components/order-list.js'
import './components/order-detail.js'
import './components/batch-result.js'
import './components/create-order-form.js'

class MeetingApp extends LitElement {
  static properties = {
    users: { type: Array },
    currentUser: { type: Object },
    roles: { type: Object },
    statuses: { type: Object },
    stages: { type: Object },
    evidenceLabels: { type: Object },
    orders: { type: Array },
    stats: { type: Object },
    loading: { type: Boolean },
    selectedOrders: { type: Array },
    filters: { type: Object },
    detailOrderId: { type: Number },
    showCreateForm: { type: Boolean },
    batchResult: { type: Object },
    toast: { type: Object }
  }

  constructor() {
    super()
    this.users = []
    this.currentUser = null
    this.roles = {}
    this.statuses = {}
    this.stages = {}
    this.evidenceLabels = {}
    this.orders = []
    this.stats = {}
    this.loading = true
    this.selectedOrders = []
    this.filters = { status: '', stage: '', keyword: '', overdue_level: '' }
    this.detailOrderId = null
    this.showCreateForm = false
    this.batchResult = null
    this.toast = null
  }

  async firstUpdated() {
    await this.loadUserInfo()
    await this.loadOrders()
    this.startOverdueCheck()
  }

  startOverdueCheck() {
    setInterval(() => {
      if (this.orders.length > 0) {
        this.orders = [...this.orders]
      }
    }, 60000)
  }

  async loadUserInfo() {
    try {
      const data = await api.getUserInfo()
      this.users = data.users || []
      this.roles = data.roles || {}
      this.statuses = data.statuses || {}
      this.stages = data.stages || {}
      this.evidenceLabels = data.evidence_labels || {}
      this.currentUser = data.user
      
      if (!this.currentUser && this.users.length > 0) {
        this.switchUser(this.users[0].id)
      }
    } catch (error) {
      this.showToast(error.message, 'error')
    }
  }

  async switchUser(userId) {
    setCurrentUser(userId)
    this.selectedOrders = []
    this.detailOrderId = null
    this.showCreateForm = false
    await this.loadUserInfo()
    await this.loadOrders()
  }

  async loadOrders() {
    this.loading = true
    try {
      const data = await api.getOrders(this.filters)
      this.orders = data.orders || []
      this.stats = data.stats || {}
    } catch (error) {
      this.showToast(error.message, 'error')
      this.orders = []
      this.stats = {}
    } finally {
      this.loading = false
    }
  }

  applyFilters() {
    this.selectedOrders = []
    this.loadOrders()
  }

  resetFilters() {
    this.filters = { status: '', stage: '', keyword: '', overdue_level: '' }
    this.selectedOrders = []
    this.loadOrders()
  }

  toggleOrderSelection(orderId) {
    const index = this.selectedOrders.indexOf(orderId)
    if (index > -1) {
      this.selectedOrders = this.selectedOrders.filter(id => id !== orderId)
    } else {
      this.selectedOrders = [...this.selectedOrders, orderId]
    }
  }

  selectAllOrders() {
    if (this.selectedOrders.length === this.orders.length) {
      this.selectedOrders = []
    } else {
      this.selectedOrders = this.orders.filter(o => o.status !== 'sign_complete').map(o => o.id)
    }
  }

  openDetail(orderId) {
    this.detailOrderId = orderId
  }

  closeDetail() {
    this.detailOrderId = null
  }

  openCreateForm() {
    this.showCreateForm = true
  }

  closeCreateForm() {
    this.showCreateForm = false
  }

  async handleCreateSuccess(e) {
    const result = e.detail
    this.showToast(result.message || '创建成功', 'success')
    this.showCreateForm = false
    await this.loadOrders()
  }

  handleCreateError(e) {
    const error = e.detail
    this.showToast(error.message, 'error')
  }

  showToast(message, type = 'success') {
    this.toast = { message, type }
    setTimeout(() => {
      this.toast = null
    }, 3000)
  }

  async handleBatchProcess(action) {
    if (this.selectedOrders.length === 0) {
      this.showToast('请先选择要处理的单据', 'warning')
      return
    }

    const processData = {
      order_ids: this.selectedOrders,
      action: action,
      opinion: '',
      exception_reason: '',
      audit_remark: ''
    }

    if (action === 'approve') {
      processData.opinion = '批量审核通过'
    } else if (action === 'return') {
      const reason = prompt('请输入批量退回的原因：')
      if (!reason) return
      processData.exception_reason = reason
    } else if (action === 'exception') {
      const reason = prompt('请输入异常回传的原因：')
      if (!reason) return
      processData.exception_reason = reason
    }

    if (!confirm(`确定要对选中的 ${this.selectedOrders.length} 条单据执行批量操作吗？`)) {
      return
    }

    try {
      const result = await api.batchProcess(processData)
      this.batchResult = result
      this.selectedOrders = []
      await this.loadOrders()
    } catch (error) {
      this.showToast(error.message, 'error')
    }
  }

  closeBatchResult() {
    this.batchResult = null
  }

  async handleOrderUpdated() {
    await this.loadOrders()
  }

  get isRegister() {
    return this.currentUser?.role === 'register'
  }

  get canApprove() {
    if (!this.currentUser) return false
    return this.selectedOrders.some(id => {
      const order = this.orders.find(o => o.id === id)
      return order && order.status !== 'sign_complete' && 
             order.current_role === this.currentUser.role
    })
  }

  get canReturn() {
    if (!this.currentUser) return false
    return this.selectedOrders.some(id => {
      const order = this.orders.find(o => o.id === id)
      return order && order.status === 'pending_sign' && 
             order.current_role === this.currentUser.role
    })
  }

  get canBatchResubmit() {
    if (!this.currentUser) return false
    if (this.currentUser.role !== 'register') return false
    return this.selectedOrders.some(id => {
      const order = this.orders.find(o => o.id === id)
      return order && order.status === 'exception_return' && 
             order.current_role === this.currentUser.role
    })
  }

  get showBatchBar() {
    if (this.selectedOrders.length === 0) return false
    return this.canApprove || this.canReturn || this.canBatchResubmit
  }

  render() {
    return html`
      ${this._renderHeader()}
      <div class="app-container">
        ${this._renderStats()}
        ${this._renderFilters()}
        ${this._renderBatchBar()}
        ${this._renderOrderList()}
      </div>
      ${this.detailOrderId ? html`
        <order-detail
          .orderId=${this.detailOrderId}
          .currentUser=${this.currentUser}
          .statuses=${this.statuses}
          .stages=${this.stages}
          .roles=${this.roles}
          @close=${this.closeDetail}
          @updated=${this.handleOrderUpdated}
          @toast=${(e) => this.showToast(e.detail.message, e.detail.type)}
        ></order-detail>
      ` : ''}
      ${this.showCreateForm ? html`
        <create-order-form
          .visible=${this.showCreateForm}
          .stages=${this.stages}
          .evidenceLabels=${this.evidenceLabels}
          @close=${this.closeCreateForm}
          @success=${this.handleCreateSuccess}
          @error=${this.handleCreateError}
        ></create-order-form>
      ` : ''}
      ${this.batchResult ? html`
        <batch-result
          .result=${this.batchResult}
          @close=${this.closeBatchResult}
        ></batch-result>
      ` : ''}
      ${this.toast ? html`
        <div class="toast ${this.toast.type}">${this.toast.message}</div>
      ` : ''}
    `
  }

  _renderHeader() {
    return html`
      <header class="app-header">
        <div class="header-left">
          <h1>🏢 行政后勤中心 - 月底集中处理会议预约单系统</h1>
          <span class="header-subtitle">
            当前角色：${this.currentUser?.role ? this.roles[this.currentUser.role] : '-'}
          </span>
        </div>
        <div class="user-info">
          ${this.isRegister ? html`
            <button class="create-btn" @click=${this.openCreateForm}>
              ➕ 新建预约单
            </button>
          ` : ''}
          <span class="user-name">
            ${this.currentUser ? this.currentUser.name : '请选择角色'}
          </span>
          <div class="role-selector">
            ${this.users.map(user => html`
              <button
                class="role-btn ${this.currentUser?.id === user.id ? 'active' : ''}"
                @click=${() => this.switchUser(user.id)}
                title=${user.name}
              >
                ${this._getRoleShortName(user.role)}
              </button>
            `)}
          </div>
        </div>
      </header>
    `
  }

  _getRoleShortName(role) {
    const names = {
      'register': '登记员',
      'audit': '审核主管',
      'review': '复核经理'
    }
    return names[role] || role
  }

  _renderStats() {
    if (!this.stats) return ''
    
    return html`
      <div class="stats-card">
        <div class="stat-item">
          <div class="stat-value">${this.stats.total || 0}</div>
          <div class="stat-label">全部待办</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${this.stats.pending_sign || 0}</div>
          <div class="stat-label">待签收</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" style="color: #dc2626;">${this.stats.exception_return || 0}</div>
          <div class="stat-label">异常回传</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" style="color: #16a34a;">${this.stats.sign_complete || 0}</div>
          <div class="stat-label">签收完成</div>
        </div>
        <div class="stat-item urgent">
          <div class="stat-value">${this.stats.urgent || 0}</div>
          <div class="stat-label">临期</div>
        </div>
        <div class="stat-item overdue">
          <div class="stat-value">${this.stats.overdue || 0}</div>
          <div class="stat-label">逾期</div>
        </div>
      </div>
    `
  }

  _renderFilters() {
    return html`
      <div class="filter-bar">
        <div class="filter-item">
          <label>状态：</label>
          <select .value=${this.filters.status} @change=${(e) => { this.filters = { ...this.filters, status: e.target.value } }}>
            <option value="">全部</option>
            ${Object.entries(this.statuses).map(([key, label]) => html`
              <option value=${key}>${label}</option>
            `)}
          </select>
        </div>
        <div class="filter-item">
          <label>环节：</label>
          <select .value=${this.filters.stage} @change=${(e) => { this.filters = { ...this.filters, stage: e.target.value } }}>
            <option value="">全部</option>
            ${Object.entries(this.stages).map(([key, label]) => html`
              <option value=${key}>${label}</option>
            `)}
          </select>
        </div>
        <div class="filter-item">
          <label>预警：</label>
          <select .value=${this.filters.overdue_level} @change=${(e) => { this.filters = { ...this.filters, overdue_level: e.target.value } }}>
            <option value="">全部</option>
            <option value="normal">正常</option>
            <option value="urgent">临期</option>
            <option value="overdue">逾期</option>
          </select>
        </div>
        <div class="filter-item">
          <label>搜索：</label>
          <input
            type="text"
            placeholder="单据号/标题"
            .value=${this.filters.keyword}
            @input=${(e) => { this.filters = { ...this.filters, keyword: e.target.value } }}
            @keypress=${(e) => e.key === 'Enter' && this.applyFilters()}
          />
        </div>
        <button class="filter-btn" @click=${this.applyFilters}>查询</button>
        <button class="filter-btn reset-btn" @click=${this.resetFilters}>重置</button>
      </div>
    `
  }

  _renderBatchBar() {
    if (!this.showBatchBar) return ''
    
    return html`
      <div class="batch-bar">
        <span>已选择 <span class="selected-count">${this.selectedOrders.length}</span> 条单据</span>
        <div class="batch-actions">
          ${this.canApprove ? html`
            <button
              class="btn btn-success"
              @click=${() => this.handleBatchProcess('approve')}
            >
              ✓ 批量通过
            </button>
          ` : ''}
          ${this.canReturn ? html`
            <button
              class="btn btn-danger"
              @click=${() => this.handleBatchProcess('exception')}
            >
              ✕ 批量退回
            </button>
          ` : ''}
          <button
            class="btn btn-secondary"
            @click=${() => { this.selectedOrders = [] }}
          >
            取消选择
          </button>
        </div>
      </div>
    `
  }

  _renderOrderList() {
    if (this.loading) {
      return html`<div class="loading">加载中...</div>`
    }

    return html`
      <order-list
        .orders=${this.orders}
        .selectedOrders=${this.selectedOrders}
        .currentUser=${this.currentUser}
        .statuses=${this.statuses}
        .stages=${this.stages}
        .roles=${this.roles}
        @toggle-select=${(e) => this.toggleOrderSelection(e.detail)}
        @select-all=${this.selectAllOrders}
        @view-detail=${(e) => this.openDetail(e.detail)}
        @quick-action=${this._handleQuickAction}
        @toast=${(e) => this.showToast(e.detail.message, e.detail.type)}
      ></order-list>
    `
  }

  async _handleQuickAction(e) {
    const { order, action, reason } = e.detail
    
    try {
      const result = await api.batchProcess({
        order_ids: [order.id],
        action: action,
        opinion: action === 'approve' ? '快速审核通过' : null,
        exception_reason: reason || null,
        version: order.version
      })
      
      if (result.success_count > 0) {
        this.showToast('处理成功', 'success')
        await this.loadOrders()
      } else {
        const error = result.results.find(r => !r.success)
        this.showToast(error?.error || '处理失败', 'error')
      }
    } catch (error) {
      this.showToast(error.message, 'error')
    }
  }

  static styles = css`
    :host {
      display: block;
    }

    .app-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .app-header h1 {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
    }

    .header-subtitle {
      font-size: 12px;
      opacity: 0.85;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .user-name {
      font-size: 13px;
      opacity: 0.9;
    }

    .create-btn {
      padding: 8px 16px;
      background: rgba(255,255,255,0.2);
      color: white;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .create-btn:hover {
      background: rgba(255,255,255,0.3);
    }

    .role-selector {
      display: flex;
      gap: 4px;
    }

    .role-btn {
      padding: 6px 14px;
      border: 1px solid rgba(255,255,255,0.3);
      background: rgba(255,255,255,0.1);
      color: white;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 12px;
      white-space: nowrap;
    }

    .role-btn:hover {
      background: rgba(255,255,255,0.2);
    }

    .role-btn.active {
      background: white;
      color: #667eea;
      font-weight: 600;
    }

    .app-container {
      padding: 20px 32px;
    }

    .stats-card {
      background: white;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
    }

    .stat-item {
      text-align: center;
      padding: 10px;
      border-radius: 6px;
      background: #f8f9fa;
    }

    .stat-item .stat-value {
      font-size: 26px;
      font-weight: 700;
      color: #667eea;
    }

    .stat-item.urgent .stat-value {
      color: #f59e0b;
    }

    .stat-item.overdue .stat-value {
      color: #ef4444;
    }

    .stat-item .stat-label {
      font-size: 12px;
      color: #666;
      margin-top: 2px;
    }

    .filter-bar {
      background: white;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .filter-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .filter-item label {
      font-size: 12px;
      color: #666;
      white-space: nowrap;
    }

    .filter-item select,
    .filter-item input {
      padding: 5px 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 12px;
      min-width: 100px;
    }

    .filter-item input:focus,
    .filter-item select:focus {
      outline: none;
      border-color: #667eea;
    }

    .filter-btn {
      padding: 5px 14px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .filter-btn:hover {
      background: #5568d3;
    }

    .filter-btn.reset-btn {
      background: #6b7280;
    }

    .filter-btn.reset-btn:hover {
      background: #4b5563;
    }

    .batch-bar {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      padding: 10px 16px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .batch-bar .selected-count {
      font-weight: 600;
      color: #d97706;
    }

    .batch-actions {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
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
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #6b7280;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }

    .toast {
      position: fixed;
      top: 70px;
      right: 24px;
      padding: 10px 18px;
      border-radius: 8px;
      color: white;
      font-size: 13px;
      z-index: 2000;
      animation: slideIn 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .toast.success {
      background: #10b981;
    }

    .toast.error {
      background: #ef4444;
    }

    .toast.warning {
      background: #f59e0b;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `
}

customElements.define('meeting-app', MeetingApp)
