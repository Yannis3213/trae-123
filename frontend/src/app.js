import { LitElement, html, css } from 'lit'
import { api, setCurrentUser, getCurrentUser } from './api.js'
import './components/order-list.js'
import './components/order-detail.js'
import './components/batch-result.js'

class MeetingApp extends LitElement {
  static properties = {
    users: { type: Array },
    currentUser: { type: Object },
    roles: { type: Object },
    statuses: { type: Object },
    stages: { type: Object },
    orders: { type: Array },
    stats: { type: Object },
    loading: { type: Boolean },
    selectedOrders: { type: Array },
    filters: { type: Object },
    detailOrderId: { type: Number },
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
    this.orders = []
    this.stats = {}
    this.loading = true
    this.selectedOrders = []
    this.filters = { status: '', stage: '', keyword: '', overdue_level: '' }
    this.detailOrderId = null
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
      this.selectedOrders = this.orders.map(o => o.id)
    }
  }

  openDetail(orderId) {
    this.detailOrderId = orderId
  }

  closeDetail() {
    this.detailOrderId = null
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
      processData.exception_reason = '批量退回，请补正材料'
    } else if (action === 'exception') {
      processData.exception_reason = '批量异常回传'
    }

    if (!this._confirmBatchAction(action)) {
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

  _confirmBatchAction(action) {
    const actionNames = {
      approve: '批量审核通过',
      return: '批量退回补正',
      exception: '批量异常回传'
    }
    return confirm(`确定要${actionNames[action]}选中的 ${this.selectedOrders.length} 条单据吗？`)
  }

  closeBatchResult() {
    this.batchResult = null
  }

  async handleOrderUpdated() {
    await this.loadOrders()
  }

  get canApprove() {
    if (!this.currentUser) return false
    return this.selectedOrders.some(id => {
      const order = this.orders.find(o => o.id === id)
      return order && order.status !== 'sign_complete'
    })
  }

  get canReturn() {
    if (!this.currentUser) return false
    return this.selectedOrders.some(id => {
      const order = this.orders.find(o => o.id === id)
      return order && order.status === 'pending_sign'
    })
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
        <h1>🏢 行政后勤中心 - 月底集中处理会议预约单系统</h1>
        <div class="user-info">
          <span>${this.currentUser ? `当前登录：${this.currentUser.name}` : '请选择角色'}</span>
          <div class="role-selector">
            ${this.users.map(user => html`
              <button
                class="role-btn ${this.currentUser?.id === user.id ? 'active' : ''}"
                @click=${() => this.switchUser(user.id)}
              >
                ${user.name}
              </button>
            `)}
          </div>
        </div>
      </header>
    `
  }

  _renderStats() {
    if (!this.stats) return ''
    
    return html`
      <div class="stats-card">
        <div class="stat-item">
          <div class="stat-value">${this.stats.total || 0}</div>
          <div class="stat-label">全部</div>
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
        <button class="filter-btn" style="background: #6b7280;" @click=${this.resetFilters}>重置</button>
      </div>
    `
  }

  _renderBatchBar() {
    if (this.selectedOrders.length === 0) return ''
    
    return html`
      <div class="batch-bar">
        <span>已选择 <span class="selected-count">${this.selectedOrders.length}</span> 条单据</span>
        <div class="batch-actions">
          <button
            class="btn btn-success"
            ?disabled=${!this.canApprove}
            @click=${() => this.handleBatchProcess('approve')}
          >
            ✓ 批量通过
          </button>
          <button
            class="btn btn-danger"
            ?disabled=${!this.canReturn}
            @click=${() => this.handleBatchProcess('return')}
          >
            ✕ 批量退回
          </button>
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
        @toast=${(e) => this.showToast(e.detail.message, e.detail.type)}
      ></order-list>
    `
  }

  static styles = css`
    :host {
      display: block;
    }
  `
}

customElements.define('meeting-app', MeetingApp)
