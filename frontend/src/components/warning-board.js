import { LitElement, html, css } from 'lit';
import { api } from '../api.js';

class WarningBoard extends LitElement {
  static properties = {
    stats: { type: Object },
    normalList: { type: Array },
    warningList: { type: Array },
    overdueList: { type: Array },
    activeTab: { type: String },
    loading: { type: Boolean },
  };

  static styles = css`
    :host { display: block; }

    .page-container {
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 20px;
    }

    .stat-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: white;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      cursor: pointer;
      transition: all 0.2s;
      border: 2px solid transparent;
    }

    .stat-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .stat-card.active {
      border-color: #1890ff;
    }

    .stat-card.normal.active { border-color: #52c41a; }
    .stat-card.warning.active { border-color: #faad14; }
    .stat-card.overdue.active { border-color: #f5222d; }

    .stat-label {
      font-size: 14px;
      color: #8c8c8c;
      margin-bottom: 12px;
    }

    .stat-value {
      font-size: 36px;
      font-weight: 600;
    }

    .stat-card.normal .stat-value { color: #52c41a; }
    .stat-card.warning .stat-value { color: #faad14; }
    .stat-card.overdue .stat-value { color: #f5222d; }

    .stat-desc {
      font-size: 12px;
      color: #bfbfbf;
      margin-top: 8px;
    }

    .list-section {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      overflow: hidden;
    }

    .section-header {
      padding: 16px 24px;
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
    }

    .section-title.normal { color: #52c41a; }
    .section-title.warning { color: #faad14; }
    .section-title.overdue { color: #f5222d; }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      background: #fafafa;
      font-weight: 600;
      text-align: left;
      padding: 12px 24px;
      border-bottom: 1px solid #f0f0f0;
      font-size: 13px;
    }

    td {
      padding: 12px 24px;
      border-bottom: 1px solid #f0f0f0;
      font-size: 13px;
    }

    tbody tr:hover {
      background: #fafafa;
    }

    .status-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-pending { background: #e6f7ff; color: #1890ff; }
    .status-processing { background: #fff7e6; color: #fa8c16; }

    .warning-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 500;
    }

    .warning-normal { background: #f6ffed; color: #52c41a; }
    .warning-warning { background: #fff7e6; color: #fa8c16; }
    .warning-overdue { background: #fff1f0; color: #f5222d; }

    .action-link {
      color: #1890ff;
      cursor: pointer;
    }

    .action-link:hover {
      text-decoration: underline;
    }

    .loading {
      text-align: center;
      padding: 60px;
      color: #8c8c8c;
    }

    .empty {
      text-align: center;
      padding: 40px;
      color: #8c8c8c;
    }

    .responsible-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      background: #f0f0f0;
      color: #595959;
    }

    .responsible-tag.overdue {
      background: #fff1f0;
      color: #f5222d;
    }

    .tabs {
      display: flex;
      gap: 0;
      margin-bottom: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      overflow: hidden;
    }

    .tab-item {
      flex: 1;
      padding: 16px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      border-bottom: 3px solid transparent;
    }

    .tab-item:hover {
      background: #fafafa;
    }

    .tab-item.active {
      border-bottom-color: #1890ff;
      color: #1890ff;
      font-weight: 500;
    }

    .tab-item.normal.active { border-bottom-color: #52c41a; color: #52c41a; }
    .tab-item.warning.active { border-bottom-color: #faad14; color: #faad14; }
    .tab-item.overdue.active { border-bottom-color: #f5222d; color: #f5222d; }

    .tab-count {
      font-size: 20px;
      font-weight: 600;
      display: block;
      margin-bottom: 4px;
    }

    .tab-label {
      font-size: 13px;
    }

    .days-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .days-badge.positive {
      background: #f6ffed;
      color: #52c41a;
    }

    .days-badge.warning {
      background: #fff7e6;
      color: #fa8c16;
    }

    .days-badge.negative {
      background: #fff1f0;
      color: #f5222d;
    }
  `;

  constructor() {
    super();
    this.stats = {};
    this.normalList = [];
    this.warningList = [];
    this.overdueList = [];
    this.activeTab = 'warning';
    this.loading = false;
  }

  firstUpdated() {
    this._loadStats();
    this._loadLists();
  }

  async _loadStats() {
    try {
      this.stats = await api.getWarningStats();
    } catch (err) {
      console.error('加载统计失败:', err);
    }
  }

  async _loadLists() {
    this.loading = true;
    try {
      const [normalData, warningData, overdueData] = await Promise.all([
        api.getApplications({ warning: 'normal', pageSize: 50 }),
        api.getApplications({ warning: 'warning', pageSize: 50 }),
        api.getApplications({ warning: 'overdue', pageSize: 50 }),
      ]);
      this.normalList = normalData.list || [];
      this.warningList = warningData.list || [];
      this.overdueList = overdueData.list || [];
    } catch (err) {
      console.error('加载列表失败:', err);
    } finally {
      this.loading = false;
    }
  }

  _viewDetail(id) {
    window.dispatchEvent(new CustomEvent('navigate-to', { detail: { page: 'detail', id } }));
  }

  _getStatusClass(status) {
    const map = {
      '待派发': 'status-pending',
      '处理中': 'status-processing',
    };
    return map[status] || '';
  }

  _getDaysLeft(dueDate) {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  }

  _getDaysBadgeClass(days) {
    if (days === null) return '';
    if (days < 0) return 'negative';
    if (days <= 3) return 'warning';
    return 'positive';
  }

  _getDaysText(days) {
    if (days === null) return '-';
    if (days < 0) return `逾期${Math.abs(days)}天`;
    if (days === 0) return '今日到期';
    return `剩${days}天`;
  }

  _getCurrentList() {
    switch (this.activeTab) {
      case 'normal': return this.normalList;
      case 'warning': return this.warningList;
      case 'overdue': return this.overdueList;
      default: return [];
    }
  }

  render() {
    const currentList = this._getCurrentList();

    return html`
      <div class="page-container">
        <div class="page-title">到期预警</div>

        <div class="tabs">
          <div class="tab-item normal ${this.activeTab === 'normal' ? 'active' : ''}" @click=${() => (this.activeTab = 'normal')}>
            <span class="tab-count">${this.stats.normal || 0}</span>
            <span class="tab-label">正常</span>
          </div>
          <div class="tab-item warning ${this.activeTab === 'warning' ? 'active' : ''}" @click=${() => (this.activeTab = 'warning')}>
            <span class="tab-count">${this.stats.warning || 0}</span>
            <span class="tab-label">临期（3天内）</span>
          </div>
          <div class="tab-item overdue ${this.activeTab === 'overdue' ? 'active' : ''}" @click=${() => (this.activeTab = 'overdue')}>
            <span class="tab-count">${this.stats.overdue || 0}</span>
            <span class="tab-label">已逾期</span>
          </div>
        </div>

        <div class="list-section">
          <div class="section-header">
            <div class="section-title ${this.activeTab}">
              ${this.activeTab === 'normal' ? '正常队列' : ''}
              ${this.activeTab === 'warning' ? '临期队列' : ''}
              ${this.activeTab === 'overdue' ? '逾期队列' : ''}
            </div>
            <div style="font-size: 13px; color: #8c8c8c;">
              共 ${currentList.length} 条
            </div>
          </div>

          ${this.loading
            ? html`<div class="loading">加载中...</div>`
            : currentList.length === 0
            ? html`<div class="empty">暂无数据</div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th>申请编号</th>
                      <th>申请人</th>
                      <th>地址</th>
                      <th>状态</th>
                      <th>到期日期</th>
                      <th>剩余时间</th>
                      <th>当前处理人</th>
                      <th>节点责任人</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${currentList.map(
                      (app) => {
                        const daysLeft = this._getDaysLeft(app.dueDate);
                        return html`
                          <tr>
                            <td>${app.applicationNo}</td>
                            <td>${app.applicantName}</td>
                            <td>${app.address}</td>
                            <td>
                              <span class="status-tag ${this._getStatusClass(app.status)}">
                                ${app.status}
                              </span>
                            </td>
                            <td>${app.dueDate || '-'}</td>
                            <td>
                              <span class="days-badge ${this._getDaysBadgeClass(daysLeft)}">
                                ${this._getDaysText(daysLeft)}
                              </span>
                            </td>
                            <td>${app.currentHandler || '未指派'}</td>
                            <td>
                              <span class="responsible-tag ${this.activeTab === 'overdue' ? 'overdue' : ''}">
                                ${app.currentHandler || '待派发-无责任人'}
                              </span>
                            </td>
                            <td>
                              <span class="action-link" @click=${() => this._viewDetail(app.id)}>
                                处理
                              </span>
                            </td>
                          </tr>
                        `;
                      }
                    )}
                  </tbody>
                </table>
              `}
        </div>
      </div>
    `;
  }
}

customElements.define('warning-board', WarningBoard);
