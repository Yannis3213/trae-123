import { LitElement, html, css } from 'lit';
import { api } from '../api.js';

class ApplicationDetail extends LitElement {
  static properties = {
    applicationId: { type: String },
    application: { type: Object },
    loading: { type: Boolean },
    auditLogs: { type: Array },
    currentUser: { type: Object },
    showActionModal: { type: Boolean },
    currentAction: { type: String },
    actionForm: { type: Object },
    error: { type: String },
    activeTab: { type: String },
    showRemarkModal: { type: Boolean },
    newRemark: { type: String },
  };

  static styles = css`
    :host { display: block; }

    .detail-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .back-btn {
      color: #1890ff;
      cursor: pointer;
      margin-bottom: 16px;
      display: inline-block;
    }

    .detail-header {
      background: white;
      padding: 20px 24px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }

    .header-info h2 {
      font-size: 18px;
      margin-bottom: 8px;
    }

    .header-meta {
      display: flex;
      gap: 24px;
      color: #8c8c8c;
      font-size: 13px;
    }

    .status-tag {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
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
      margin-left: 8px;
    }

    .warning-normal { background: #f6ffed; color: #52c41a; }
    .warning-warning { background: #fff7e6; color: #fa8c16; }
    .warning-overdue { background: #fff1f0; color: #f5222d; }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .btn-primary {
      background-color: #1890ff;
      color: white;
      padding: 6px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .btn-primary:hover { background-color: #40a9ff; }

    .btn-default {
      background-color: white;
      color: #595959;
      padding: 6px 16px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      cursor: pointer;
    }

    .btn-default:hover {
      color: #1890ff;
      border-color: #1890ff;
    }

    .btn-danger {
      background-color: #ff4d4f;
      color: white;
      padding: 6px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .btn-danger:hover { background-color: #ff7875; }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .detail-card {
      background: white;
      border-radius: 8px;
      margin-bottom: 16px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }

    .card-header {
      padding: 16px 24px;
      border-bottom: 1px solid #f0f0f0;
      font-weight: 600;
      font-size: 15px;
    }

    .card-body {
      padding: 20px 24px;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px 32px;
    }

    .detail-item {
      display: flex;
    }

    .detail-item .label {
      color: #8c8c8c;
      min-width: 100px;
      flex-shrink: 0;
    }

    .detail-item .value {
      color: #262626;
      flex: 1;
    }

    .exception-box {
      background: #fff1f0;
      border: 1px solid #ffa39e;
      border-radius: 4px;
      padding: 12px 16px;
      margin-top: 12px;
      color: #cf1322;
      font-size: 13px;
    }

    .exception-box .exc-title {
      font-weight: 600;
      margin-bottom: 4px;
    }

    .timeline {
      position: relative;
      padding-left: 24px;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 6px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #e8e8e8;
    }

    .timeline-item {
      position: relative;
      padding-bottom: 24px;
    }

    .timeline-item:last-child { padding-bottom: 0; }

    .timeline-item::before {
      content: '';
      position: absolute;
      left: -22px;
      top: 4px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #1890ff;
      border: 2px solid white;
      box-shadow: 0 0 0 2px #1890ff;
    }

    .timeline-time {
      color: #8c8c8c;
      font-size: 12px;
      margin-bottom: 4px;
    }

    .timeline-title {
      font-weight: 500;
      color: #262626;
      margin-bottom: 4px;
    }

    .timeline-desc {
      color: #595959;
      font-size: 13px;
    }

    .timeline-exception {
      color: #f5222d;
      font-size: 13px;
      margin-top: 6px;
      padding: 6px 10px;
      background: #fff1f0;
      border-radius: 4px;
      display: inline-block;
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
      width: 480px;
      max-width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-header {
      padding: 16px 24px;
      border-bottom: 1px solid #d9d9d9;
      font-size: 16px;
      font-weight: 600;
    }

    .modal-body { padding: 24px; }
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
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      font-size: 14px;
    }

    .form-group textarea {
      resize: vertical;
      min-height: 80px;
    }

    .required { color: #f5222d; }

    .error-msg {
      color: #f5222d;
      font-size: 13px;
      margin-bottom: 12px;
      padding: 8px 12px;
      background: #fff1f0;
      border-radius: 4px;
    }

    .loading {
      text-align: center;
      padding: 60px;
      color: #8c8c8c;
    }

    .tabs {
      display: flex;
      border-bottom: 1px solid #d9d9d9;
      margin-bottom: 20px;
      background: white;
      border-radius: 8px 8px 0 0;
      padding: 0 24px;
    }

    .tab-item {
      padding: 14px 20px;
      cursor: pointer;
      color: #595959;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
    }

    .tab-item.active {
      color: #1890ff;
      border-bottom-color: #1890ff;
      font-weight: 500;
    }

    .material-section {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .material-item {
      padding: 12px 16px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      background: #fafafa;
    }

    .material-name {
      font-weight: 500;
      margin-bottom: 4px;
    }

    .material-status {
      font-size: 12px;
      color: #8c8c8c;
    }

    .material-status.returned { color: #f5222d; }
  `;

  constructor() {
    super();
    this.application = null;
    this.loading = false;
    this.auditLogs = [];
    this.currentUser = null;
    this.showActionModal = false;
    this.currentAction = '';
    this.actionForm = {};
    this.error = '';
    this.activeTab = 'info';
    this.showRemarkModal = false;
    this.newRemark = '';
  }

  firstUpdated() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }
    window.addEventListener('auth-changed', (e) => {
      this.currentUser = e.detail.user;
      this._loadDetail();
    });
    window.addEventListener('refresh-data', () => {
      this._loadDetail();
    });
    this._loadDetail();
  }

  updated(changedProps) {
    if (changedProps.has('applicationId') && this.applicationId) {
      this._loadDetail();
    }
  }

  async _loadDetail() {
    if (!this.applicationId) return;
    this.loading = true;
    try {
      this.application = await api.getApplicationDetail(this.applicationId);
      const logsData = await api.getAuditLogs(this.applicationId);
      this.auditLogs = logsData.logs || [];
    } catch (err) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  }

  _goBack() {
    window.dispatchEvent(new CustomEvent('navigate-to', { detail: { page: 'list' } }));
  }

  _getStatusClass(status) {
    const map = {
      '待派发': 'status-pending',
      '处理中': 'status-processing',
      '已关闭': 'status-closed',
    };
    return map[status] || '';
  }

  _getWarningLevel() {
    if (!this.application?.dueDate) return 'normal';
    const due = new Date(this.application.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 3) return 'warning';
    return 'normal';
  }

  _getWarningLabel(level) {
    const map = { normal: '正常', warning: '临期', overdue: '逾期' };
    return map[level] || '';
  }

  _getWarningClass(level) {
    const map = {
      normal: 'warning-normal',
      warning: 'warning-warning',
      overdue: 'warning-overdue',
    };
    return map[level] || '';
  }

  _canPerformAction(action) {
    if (!this.application || !this.currentUser) return false;
    const { status, currentHandlerId } = this.application;
    const role = this.currentUser.role;

    switch (action) {
      case 'dispatch':
        return role === 'meter_supervisor' && status === '待派发';
      case 'material_review':
        return role === 'meter_supervisor' && status === '处理中' && currentHandlerId === this.currentUser.id;
      case 'meter_install':
        return role === 'meter_supervisor' && status === '处理中' && currentHandlerId === this.currentUser.id;
      case 'review_close':
        return role === 'business_manager' && status === '处理中';
      case 'return_correct':
        return role === 'business_manager' && status === '处理中';
      default:
        return false;
    }
  }

  _openActionModal(action) {
    this.currentAction = action;
    this.actionForm = {
      handlerId: '',
      materialStatus: '审核通过',
      exceptionReason: '',
      meterNo: '',
      installationAddr: this.application?.address || '',
      remark: '',
    };
    this.error = '';
    this.showActionModal = true;
  }

  _closeActionModal() {
    this.showActionModal = false;
    this.currentAction = '';
  }

  _handleFormInput(e) {
    const { name, value } = e.target;
    this.actionForm = { ...this.actionForm, [name]: value };
  }

  async _handleActionSubmit() {
    this.error = '';

    if (this.currentAction === 'dispatch' && !this.actionForm.handlerId) {
      this.error = '请选择处理人';
      return;
    }

    if (this.currentAction === 'material_review' && this.actionForm.materialStatus === '退回补正' && !this.actionForm.exceptionReason) {
      this.error = '退回补正必须填写异常原因';
      return;
    }

    if (this.currentAction === 'meter_install' && !this.actionForm.meterNo) {
      this.error = '请填写水表编号';
      return;
    }

    if (this.currentAction === 'return_correct') {
      if (!this.actionForm.exceptionReason) {
        this.error = '请填写异常原因';
        return;
      }
      if (!this.actionForm.handlerId) {
        this.error = '请指定补正处理人';
        return;
      }
    }

    try {
      const data = {
        action: this.currentAction,
        version: this.application.version,
        targetStatus: this.application.status,
        ...this.actionForm,
      };

      await api.updateApplicationStatus(this.applicationId, data);
      this._closeActionModal();
      this._loadDetail();
    } catch (err) {
      this.error = err.message;
    }
  }

  _getActionLabel(action) {
    const map = {
      dispatch: '派发申请',
      material_review: '资料审核',
      meter_install: '装表派工',
      review_close: '复核关闭',
      return_correct: '退回补正',
    };
    return map[action] || action;
  }

  render() {
    const warningLevel = this._getWarningLevel();

    return html`
      <div class="detail-container">
        <div class="back-btn" @click=${this._goBack}>← 返回列表</div>

        ${this.loading
          ? html`<div class="loading">加载中...</div>`
          : this.error
          ? html`<div class="error-msg">${this.error}</div>`
          : this.application
          ? html`
              <div class="detail-header">
                <div class="header-info">
                  <h2>
                    ${this.application.applicationNo}
                    <span class="status-tag ${this._getStatusClass(this.application.status)}">
                      ${this.application.status}
                    </span>
                    <span class="warning-tag ${this._getWarningClass(warningLevel)}">
                      ${this._getWarningLabel(warningLevel)}
                    </span>
                  </h2>
                  <div class="header-meta">
                    <span>申请人：${this.application.applicantName}</span>
                    <span>当前处理人：${this.application.currentHandler || '未指派'}</span>
                    <span>到期日期：${this.application.dueDate || '-'}</span>
                    <span>版本：v${this.application.version}</span>
                  </div>
                </div>
                <div class="header-actions">
                  ${this._canPerformAction('dispatch')
                    ? html`<button class="btn-primary" @click=${() => this._openActionModal('dispatch')}>派发</button>`
                    : ''}
                  ${this._canPerformAction('material_review')
                    ? html`<button class="btn-primary" @click=${() => this._openActionModal('material_review')}>资料审核</button>`
                    : ''}
                  ${this._canPerformAction('meter_install')
                    ? html`<button class="btn-primary" @click=${() => this._openActionModal('meter_install')}>装表派工</button>`
                    : ''}
                  ${this._canPerformAction('review_close')
                    ? html`<button class="btn-primary" @click=${() => this._openActionModal('review_close')}>复核关闭</button>`
                    : ''}
                  ${this._canPerformAction('return_correct')
                    ? html`<button class="btn-danger" @click=${() => this._openActionModal('return_correct')}>退回补正</button>`
                    : ''}
                </div>
              </div>

              ${this.application.exceptionReason
                ? html`
                    <div class="detail-card">
                      <div class="card-body">
                        <div class="exception-box">
                          <div class="exc-title">⚠ 异常原因</div>
                          <div>${this.application.exceptionReason}</div>
                        </div>
                      </div>
                    </div>
                  `
                : ''}

              <div class="tabs">
                <div class="tab-item ${this.activeTab === 'info' ? 'active' : ''}" @click=${() => (this.activeTab = 'info')}>
                  基本信息
                </div>
                <div class="tab-item ${this.activeTab === 'material' ? 'active' : ''}" @click=${() => (this.activeTab = 'material')}>
                  资料审核
                </div>
                <div class="tab-item ${this.activeTab === 'meter' ? 'active' : ''}" @click=${() => (this.activeTab = 'meter')}>
                  装表派工
                </div>
                <div class="tab-item ${this.activeTab === 'audit' ? 'active' : ''}" @click=${() => (this.activeTab = 'audit')}>
                  审计轨迹
                </div>
              </div>

              ${this.activeTab === 'info'
                ? html`
                    <div class="detail-card">
                      <div class="card-header">用户开户</div>
                      <div class="card-body">
                        <div class="detail-grid">
                          <div class="detail-item">
                            <span class="label">申请编号</span>
                            <span class="value">${this.application.applicationNo}</span>
                          </div>
                          <div class="detail-item">
                            <span class="label">申请人</span>
                            <span class="value">${this.application.applicantName}</span>
                          </div>
                          <div class="detail-item">
                            <span class="label">身份证号</span>
                            <span class="value">${this.application.idCard}</span>
                          </div>
                          <div class="detail-item">
                            <span class="label">联系电话</span>
                            <span class="value">${this.application.phone}</span>
                          </div>
                          <div class="detail-item">
                            <span class="label">安装地址</span>
                            <span class="value">${this.application.address}</span>
                          </div>
                          <div class="detail-item">
                            <span class="label">用水性质</span>
                            <span class="value">${this.application.waterUsageType}</span>
                          </div>
                          <div class="detail-item">
                            <span class="label">创建人</span>
                            <span class="value">${this.application.creatorName}</span>
                          </div>
                          <div class="detail-item">
                            <span class="label">创建时间</span>
                            <span class="value">${this.application.createdAt}</span>
                          </div>
                          <div class="detail-item">
                            <span class="label">当前处理人</span>
                            <span class="value">${this.application.currentHandler || '未指派'}</span>
                          </div>
                          <div class="detail-item">
                            <span class="label">到期日期</span>
                            <span class="value">${this.application.dueDate || '-'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  `
                : ''}

              ${this.activeTab === 'material'
                ? html`
                    <div class="detail-card">
                      <div class="card-header">资料审核</div>
                      <div class="card-body">
                        <div class="detail-grid">
                          <div class="detail-item">
                            <span class="label">资料状态</span>
                            <span class="value">${this.application.materialStatus || '待审核'}</span>
                          </div>
                          <div class="detail-item">
                            <span class="label">当前处理人</span>
                            <span class="value">${this.application.currentHandler || '未指派'}</span>
                          </div>
                        </div>

                        <div style="margin-top: 20px;">
                          <div style="font-weight: 500; margin-bottom: 12px;">资料清单</div>
                          <div class="material-section">
                            <div class="material-item">
                              <div class="material-name">身份证</div>
                              <div class="material-status">已提交</div>
                            </div>
                            <div class="material-item">
                              <div class="material-name">房产证</div>
                              <div class="material-status ${this.application.materialStatus === '退回补正' ? 'returned' : ''}">
                                ${this.application.materialStatus === '退回补正' ? '待补正' : '已提交'}
                              </div>
                            </div>
                            <div class="material-item">
                              <div class="material-name">用水申请书</div>
                              <div class="material-status">已提交</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  `
                : ''}

              ${this.activeTab === 'meter'
                ? html`
                    <div class="detail-card">
                      <div class="card-header">装表派工</div>
                      <div class="card-body">
                        <div class="detail-grid">
                          <div class="detail-item">
                            <span class="label">水表编号</span>
                            <span class="value">${this.application.meterNo || '未分配'}</span>
                          </div>
                          <div class="detail-item">
                            <span class="label">安装地址</span>
                            <span class="value">${this.application.installationAddr || this.application.address}</span>
                          </div>
                          <div class="detail-item">
                            <span class="label">装表状态</span>
                            <span class="value">${this.application.meterNo ? '已派工' : '待派工'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  `
                : ''}

              ${this.activeTab === 'audit'
                ? html`
                    <div class="detail-card">
                      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>处理记录与审计轨迹</span>
                        <button class="btn-default btn-sm" @click=${() => (this.showRemarkModal = true)}>
                          + 添加备注
                        </button>
                      </div>
                      <div class="card-body">
                        <div style="margin-bottom: 20px;">
                          <div style="font-weight: 500; margin-bottom: 12px; color: #262626;">处理记录</div>
                          <div class="timeline">
                            ${this.auditLogs.length === 0
                              ? html`<div style="color: #8c8c8c;">暂无处理记录</div>`
                              : this.auditLogs.map(
                                  (log) => html`
                                    <div class="timeline-item">
                                      <div class="timeline-time">${log.createdAt}</div>
                                      <div class="timeline-title">
                                        ${log.nodeName} - ${log.operator}
                                        <span style="font-size: 12px; color: #8c8c8c; font-weight: normal;">
                                          (${log.previousStatus} → ${log.newStatus})
                                        </span>
                                      </div>
                                      <div class="timeline-desc">${log.remark || '无备注'}</div>
                                      ${log.exceptionReason
                                        ? html`<div class="timeline-exception">异常: ${log.exceptionReason}</div>`
                                        : ''}
                                    </div>
                                  `
                                )}
                          </div>
                        </div>

                        <div style="border-top: 1px solid #f0f0f0; padding-top: 20px;">
                          <div style="font-weight: 500; margin-bottom: 12px; color: #262626;">审计备注</div>
                          ${!this.application.auditRemarks || this.application.auditRemarks.length === 0
                            ? html`<div style="color: #8c8c8c;">暂无审计备注</div>`
                            : this.application.auditRemarks.map(
                                (remark) => html`
                                  <div style="padding: 12px; background: #fafafa; border-radius: 6px; margin-bottom: 8px;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                      <span style="font-weight: 500; color: #262626;">${remark.operator}</span>
                                      <span style="font-size: 12px; color: #8c8c8c;">${remark.createdAt}</span>
                                    </div>
                                    <div style="color: #595959; font-size: 13px;">${remark.remark}</div>
                                  </div>
                                `
                              )}
                        </div>
                      </div>
                    </div>
                  `
                : ''}
            `
          : ''}
      </div>

      ${this.showActionModal
        ? html`
            <div class="modal-overlay" @click=${(e) => e.target === e.currentTarget && this._closeActionModal()}>
              <div class="modal-content">
                <div class="modal-header">${this._getActionLabel(this.currentAction)}</div>
                <div class="modal-body">
                  ${this.error ? html`<div class="error-msg">${this.error}</div>` : ''}

                  ${this.currentAction === 'dispatch'
                    ? html`
                        <div class="form-group">
                          <label><span class="required">*</span> 指定处理人</label>
                          <select name="handlerId" .value=${this.actionForm.handlerId} @change=${this._handleFormInput}>
                            <option value="">请选择</option>
                            <option value="u003">王主管（抄表主管）</option>
                            <option value="u004">赵抄表（抄表主管）</option>
                          </select>
                        </div>
                        <div class="form-group">
                          <label>备注</label>
                          <textarea name="remark" .value=${this.actionForm.remark} @input=${this._handleFormInput} placeholder="请输入备注信息"></textarea>
                        </div>
                      `
                    : ''}

                  ${this.currentAction === 'material_review'
                    ? html`
                        <div class="form-group">
                          <label><span class="required">*</span> 审核结果</label>
                          <select name="materialStatus" .value=${this.actionForm.materialStatus} @change=${this._handleFormInput}>
                            <option value="审核通过">审核通过</option>
                            <option value="退回补正">退回补正</option>
                          </select>
                        </div>
                        ${this.actionForm.materialStatus === '退回补正'
                          ? html`
                              <div class="form-group">
                                <label><span class="required">*</span> 异常原因</label>
                                <textarea name="exceptionReason" .value=${this.actionForm.exceptionReason} @input=${this._handleFormInput} placeholder="请详细说明退回原因"></textarea>
                              </div>
                            `
                          : ''}
                        <div class="form-group">
                          <label>备注</label>
                          <textarea name="remark" .value=${this.actionForm.remark} @input=${this._handleFormInput} placeholder="请输入审核备注"></textarea>
                        </div>
                      `
                    : ''}

                  ${this.currentAction === 'meter_install'
                    ? html`
                        <div class="form-group">
                          <label><span class="required">*</span> 水表编号</label>
                          <input type="text" name="meterNo" .value=${this.actionForm.meterNo} @input=${this._handleFormInput} placeholder="请输入水表编号" />
                        </div>
                        <div class="form-group">
                          <label>安装地址</label>
                          <input type="text" name="installationAddr" .value=${this.actionForm.installationAddr} @input=${this._handleFormInput} placeholder="请输入安装地址" />
                        </div>
                        <div class="form-group">
                          <label>备注</label>
                          <textarea name="remark" .value=${this.actionForm.remark} @input=${this._handleFormInput} placeholder="请输入装表备注"></textarea>
                        </div>
                      `
                    : ''}

                  ${this.currentAction === 'review_close'
                    ? html`
                        <div class="form-group">
                          <label>复核意见</label>
                          <textarea name="remark" .value=${this.actionForm.remark} @input=${this._handleFormInput} placeholder="请输入复核意见"></textarea>
                        </div>
                        <div style="color: #faad14; font-size: 13px;">
                          复核通过后，申请将变为"已关闭"状态，无法继续操作。
                        </div>
                      `
                    : ''}

                  ${this.currentAction === 'return_correct'
                    ? html`
                        <div class="form-group">
                          <label><span class="required">*</span> 异常原因</label>
                          <textarea name="exceptionReason" .value=${this.actionForm.exceptionReason} @input=${this._handleFormInput} placeholder="请详细说明退回原因"></textarea>
                        </div>
                        <div class="form-group">
                          <label><span class="required">*</span> 补正处理人</label>
                          <select name="handlerId" .value=${this.actionForm.handlerId} @change=${this._handleFormInput}>
                            <option value="">请选择</option>
                            <option value="u003">王主管（抄表主管）</option>
                            <option value="u004">赵抄表（抄表主管）</option>
                          </select>
                        </div>
                        <div class="form-group">
                          <label>备注</label>
                          <textarea name="remark" .value=${this.actionForm.remark} @input=${this._handleFormInput} placeholder="请输入备注信息"></textarea>
                        </div>
                      `
                    : ''}
                </div>
                <div class="modal-footer">
                  <button class="btn-default" @click=${this._closeActionModal}>取消</button>
                  <button class="btn-primary" @click=${this._handleActionSubmit}>确认</button>
                </div>
              </div>
            </div>
          `
        : ''}

      ${this.showRemarkModal
        ? html`
            <div class="modal-overlay" @click=${(e) => e.target === e.currentTarget && (this.showRemarkModal = false)}>
              <div class="modal-content">
                <div class="modal-header">添加审计备注</div>
                <div class="modal-body">
                  ${this.error ? html`<div class="error-msg">${this.error}</div>` : ''}
                  <div class="form-group">
                    <label><span class="required">*</span> 备注内容</label>
                    <textarea
                      .value=${this.newRemark}
                      @input=${(e) => (this.newRemark = e.target.value)}
                      placeholder="请输入备注内容"
                      rows="4"
                    ></textarea>
                  </div>
                  <div style="font-size: 12px; color: #8c8c8c;">
                    备注将公开显示，所有可见该申请的人员都能看到。
                  </div>
                </div>
                <div class="modal-footer">
                  <button class="btn-default" @click=${() => { this.showRemarkModal = false; this.newRemark = ''; }}>取消</button>
                  <button class="btn-primary" @click=${this._handleAddRemark} ?disabled=${!this.newRemark.trim()}>
                    添加
                  </button>
                </div>
              </div>
            </div>
          `
        : ''}
    `;
  }

  async _handleAddRemark() {
    if (!this.newRemark.trim()) return;
    this.error = '';
    try {
      await api.addRemark(this.applicationId, this.newRemark.trim());
      this.showRemarkModal = false;
      this.newRemark = '';
      this._loadDetail();
    } catch (err) {
      this.error = err.message;
    }
  }
}

customElements.define('application-detail', ApplicationDetail);
