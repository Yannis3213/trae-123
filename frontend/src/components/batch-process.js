import { LitElement, html, css } from 'lit';
import { api } from '../api.js';

class BatchProcess extends LitElement {
  static properties = {
    applications: { type: Array },
    selectedIds: { type: Array },
    filters: { type: Object },
    batchAction: { type: String },
    batchForm: { type: Object },
    showResult: { type: Boolean },
    batchResults: { type: Array },
    batchSummary: { type: Object },
    loading: { type: Boolean },
    processing: { type: Boolean },
    error: { type: String },
    currentUser: { type: Object },
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

    .action-selector {
      background: white;
      padding: 20px 24px;
      border-radius: 8px;
      margin-bottom: 16px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }

    .selector-title {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .action-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }

    .action-card {
      border: 2px solid #d9d9d9;
      border-radius: 8px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .action-card:hover {
      border-color: #1890ff;
      background: #e6f7ff;
    }

    .action-card.active {
      border-color: #1890ff;
      background: #e6f7ff;
    }

    .action-card.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .action-card-title {
      font-weight: 600;
      margin-bottom: 4px;
    }

    .action-card-desc {
      font-size: 12px;
      color: #8c8c8c;
    }

    .filter-bar {
      background: white;
      padding: 16px 24px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }

    .filter-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .filter-item label {
      color: #595959;
      font-size: 13px;
      white-space: nowrap;
    }

    .filter-item input,
    .filter-item select {
      width: 160px;
      padding: 6px 10px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      font-size: 13px;
    }

    .btn-primary {
      background-color: #1890ff;
      color: white;
      padding: 8px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    .btn-primary:hover { background-color: #40a9ff; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-default {
      background-color: white;
      color: #595959;
      padding: 8px 20px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    .btn-default:hover {
      color: #1890ff;
      border-color: #1890ff;
    }

    .btn-danger {
      background-color: #ff4d4f;
      color: white;
      padding: 8px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .table-container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      background: #fafafa;
      font-weight: 600;
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #d9d9d9;
      font-size: 13px;
    }

    td {
      padding: 12px;
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

    .action-bar {
      background: #e6f7ff;
      padding: 12px 24px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .action-bar-info {
      color: #1890ff;
      font-size: 14px;
    }

    .action-bar-form {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-left: auto;
    }

    .action-bar-form select,
    .action-bar-form input,
    .action-bar-form textarea {
      padding: 6px 10px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      font-size: 13px;
    }

    .batch-result {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      padding: 24px;
    }

    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .result-title {
      font-size: 16px;
      font-weight: 600;
    }

    .result-summary {
      display: flex;
      gap: 32px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #f0f0f0;
    }

    .summary-item {
      text-align: center;
    }

    .summary-label {
      font-size: 13px;
      color: #8c8c8c;
      margin-bottom: 4px;
    }

    .summary-value {
      font-size: 28px;
      font-weight: 600;
    }

    .summary-value.success { color: #52c41a; }
    .summary-value.fail { color: #f5222d; }
    .summary-value.total { color: #262626; }

    .result-list {
      max-height: 400px;
      overflow-y: auto;
    }

    .result-item {
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .result-item.success {
      background: #f6ffed;
      border: 1px solid #b7eb8f;
    }

    .result-item.fail {
      background: #fff1f0;
      border: 1px solid #ffa39e;
    }

    .result-item-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .result-item-app {
      font-weight: 500;
    }

    .result-item-status {
      font-size: 12px;
      color: #8c8c8c;
    }

    .result-item-reason {
      font-size: 13px;
    }

    .result-item.fail .result-item-reason {
      color: #f5222d;
    }

    .result-item.success .result-item-reason {
      color: #52c41a;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #8c8c8c;
    }

    .error-msg {
      color: #f5222d;
      padding: 12px;
      background: #fff1f0;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .back-btn {
      color: #1890ff;
      cursor: pointer;
      margin-bottom: 16px;
      display: inline-block;
    }

    .form-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .form-group label {
      font-size: 13px;
      color: #595959;
      white-space: nowrap;
    }

    .form-group select,
    .form-group input,
    .form-group textarea {
      padding: 6px 10px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      font-size: 13px;
    }
  `;

  constructor() {
    super();
    this.applications = [];
    this.selectedIds = [];
    this.filters = {
      status: '',
      warning: '',
      keyword: '',
    };
    this.batchAction = '';
    this.batchForm = {
      handlerId: '',
      remark: '',
      reason: '',
    };
    this.showResult = false;
    this.batchResults = [];
    this.batchSummary = {};
    this.loading = false;
    this.processing = false;
    this.error = '';
    this.currentUser = null;
  }

  firstUpdated() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }
    window.addEventListener('auth-changed', (e) => {
      this.currentUser = e.detail.user;
    });
    this._loadApplications();
  }

  async _loadApplications() {
    this.loading = true;
    try {
      const data = await api.getApplications({
        pageSize: 50,
        status: this.filters.status,
        warning: this.filters.warning,
        keyword: this.filters.keyword,
      });
      this.applications = data.list;
    } catch (err) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  }

  _handleFilterChange(e) {
    const { name, value } = e.target;
    this.filters = { ...this.filters, [name]: value };
    this._loadApplications();
  }

  _toggleSelectAll(e) {
    if (e.target.checked) {
      this.selectedIds = this.applications
        .filter((a) => this._canBatchAction(a, this.batchAction))
        .map((a) => a.id);
    } else {
      this.selectedIds = [];
    }
  }

  _toggleSelect(id, e) {
    if (e.target.checked) {
      this.selectedIds = [...this.selectedIds, id];
    } else {
      this.selectedIds = this.selectedIds.filter((x) => x !== id);
    }
  }

  _isSelected(id) {
    return this.selectedIds.includes(id);
  }

  _canBatchAction(app, action) {
    if (!this.currentUser) return false;
    const role = this.currentUser.role;

    switch (action) {
      case 'batch_dispatch':
        return role === 'meter_supervisor' && app.status === '待派发';
      case 'batch_close':
        return role === 'business_manager' && app.status === '处理中';
      case 'batch_overdue_advance':
        return role === 'meter_supervisor' && app.status === '处理中' && app.warningLevel === 'overdue';
      default:
        return false;
    }
  }

  _selectAction(action) {
    if (!this._canUseAction(action)) return;
    this.batchAction = action;
    this.selectedIds = [];
    this.showResult = false;
  }

  _canUseAction(action) {
    if (!this.currentUser) return false;
    const role = this.currentUser.role;

    switch (action) {
      case 'batch_dispatch':
        return role === 'meter_supervisor';
      case 'batch_close':
        return role === 'business_manager';
      case 'batch_overdue_advance':
        return role === 'meter_supervisor';
      default:
        return false;
    }
  }

  _getActionLabel(action) {
    const map = {
      batch_dispatch: '批量派发',
      batch_close: '批量关闭',
      batch_overdue_advance: '逾期批量推进',
    };
    return map[action] || action;
  }

  _handleFormInput(e) {
    const { name, value } = e.target;
    this.batchForm = { ...this.batchForm, [name]: value };
  }

  async _handleBatchProcess() {
    if (this.selectedIds.length === 0) {
      alert('请先选择要处理的申请');
      return;
    }

    if (this.batchAction === 'batch_dispatch' && !this.batchForm.handlerId) {
      alert('请选择处理人');
      return;
    }

    if (this.batchAction === 'batch_overdue_advance' && !this.batchForm.reason) {
      alert('请填写推进原因');
      return;
    }

    this.processing = true;
    this.error = '';

    try {
      const data = {
        ids: this.selectedIds,
        action: this.batchAction,
        ...this.batchForm,
      };

      const result = await api.batchProcess(data);
      this.batchResults = result.results;
      this.batchSummary = {
        total: result.total,
        successCount: result.successCount,
        failCount: result.failCount,
      };
      this.showResult = true;
    } catch (err) {
      this.error = err.message;
    } finally {
      this.processing = false;
    }
  }

  _getStatusClass(status) {
    const map = {
      '待派发': 'status-pending',
      '处理中': 'status-processing',
    };
    return map[status] || '';
  }

  _getWarningClass(level) {
    const map = {
      normal: 'warning-normal',
      warning: 'warning-warning',
      overdue: 'warning-overdue',
    };
    return map[level] || '';
  }

  _getWarningLabel(level) {
    const map = {
      normal: '正常',
      warning: '临期',
      overdue: '逾期',
    };
    return map[level] || '';
  }

  _resetBatch() {
    this.showResult = false;
    this.batchResults = [];
    this.selectedIds = [];
    this._loadApplications();
  }

  render() {
    const selectableCount = this.applications.filter((a) => this._canBatchAction(a, this.batchAction)).length;

    return html`
      <div class="page-container">
        <div class="page-title">批量处理</div>

        ${this.showResult
          ? html`
              <div class="batch-result">
                <div class="result-header">
                  <div class="result-title">批量处理结果</div>
                  <button class="btn-default" @click=${this._resetBatch}>返回继续处理</button>
                </div>

                <div class="result-summary">
                  <div class="summary-item">
                    <div class="summary-label">总计</div>
                    <div class="summary-value total">${this.batchSummary.total}</div>
                  </div>
                  <div class="summary-item">
                    <div class="summary-label">成功</div>
                    <div class="summary-value success">${this.batchSummary.successCount}</div>
                  </div>
                  <div class="summary-item">
                    <div class="summary-label">失败</div>
                    <div class="summary-value fail">${this.batchSummary.failCount}</div>
                  </div>
                </div>

                <div class="result-list">
                  ${this.batchResults.map(
                    (item) => html`
                      <div class="result-item ${item.success ? 'success' : 'fail'}">
                        <div class="result-item-info">
                          <div class="result-item-app">
                            ${this.applications.find((a) => a.id === item.id)?.applicationNo || item.id}
                          </div>
                          <div class="result-item-status">原状态: ${item.status}</div>
                        </div>
                        <div class="result-item-reason">${item.reason}</div>
                      </div>
                    `
                  )}
                </div>
              </div>
            `
          : html`
              <div class="action-selector">
                <div class="selector-title">选择批量操作</div>
                <div class="action-cards">
                  <div
                    class="action-card ${this.batchAction === 'batch_dispatch' ? 'active' : ''} ${!this._canUseAction('batch_dispatch') ? 'disabled' : ''}"
                    @click=${() => this._selectAction('batch_dispatch')}
                  >
                    <div class="action-card-title">批量派发</div>
                    <div class="action-card-desc">将"待派发"状态的申请批量派发给处理人</div>
                  </div>
                  <div
                    class="action-card ${this.batchAction === 'batch_close' ? 'active' : ''} ${!this._canUseAction('batch_close') ? 'disabled' : ''}"
                    @click=${() => this._selectAction('batch_close')}
                  >
                    <div class="action-card-title">批量关闭</div>
                    <div class="action-card-desc">将"处理中"状态的申请批量复核关闭</div>
                  </div>
                  <div
                    class="action-card ${this.batchAction === 'batch_overdue_advance' ? 'active' : ''} ${!this._canUseAction('batch_overdue_advance') ? 'disabled' : ''}"
                    @click=${() => this._selectAction('batch_overdue_advance')}
                  >
                    <div class="action-card-title">逾期批量推进</div>
                    <div class="action-card-desc">对逾期的处理中申请批量记录推进</div>
                  </div>
                </div>
              </div>

              ${this.error ? html`<div class="error-msg">${this.error}</div>` : ''}

              ${this.batchAction
                ? html`
                    <div class="filter-bar">
                      <div class="filter-item">
                        <label>状态:</label>
                        <select name="status" .value=${this.filters.status} @change=${this._handleFilterChange}>
                          <option value="">全部状态</option>
                          <option value="待派发">待派发</option>
                          <option value="处理中">处理中</option>
                        </select>
                      </div>
                      <div class="filter-item">
                        <label>预警:</label>
                        <select name="warning" .value=${this.filters.warning} @change=${this._handleFilterChange}>
                          <option value="">全部</option>
                          <option value="normal">正常</option>
                          <option value="warning">临期</option>
                          <option value="overdue">逾期</option>
                        </select>
                      </div>
                      <div class="filter-item">
                        <label>关键词:</label>
                        <input
                          type="text"
                          name="keyword"
                          .value=${this.filters.keyword}
                          @input=${this._handleFilterChange}
                          placeholder="申请人/申请号/地址"
                        />
                      </div>
                    </div>

                    <div class="action-bar">
                      <div class="action-bar-info">
                        已选择 ${this.selectedIds.length} / ${selectableCount} 条可处理记录
                      </div>
                      <div class="action-bar-form">
                        ${this.batchAction === 'batch_dispatch'
                          ? html`
                              <div class="form-group">
                                <label>处理人:</label>
                                <select name="handlerId" .value=${this.batchForm.handlerId} @change=${this._handleFormInput}>
                                  <option value="">请选择</option>
                                  <option value="u003">王主管</option>
                                  <option value="u004">赵抄表</option>
                                </select>
                              </div>
                              <div class="form-group">
                                <label>备注:</label>
                                <input
                                  type="text"
                                  name="remark"
                                  .value=${this.batchForm.remark}
                                  @input=${this._handleFormInput}
                                  placeholder="备注信息"
                                />
                              </div>
                            `
                          : ''}

                        ${this.batchAction === 'batch_close'
                          ? html`
                              <div class="form-group">
                                <label>复核意见:</label>
                                <input
                                  type="text"
                                  name="remark"
                                  .value=${this.batchForm.remark}
                                  @input=${this._handleFormInput}
                                  placeholder="复核意见"
                                />
                              </div>
                            `
                          : ''}

                        ${this.batchAction === 'batch_overdue_advance'
                          ? html`
                              <div class="form-group">
                                <label>推进原因:</label>
                                <input
                                  type="text"
                                  name="reason"
                                  .value=${this.batchForm.reason}
                                  @input=${this._handleFormInput}
                                  placeholder="请填写推进原因"
                                />
                              </div>
                            `
                          : ''}

                        <button
                          class="btn-primary"
                          @click=${this._handleBatchProcess}
                          ?disabled=${this.selectedIds.length === 0 || this.processing}
                        >
                          ${this.processing ? '处理中...' : '确认批量处理'}
                        </button>
                      </div>
                    </div>

                    <div class="table-container">
                      ${this.loading
                        ? html`<div class="loading">加载中...</div>`
                        : html`
                            <table>
                              <thead>
                                <tr>
                                  <th style="width: 40px;">
                                    <input
                                      type="checkbox"
                                      @change=${this._toggleSelectAll}
                                      .checked=${this.selectedIds.length === selectableCount && selectableCount > 0}
                                    />
                                  </th>
                                  <th>申请编号</th>
                                  <th>申请人</th>
                                  <th>地址</th>
                                  <th>状态</th>
                                  <th>资料状态</th>
                                  <th>到期日期</th>
                                  <th>预警</th>
                                  <th>当前处理人</th>
                                  <th>异常原因</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${this.applications.length === 0
                                  ? html`
                                      <tr>
                                        <td colspan="10" style="text-align: center; color: #8c8c8c; padding: 40px;">
                                          暂无数据
                                        </td>
                                      </tr>
                                    `
                                  : this.applications.map(
                                      (app) => {
                                        const canAction = this._canBatchAction(app, this.batchAction);
                                        return html`
                                          <tr>
                                            <td>
                                              <input
                                                type="checkbox"
                                                .checked=${this._isSelected(app.id)}
                                                .disabled=${!canAction}
                                                @change=${(e) => canAction && this._toggleSelect(app.id, e)}
                                              />
                                            </td>
                                            <td>${app.applicationNo}</td>
                                            <td>${app.applicantName}</td>
                                            <td>${app.address}</td>
                                            <td>
                                              <span class="status-tag ${this._getStatusClass(app.status)}">
                                                ${app.status}
                                              </span>
                                            </td>
                                            <td>${app.materialStatus || '-'}</td>
                                            <td>${app.dueDate || '-'}</td>
                                            <td>
                                              <span class="warning-tag ${this._getWarningClass(app.warningLevel)}">
                                                ${this._getWarningLabel(app.warningLevel)}
                                              </span>
                                            </td>
                                            <td>${app.currentHandler || '-'}</td>
                                            <td style="color: #f5222d; font-size: 12px;">
                                              ${app.exceptionReason || '-'}
                                            </td>
                                          </tr>
                                        `;
                                      }
                                    )}
                              </tbody>
                            </table>
                          `}
                    </div>
                  `
                : html`
                    <div style="text-align: center; padding: 60px; color: #8c8c8c;">
                      请先选择批量操作类型
                    </div>
                  `}
            `}
      </div>
    `;
  }
}

customElements.define('batch-process', BatchProcess);
