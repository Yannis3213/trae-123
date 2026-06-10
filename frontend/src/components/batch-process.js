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
    currentBatchNo: { type: String },
    loading: { type: Boolean },
    processing: { type: Boolean },
    error: { type: String },
    currentUser: { type: Object },
    activeTab: { type: String },
    batches: { type: Array },
    batchesTotal: { type: Number },
    batchesPage: { type: Number },
    batchesLoading: { type: Boolean },
    selectedBatchNo: { type: String },
    selectedBatchDetail: { type: Object },
    batchDetailLoading: { type: Boolean },
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
      margin-bottom: 16px;
    }

    .tab-bar {
      display: flex;
      border-bottom: 2px solid #f0f0f0;
      margin-bottom: 16px;
    }

    .tab-item {
      padding: 10px 20px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #595959;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.2s;
    }

    .tab-item:hover {
      color: #1890ff;
    }

    .tab-item.active {
      color: #1890ff;
      border-bottom-color: #1890ff;
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
    this.currentBatchNo = '';
    this.loading = false;
    this.processing = false;
    this.error = '';
    this.currentUser = null;
    this.activeTab = 'process';
    this.batches = [];
    this.batchesTotal = 0;
    this.batchesPage = 1;
    this.batchesLoading = false;
    this.selectedBatchNo = '';
    this.selectedBatchDetail = null;
    this.batchDetailLoading = false;
  }

  firstUpdated() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }
    window.addEventListener('auth-changed', (e) => {
      this.currentUser = e.detail.user;
      this.selectedIds = [];
      this.batchAction = '';
      this.showResult = false;
      this.selectedBatchDetail = null;
      this.selectedBatchNo = '';
      this._loadApplications();
      if (this.activeTab === 'history') this._loadBatches();
    });
    window.addEventListener('refresh-data', () => {
      this.selectedIds = [];
      this.batchAction = '';
      this.showResult = false;
      this.selectedBatchDetail = null;
      this.selectedBatchNo = '';
      this._loadApplications();
      if (this.activeTab === 'history') this._loadBatches();
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
      const items = this.applications
        .filter((a) => this.selectedIds.includes(a.id))
        .map((a) => ({
          id: a.id,
          version: a.version,
          status: a.status,
        }));

      const data = {
        items,
        action: this.batchAction,
        ...this.batchForm,
      };

      const result = await api.batchProcess(data);
      this.batchResults = result.results;
      this.currentBatchNo = result.batchNo || '';
      this.batchSummary = {
        batchNo: result.batchNo || '',
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

  _switchTab(tab) {
    this.activeTab = tab;
    this.selectedBatchDetail = null;
    this.selectedBatchNo = '';
    if (tab === 'history') {
      this._loadBatches();
    } else {
      this._loadApplications();
    }
  }

  async _loadBatches() {
    this.batchesLoading = true;
    try {
      const data = await api.getBatches({ page: this.batchesPage, pageSize: 20 });
      this.batches = data.list || [];
      this.batchesTotal = data.total || 0;
    } catch (err) {
      this.error = err.message;
    } finally {
      this.batchesLoading = false;
    }
  }

  async _viewBatchDetail(batchNo) {
    this.selectedBatchNo = batchNo;
    this.batchDetailLoading = true;
    this.selectedBatchDetail = null;
    try {
      const data = await api.getBatchDetail(batchNo);
      this.selectedBatchDetail = data;
    } catch (err) {
      this.error = err.message;
    } finally {
      this.batchDetailLoading = false;
    }
  }

  _backToBatchList() {
    this.selectedBatchNo = '';
    this.selectedBatchDetail = null;
    this._loadBatches();
  }

  _viewCurrentBatchDetail() {
    if (this.currentBatchNo) {
      this.activeTab = 'history';
      this._viewBatchDetail(this.currentBatchNo);
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

  _getHandlerName(handlerId) {
    const map = {
      u003: '王主管（抄表主管）',
      u004: '赵抄表（抄表主管）',
      u002: '李窗口（窗口人员）',
      u001: '张经理（营业经理）',
    };
    return map[handlerId] || handlerId;
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

        <div class="tab-bar">
          <div class="tab-item ${this.activeTab === 'process' ? 'active' : ''}" @click=${() => this._switchTab('process')}>
            办理任务
          </div>
          <div class="tab-item ${this.activeTab === 'history' ? 'active' : ''}" @click=${() => this._switchTab('history')}>
            最近批次
          </div>
        </div>

        ${this.error
          ? html`<div style="background: #fff2f0; border: 1px solid #ffccc7; color: #f5222d; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px;">${this.error}</div>`
          : ''}

        ${this.activeTab === 'process'
          ? html`
              ${this.showResult
                ? html`
                    <div class="batch-result">
                      <div class="result-header">
                        <div class="result-title">
                          批量处理结果
                          ${this.batchSummary.batchNo
                            ? html`<span style="font-size: 12px; color: #8c8c8c; font-weight: normal; margin-left: 10px;">批次号: ${this.batchSummary.batchNo}</span>`
                            : ''}
                        </div>
                        <div style="display: flex; gap: 8px;">
                          ${this.currentBatchNo
                            ? html`<button class="btn-default" @click=${this._viewCurrentBatchDetail}>查看批次详情 →</button>`
                            : ''}
                          <button class="btn-default" @click=${this._resetBatch}>返回继续处理</button>
                        </div>
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
                                  ${item.applicationNo || this.applications.find((a) => a.id === item.id)?.applicationNo || item.id}
                                  ${item.nodeName
                                    ? html`<span style="font-size: 11px; color: #8c8c8c; margin-left: 6px; font-weight: normal;">[${item.nodeName}]</span>`
                                    : ''}
                                </div>
                                <div class="result-item-status">
                                  ${item.previousStatus || item.status}
                                  ${item.success && item.newStatus && item.newStatus !== (item.previousStatus || item.status)
                                    ? html` → ${item.newStatus}`
                                    : ''}
                                  ${!item.success && item.newStatus && item.newStatus === (item.previousStatus || item.status)
                                    ? html`（状态未变更）`
                                    : ''}
                                </div>
                              </div>
                              ${item.handlerId
                                ? html`<div style="font-size: 12px; color: #595959; margin-bottom: 4px;">派发处理人: ${this._getHandlerName(item.handlerId)}</div>`
                                : ''}
                              <div class="result-item-reason">${item.reason}</div>
                            </div>
                          `
                        )}
                      </div>
                    </div>
                  `
                : ''}
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
          : html`
              ${this.selectedBatchDetail
                ? this._renderBatchHistoryDetail()
                : this._renderBatchHistoryList()}
            `}
      </div>
    `;
  }

  _renderBatchHistoryList() {
    return html`
      <div class="action-selector">
        <div class="selector-title">最近批次列表</div>
        ${this.batchesLoading
          ? html`<div class="loading">加载中...</div>`
          : html`
              ${this.batches.length === 0
                ? html`<div style="text-align: center; padding: 40px; color: #8c8c8c;">暂无批次记录</div>`
                : html`
                    <table style="width: 100%;">
                      <thead>
                        <tr style="background: #fafafa;">
                          <th style="text-align: left; padding: 10px 12px;">批次号</th>
                          <th style="text-align: left; padding: 10px 12px;">操作类型</th>
                          <th style="text-align: left; padding: 10px 12px;">操作人</th>
                          <th style="text-align: left; padding: 10px 12px;">开始时间</th>
                          <th style="text-align: center; padding: 10px 12px;">总计</th>
                          <th style="text-align: center; padding: 10px 12px;">成功</th>
                          <th style="text-align: center; padding: 10px 12px;">失败</th>
                          <th style="text-align: center; padding: 10px 12px;">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${this.batches.map(
                          (b) => html`
                            <tr style="border-bottom: 1px solid #f0f0f0;">
                              <td style="padding: 10px 12px; font-family: monospace; font-size: 12px;">${b.batchNo}</td>
                              <td style="padding: 10px 12px;">${b.actionLabel}</td>
                              <td style="padding: 10px 12px;">${b.operator}</td>
                              <td style="padding: 10px 12px; font-size: 12px; color: #595959;">${b.startedAt}</td>
                              <td style="padding: 10px 12px; text-align: center;">${b.itemCount}</td>
                              <td style="padding: 10px 12px; text-align: center; color: #52c41a; font-weight: 500;">${b.successCount}</td>
                              <td style="padding: 10px 12px; text-align: center; color: #f5222d; font-weight: 500;">${b.failCount}</td>
                              <td style="padding: 10px 12px; text-align: center;">
                                <button class="btn-default btn-sm" @click=${() => this._viewBatchDetail(b.batchNo)}>
                                  查看详情
                                </button>
                              </td>
                            </tr>
                          `
                        )}
                      </tbody>
                    </table>
                  `}
              <div style="margin-top: 12px; font-size: 12px; color: #8c8c8c;">
                共 ${this.batchesTotal} 条批次，按角色可见范围展示
                ${this.batches.length > 0 ? html` · 数据时间: ${this.batches[0].dataTimestamp}` : ''}
              </div>
            `}
      </div>
    `;
  }

  _renderBatchHistoryDetail() {
    const d = this.selectedBatchDetail;
    return html`
      <div>
        <div class="result-header" style="border-radius: 8px; background: white; padding: 16px 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.06); margin-bottom: 16px;">
          <div>
            <div style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">
              批次详情
              <span style="font-size: 12px; color: #8c8c8c; font-weight: normal; margin-left: 10px; font-family: monospace;">
                ${d.batchNo}
              </span>
            </div>
            <div style="font-size: 12px; color: #8c8c8c;">数据时间: ${d.dataTimestamp}</div>
          </div>
          <button class="btn-default" @click=${this._backToBatchList}>← 返回批次列表</button>
        </div>

        <div class="result-summary" style="margin-bottom: 16px;">
          <div class="summary-item">
            <div class="summary-label">总计</div>
            <div class="summary-value total">${d.total}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">成功</div>
            <div class="summary-value success">${d.successCount}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">失败</div>
            <div class="summary-value fail">${d.failCount}</div>
          </div>
        </div>

        ${this.batchDetailLoading
          ? html`<div class="loading">加载中...</div>`
          : html`
              <div class="result-list">
                ${d.items.map(
                  (item) => html`
                    <div class="result-item ${item.success ? 'success' : 'fail'}">
                      <div class="result-item-info">
                        <div class="result-item-app">
                          ${item.applicationNo}
                          ${item.nodeName
                            ? html`<span style="font-size: 11px; color: #8c8c8c; margin-left: 6px; font-weight: normal;">[${item.nodeName}]</span>`
                            : ''}
                          ${item.applicantName
                            ? html`<span style="font-size: 11px; color: #595959; margin-left: 6px; font-weight: normal;">${item.applicantName}</span>`
                            : ''}
                        </div>
                        <div class="result-item-status">
                          ${item.previousStatus}
                          ${item.success && item.newStatus && item.newStatus !== item.previousStatus
                            ? html` → ${item.newStatus}`
                            : ''}
                          ${!item.success
                            ? html`（未变更，当前: ${item.currentStatus || item.previousStatus}）`
                            : ''}
                        </div>
                      </div>
                      <div style="font-size: 12px; color: #595959; margin-bottom: 4px;">
                        操作人: ${item.operator}
                        ${item.currentHandler ? html` · 当前处理人: ${item.currentHandler}` : ''}
                        ${item.address ? html` · 地址: ${item.address}` : ''}
                      </div>
                      <div style="font-size: 12px; color: #8c8c8c; margin-bottom: 4px;">
                        处理时间: ${item.createdAt}
                        ${item.exceptionType ? html` · 异常分类: ${item.exceptionType}` : ''}
                      </div>
                      <div class="result-item-reason">${item.reason || (item.success ? '操作成功' : '-')}</div>
                      ${item.prRemark && item.prRemark !== '处理失败'
                        ? html`<div style="font-size: 12px; color: #8c8c8c; margin-top: 4px;">备注: ${item.prRemark}</div>`
                        : ''}
                    </div>
                  `
                )}
              </div>
            `}
      </div>
    `;
  }
}

customElements.define('batch-process', BatchProcess);
