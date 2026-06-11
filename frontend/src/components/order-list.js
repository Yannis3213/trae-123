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
    if (order.status === 'sign_complete') return false
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
                    <button
                      class="action-btn approve"
                      @click=${() => this._quickApprove(order)}
                    >
                      通过
                    </button>
                    ${order.status === 'pending_sign' ? html`
                      <button
                        class="action-btn return"
                        @click=${() => this._quickReturn(order)}
                      >
                        退回
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
      detail: { order, action: 'return', reason }
    }))
  }

  static styles = css`
    :host {
      display: block;
    }
  `
}

customElements.define('order-list', OrderList)
