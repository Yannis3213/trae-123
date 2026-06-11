import { LitElement, html, css } from 'lit'

class OrderList extends LitElement {
  static properties = {
    orders: { type: Array },
    selectedOrders: { type: Array },
    currentUser: { type: Object },
    statuses: { type: Object },
    stages: { type: Object },
    roles: { type: Object }
  }

  constructor() {
    super()
    this.orders = []
    this.selectedOrders = []
  }

  isSelected(orderId) {
    return this.selectedOrders.includes(orderId)
  }

  canOperate(order) {
    if (!this.currentUser) return false
    if (order.status === 'reviewed') return false
    if (order.current_role !== this.currentUser.role) return false
    if (order.handler && order.handler !== this.currentUser.id) return false
    return true
  }

  getOverdueClass(order) {
    const level = order.overdue_info?.level || 'normal'
    return `overdue-${level}`
  }

  getOverdueLabel(order) {
    const label = order.overdue_info?.label || '正常'
    const hours = order.overdue_info?.hours || 0
    if (order.overdue_info?.level === 'overdue') {
      return `${label} ${Math.abs(Math.round(hours))}小时`
    } else if (order.overdue_info?.level === 'urgent') {
      return `${label} ${Math.round(hours)}小时`
    }
    return label
  }

  render() {
    if (this.orders.length === 0) {
      return html`
        <div class="order-table">
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <div>暂无待处理的会议预约单</div>
          </div>
        </div>
      `
    }

    const allSelected = this.selectedOrders.length === this.orders.length && this.orders.length > 0

    return html`
      <div class="order-table">
        <table>
          <thead>
            <tr>
              <th class="checkbox-cell">
                <input
                  type="checkbox"
                  ?checked=${allSelected}
                  @change=${() => this.dispatchEvent(new CustomEvent('select-all'))}
                />
              </th>
              <th>单据号</th>
              <th>会议标题</th>
              <th>会议时间</th>
              <th>会议室</th>
              <th>当前环节</th>
              <th>状态</th>
              <th>截止时间</th>
              <th>处理人</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${this.orders.map(order => html`
              <tr>
                <td class="checkbox-cell">
                  <input
                    type="checkbox"
                    ?checked=${this.isSelected(order.id)}
                    ?disabled=${!this.canOperate(order)}
                    @change=${() => this.dispatchEvent(new CustomEvent('toggle-select', { detail: order.id }))}
                  />
                </td>
                <td>
                  ${order.order_no}
                  ${order.overdue_info ? html`
                    <span class="overdue-tag ${this.getOverdueClass(order)}">
                      ${this.getOverdueLabel(order)}
                    </span>
                  ` : ''}
                </td>
                <td>${order.title}</td>
                <td>${order.meeting_date} ${order.start_time}-${order.end_time}</td>
                <td>${order.room_name || '-'}</td>
                <td>
                  <span style="color: #667eea; font-weight: 500;">
                    ${order.stage_label || order.current_stage}
                  </span>
                </td>
                <td>
                  <span class="status-tag status-${order.status}">
                    ${order.status_label || order.status}
                  </span>
                </td>
                <td>${order.deadline}</td>
                <td>${order.handler_name || order.handler || '-'}</td>
                <td>
                  <button
                    class="action-btn view"
                    @click=${() => this.dispatchEvent(new CustomEvent('view-detail', { detail: order.id }))}
                  >
                    详情
                  </button>
                  ${this.canOperate(order) ? html`
                    ${order.status === 'exception_return' && this.currentUser?.role === 'register' ? html`
                      <button
                        class="action-btn approve"
                        @click=${() => this._quickResubmit(order)}
                      >
                        补正
                      </button>
                    ` : ''}
                    ${order.status === 'pending_sign' ? html`
                      <button
                        class="action-btn approve"
                        @click=${() => this._quickApprove(order)}
                      >
                        通过
                      </button>
                      <button
                        class="action-btn return"
                        @click=${() => this._quickReturn(order)}
                      >
                        退回
                      </button>
                    ` : ''}
                    ${order.status === 'sign_complete' && this.currentUser?.role === 'review' ? html`
                      <button
                        class="action-btn review"
                        @click=${() => this._quickReview(order)}
                      >
                        归档
                      </button>
                    ` : ''}
                  ` : ''}
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `
  }

  _quickApprove(order) {
    if (!confirm(`确定要通过「${order.title}」吗？`)) return
    this.dispatchEvent(new CustomEvent('quick-action', {
      detail: { order, action: 'approve' }
    }))
  }

  _quickReturn(order) {
    const reason = prompt('请输入退回原因：')
    if (!reason) return
    this.dispatchEvent(new CustomEvent('quick-action', {
      detail: { order, action: 'exception', reason }
    }))
  }

  _quickResubmit(order) {
    this.dispatchEvent(new CustomEvent('view-detail', { detail: order.id }))
  }

  _quickReview(order) {
    this.dispatchEvent(new CustomEvent('view-detail', { detail: order.id }))
  }

  static styles = css`
    :host {
      display: block;
    }

    .order-table {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead {
      background: #f8f9fa;
    }

    th {
      padding: 12px 16px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      border-bottom: 1px solid #e5e7eb;
      white-space: nowrap;
    }

    td {
      padding: 12px 16px;
      font-size: 13px;
      color: #374151;
      border-bottom: 1px solid #f3f4f6;
    }

    tbody tr:hover {
      background: #f9fafb;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .checkbox-cell {
      width: 40px;
      text-align: center;
    }

    .checkbox-cell input[type="checkbox"] {
      cursor: pointer;
      width: 16px;
      height: 16px;
    }

    .overdue-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
      margin-left: 8px;
      vertical-align: middle;
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

    .status-tag {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
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

    .status-reviewed {
      background: #ede9fe;
      color: #6d28d9;
    }

    .action-btn {
      padding: 5px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      margin-right: 6px;
      transition: all 0.2s;
    }

    .action-btn:last-child {
      margin-right: 0;
    }

    .action-btn.view {
      background: #e0e7ff;
      color: #4338ca;
    }

    .action-btn.view:hover {
      background: #c7d2fe;
    }

    .action-btn.approve {
      background: #d1fae5;
      color: #047857;
    }

    .action-btn.approve:hover {
      background: #a7f3d0;
    }

    .action-btn.return {
      background: #fee2e2;
      color: #dc2626;
    }

    .action-btn.return:hover {
      background: #fecaca;
    }

    .action-btn.review {
      background: #ede9fe;
      color: #6d28d9;
    }

    .action-btn.review:hover {
      background: #ddd6fe;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #9ca3af;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }

    .empty-state div {
      font-size: 14px;
    }
  `
}

customElements.define('order-list', OrderList)
