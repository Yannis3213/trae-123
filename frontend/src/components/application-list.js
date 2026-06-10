import { LitElement, html, css } from 'lit';
import { api } from '../api.js';

class ApplicationList extends LitElement {
  static properties = {
    applications: { type: Array },
    total: { type: Number },
    page: { type: Number },
    pageSize: { type: Number },
    loading: { type: Boolean },
    filters: { type: Object },
    stats: { type: Object },
    selectedIds: { type: Array },
    showCreateModal: { type: Boolean },
    createForm: { type: Object },
  };

  static styles = css`
    :host {
      display: block;
    }

    .page-container {
      padding: 20px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .page-title {
      font-size: 20px;
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .stat-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }

    .stat-label {
      font-size: 13px;
      color: #8c8c8c;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: #262626;
    }

    .stat-card.warning .stat-value { color: #fa8c16; }
    .stat-card.danger .stat-value { color: #f5222d; }
    .stat-card.success .stat-value { color: #52c41a; }

    .filter-bar {
      background: white;
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
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
      padding: 6px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    .btn-primary:hover {
      background-color: #40a9ff;
    }

    .btn-default {
      background-color: white;
      color: #595959;
      padding: 6px 16px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    .btn-default:hover {
      color: #1890ff;
      border-color: #1890ff;
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
      background-color: #fafafa;
      font-weight: 600;
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #d9d9d9;
      font-size: 13px;
      color: #262626;
    }

    td {
      padding: 12px;
      border-bottom: 1px solid #f0f0f0;
      font-size: 13px;
      color: #262626;
    }

    tbody tr:hover {
      background-color: #fafafa;
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
    .status-closed { background: #f6ffed; color: #52c41a; }

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
      margin-right: 12px;
    }

    .action-link:hover {
      text-decoration: underline;
    }

    .pagination {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      padding: 16px;
    }

    .pagination button {
      min-width: 32px;
      height: 32px;
      border: 1px solid #d9d9d9;
      background: white;
      border-radius: 4px;
      cursor: pointer;
    }

    .pagination button:hover:not(:disabled) {
      color: #1890ff;
      border-color: #1890ff;
    }

    .pagination button:disabled {
      cursor: not-allowed;
      color: #bfbfbf;
    }

    .pagination .page-info {
      color: #8c8c8c;
      font-size: 13px;
      margin: 0 8px;
    }

    .batch-bar {
      background: #e6f7ff;
      padding: 10px 20px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .batch-info {
      color: #1890ff;
      font-size: 13px;
    }

    .batch-actions {
      margin-left: auto;
      display: flex;
      gap: 8px;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #8c8c8c;
    }

    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 8px;
      width: 500px;
      max-width: 90%;
    }

    .modal-header {
      padding: 16px 24px;
      border-bottom: 1px solid #d9d9d9;
      font-size: 16px;
      font-weight: 600;
    }

    .modal-body {
      padding: 24px;
    }

    .modal-footer {
      padding: 12px 24px;
      border-top: 1px solid #d9d9d9;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      color: #595959;
      font-size: 13px;
    }

    .form-group input,
    .form-group select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      font-size: 14px;
    }

    .required {
      color: #f5222d;
    }

    .material-status {
      font-size: 12px;
      color: #8c8c8c;
    }

    .material-status.returned {
      color: #f5222d;
    }
  `;

  constructor() {
    super();
    this.applications = [];
    this.total = 0;
    this.page = 1;
    this.pageSize = 10;
    this.loading = false;
    this.filters = {
      status: '',
      warning: '',
      keyword: '',
    };
    this.stats = {};
    this.selectedIds = [];
    this.showCreateModal = false;
    this.createForm = {
      applicantName: '',
      idCard: '',
      address: '',
      phone: '',
      waterUsageType: '居民用水',
    };
  }

  firstUpdated() {
    this._loadData();
    this._loadStats();
    window.addEventListener('auth-changed', () => {
      this.selectedIds = [];
      this.page = 1;
      this._loadData();
      this._loadStats();
    });
    window.addEventListener('refresh-data', () => {
      this.selectedIds = [];
      this.page = 1;
      this._loadData();
      this._loadStats();
    });
  }

  async _loadData() {
    this.loading = true;
    try {
      const data = await api.getApplications({
        page: this.page,
        pageSize: this.pageSize,
        status: this.filters.status,
        warning: this.filters.warning,
        keyword: this.filters.keyword,
      });
      this.applications = data.list;
      this.total = data.total;
    } catch (err) {
      console.error('加载列表失败:', err);
    } finally {
      this.loading = false;
    }
  }

  async _loadStats() {
    try {
      this.stats = await api.getWarningStats();
    } catch (err) {
      console.error('加载统计失败:', err);
    }
  }

  _handleFilterChange(e) {
    const { name, value } = e.target;
    this.filters = { ...this.filters, [name]: value };
    this.page = 1;
    this._loadData();
  }

  _handleSearch() {
    this.page = 1;
    this._loadData();
  }

  _handleReset() {
    this.filters = { status: '', warning: '', keyword: '' };
    this.page = 1;
    this._loadData();
  }

  _changePage(newPage) {
    if (newPage < 1 || newPage > Math.ceil(this.total / this.pageSize)) return;
    this.page = newPage;
    this._loadData();
  }

  _viewDetail(id) {
    window.dispatchEvent(new CustomEvent('navigate-to', { detail: { page: 'detail', id } }));
  }

  _toggleSelectAll(e) {
    if (e.target.checked) {
      this.selectedIds = this.applications.map((a) => a.id);
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

  _getStatusClass(status) {
    const map = {
      '待派发': 'status-pending',
      '处理中': 'status-processing',
      '已关闭': 'status-closed',
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

  _openCreateModal() {
    this.showCreateModal = true;
    this.createForm = {
      applicantName: '',
      idCard: '',
      address: '',
      phone: '',
      waterUsageType: '居民用水',
    };
  }

  _closeCreateModal() {
    this.showCreateModal = false;
  }

  _handleCreateInput(e) {
    const { name, value } = e.target;
    this.createForm = { ...this.createForm, [name]: value };
  }

  async _handleCreate() {
    if (!this.createForm.applicantName || !this.createForm.idCard || !this.createForm.address || !this.createForm.phone) {
      alert('请填写必填项');
      return;
    }

    try {
      await api.createApplication(this.createForm);
      this._closeCreateModal();
      this._loadData();
      this._loadStats();
    } catch (err) {
      alert('创建失败: ' + err.message);
    }
  }

  async _handleExport() {
    try {
      const params = {
        status: this.filters.status,
        warning: this.filters.warning,
        keyword: this.filters.keyword,
      };
      const response = await api.exportCSV(params);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = '开户申请导出.csv';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('导出失败: ' + err.message);
    }
  }

  _handleBatchDispatch() {
    if (this.selectedIds.length === 0) {
      alert('请先选择要处理的申请');
      return;
    }
    window.dispatchEvent(new CustomEvent('navigate-to', { detail: { page: 'batch' } }));
  }

  render() {
    const totalPages = Math.ceil(this.total / this.pageSize);

    return html`
      <div class="page-container">
        <div class="page-header">
          <div class="page-title">开户申请列表</div>
          <div class="header-actions">
            <button class="btn-default" @click=${this._handleExport}>导出CSV</button>
            <button class="btn-primary" @click=${this._openCreateModal}>新建开户申请</button>
          </div>
        </div>

        <div class="stat-cards">
          <div class="stat-card">
            <div class="stat-label">全部申请</div>
            <div class="stat-value">${this.stats.total || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">待派发</div>
            <div class="stat-value">${this.stats.pending || 0}</div>
          </div>
          <div class="stat-card warning">
            <div class="stat-label">临期（3天内）</div>
            <div class="stat-value">${this.stats.warning || 0}</div>
          </div>
          <div class="stat-card danger">
            <div class="stat-label">已逾期</div>
            <div class="stat-value">${this.stats.overdue || 0}</div>
          </div>
        </div>

        <div class="filter-bar">
          <div class="filter-item">
            <label>状态:</label>
            <select name="status" .value=${this.filters.status} @change=${this._handleFilterChange}>
              <option value="">全部状态</option>
              <option value="待派发">待派发</option>
              <option value="处理中">处理中</option>
              <option value="已关闭">已关闭</option>
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
          <button class="btn-default" @click=${this._handleReset}>重置</button>
        </div>

        ${this.selectedIds.length > 0
          ? html`
              <div class="batch-bar">
                <span class="batch-info">已选择 ${this.selectedIds.length} 条记录</span>
                <div class="batch-actions">
                  <button class="btn-default" @click=${() => (this.selectedIds = [])}>取消选择</button>
                  <button class="btn-primary" @click=${this._handleBatchDispatch}>去批量处理</button>
                </div>
              </div>
            `
          : ''}

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
                          .checked=${this.selectedIds.length === this.applications.length && this.applications.length > 0}
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
                      <th>创建时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.applications.length === 0
                      ? html`
                          <tr>
                            <td colspan="11" style="text-align: center; color: #8c8c8c; padding: 40px;">
                              暂无数据
                            </td>
                          </tr>
                        `
                      : this.applications.map(
                          (app) => html`
                            <tr>
                              <td>
                                <input
                                  type="checkbox"
                                  .checked=${this._isSelected(app.id)}
                                  @change=${(e) => this._toggleSelect(app.id, e)}
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
                              <td>
                                <span class="material-status ${app.materialStatus === '退回补正' ? 'returned' : ''}">
                                  ${app.materialStatus || '-'}
                                </span>
                              </td>
                              <td>${app.dueDate || '-'}</td>
                              <td>
                                <span class="warning-tag ${this._getWarningClass(app.warningLevel)}">
                                  ${this._getWarningLabel(app.warningLevel)}
                                </span>
                              </td>
                              <td>${app.currentHandler || '-'}</td>
                              <td>${app.createdAt}</td>
                              <td>
                                <span class="action-link" @click=${() => this._viewDetail(app.id)}>
                                  查看详情
                                </span>
                              </td>
                            </tr>
                          `
                        )}
                  </tbody>
                </table>
              `}

          <div class="pagination">
            <button @click=${() => this._changePage(1)} ?disabled=${this.page === 1}>首页</button>
            <button @click=${() => this._changePage(this.page - 1)} ?disabled=${this.page === 1}>
              上一页
            </button>
            <span class="page-info">
              第 ${this.page} / ${totalPages || 1} 页，共 ${this.total} 条
            </span>
            <button @click=${() => this._changePage(this.page + 1)} ?disabled=${this.page >= totalPages}>
              下一页
            </button>
            <button @click=${() => this._changePage(totalPages)} ?disabled=${this.page >= totalPages}>
              末页
            </button>
          </div>
        </div>
      </div>

      ${this.showCreateModal
        ? html`
            <div class="modal-overlay" @click=${(e) => e.target === e.currentTarget && this._closeCreateModal()}>
              <div class="modal-content">
                <div class="modal-header">新建开户申请</div>
                <div class="modal-body">
                  <div class="form-group">
                    <label><span class="required">*</span> 申请人姓名</label>
                    <input
                      type="text"
                      name="applicantName"
                      .value=${this.createForm.applicantName}
                      @input=${this._handleCreateInput}
                      placeholder="请输入申请人姓名"
                    />
                  </div>
                  <div class="form-group">
                    <label><span class="required">*</span> 身份证号</label>
                    <input
                      type="text"
                      name="idCard"
                      .value=${this.createForm.idCard}
                      @input=${this._handleCreateInput}
                      placeholder="请输入身份证号"
                    />
                  </div>
                  <div class="form-group">
                    <label><span class="required">*</span> 安装地址</label>
                    <input
                      type="text"
                      name="address"
                      .value=${this.createForm.address}
                      @input=${this._handleCreateInput}
                      placeholder="请输入安装地址"
                    />
                  </div>
                  <div class="form-group">
                    <label><span class="required">*</span> 联系电话</label>
                    <input
                      type="text"
                      name="phone"
                      .value=${this.createForm.phone}
                      @input=${this._handleCreateInput}
                      placeholder="请输入联系电话"
                    />
                  </div>
                  <div class="form-group">
                    <label>用水性质</label>
                    <select name="waterUsageType" .value=${this.createForm.waterUsageType} @change=${this._handleCreateInput}>
                      <option value="居民用水">居民用水</option>
                      <option value="商业用水">商业用水</option>
                      <option value="工业用水">工业用水</option>
                    </select>
                  </div>
                </div>
                <div class="modal-footer">
                  <button class="btn-default" @click=${this._closeCreateModal}>取消</button>
                  <button class="btn-primary" @click=${this._handleCreate}>提交</button>
                </div>
              </div>
            </div>
          `
        : ''}
    `;
  }
}

customElements.define('application-list', ApplicationList);
