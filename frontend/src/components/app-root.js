import { LitElement, html, css } from 'lit';
import { api } from './api.js';

class AppRoot extends LitElement {
  static properties = {
    isLoggedIn: { type: Boolean },
    currentUser: { type: Object },
    currentPage: { type: String },
    selectedAppId: { type: String },
  };

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
    }

    .app-layout {
      display: flex;
      min-height: 100vh;
    }

    .sidebar {
      width: 220px;
      background-color: #001529;
      color: white;
      padding: 20px 0;
    }

    .sidebar-title {
      font-size: 16px;
      font-weight: 600;
      padding: 0 20px 20px;
      border-bottom: 1px solid #333;
      margin-bottom: 12px;
    }

    .sidebar-menu {
      list-style: none;
    }

    .menu-item {
      padding: 12px 20px;
      cursor: pointer;
      transition: background-color 0.2s;
      color: rgba(255, 255, 255, 0.75);
    }

    .menu-item:hover {
      background-color: #1890ff;
      color: white;
    }

    .menu-item.active {
      background-color: #1890ff;
      color: white;
    }

    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .app-header {
      background-color: white;
      padding: 12px 24px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-title {
      font-size: 18px;
      font-weight: 600;
    }

    .header-user {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .user-info {
      text-align: right;
    }

    .user-name {
      font-weight: 500;
    }

    .user-role {
      font-size: 12px;
      color: #8c8c8c;
    }

    .logout-btn {
      background: none;
      color: #595959;
      border: 1px solid #d9d9d9;
      padding: 4px 12px;
      font-size: 12px;
    }

    .logout-btn:hover {
      color: #1890ff;
      border-color: #1890ff;
    }

    .content-area {
      flex: 1;
      overflow-y: auto;
    }

    .role-switcher {
      margin-top: 20px;
      padding: 0 20px;
      border-top: 1px solid #333;
      padding-top: 16px;
    }

    .role-switcher-title {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 8px;
    }

    .role-select {
      width: 100%;
      padding: 6px 8px;
      font-size: 12px;
      border-radius: 4px;
      border: 1px solid #444;
      background-color: #002140;
      color: white;
    }
  `;

  constructor() {
    super();
    this.isLoggedIn = false;
    this.currentUser = null;
    this.currentPage = 'list';
    this.selectedAppId = null;
  }

  firstUpdated() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        this.currentUser = JSON.parse(userStr);
        this.isLoggedIn = true;
      } catch (e) {
        this._clearAuth();
      }
    }

    window.addEventListener('auth-login', (e) => {
      this.currentUser = e.detail.user;
      this.isLoggedIn = true;
    });

    window.addEventListener('auth-logout', () => {
      this._clearAuth();
    });

    window.addEventListener('navigate-to', (e) => {
      this.currentPage = e.detail.page;
      this.selectedAppId = e.detail.id || null;
    });
  }

  _clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.isLoggedIn = false;
    this.currentUser = null;
    this.currentPage = 'list';
    this.selectedAppId = null;
  }

  _handleLogout() {
    this._clearAuth();
  }

  _handleRoleSwitch(e) {
    const role = e.target.value;
    const roleAccounts = {
      window_staff: { username: 'window1', password: '123456' },
      meter_supervisor: { username: 'meter1', password: '123456' },
      business_manager: { username: 'manager1', password: '123456' },
    };

    const account = roleAccounts[role];
    if (account) {
      api.login(account.username, account.password).then((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        this.currentUser = data.user;
        window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user: data.user } }));
      }).catch((err) => {
        alert('切换角色失败: ' + err.message);
      });
    }
  }

  _getRoleLabel(role) {
    const labels = {
      window_staff: '窗口人员',
      meter_supervisor: '抄表主管',
      business_manager: '营业经理',
    };
    return labels[role] || role;
  }

  _navigateTo(page, id = null) {
    this.currentPage = page;
    this.selectedAppId = id;
  }

  render() {
    if (!this.isLoggedIn) {
      return html`<login-page></login-page>`;
    }

    return html`
      <div class="app-layout">
        <aside class="sidebar">
          <div class="sidebar-title">水务营业厅</div>
          <ul class="sidebar-menu">
            <li
              class="menu-item ${this.currentPage === 'list' ? 'active' : ''}"
              @click=${() => this._navigateTo('list')}
            >
              开户申请列表
            </li>
            <li
              class="menu-item ${this.currentPage === 'warning' ? 'active' : ''}"
              @click=${() => this._navigateTo('warning')}
            >
              到期预警
            </li>
            <li
              class="menu-item ${this.currentPage === 'batch' ? 'active' : ''}"
              @click=${() => this._navigateTo('batch')}
            >
              批量处理
            </li>
          </ul>
          <div class="role-switcher">
            <div class="role-switcher-title">快速切换角色</div>
            <select class="role-select" @change=${this._handleRoleSwitch} .value=${this.currentUser?.role}>
              <option value="window_staff">窗口人员</option>
              <option value="meter_supervisor">抄表主管</option>
              <option value="business_manager">营业经理</option>
            </select>
          </div>
        </aside>

        <div class="main-content">
          <header class="app-header">
            <div class="header-title">
              ${this.currentPage === 'list' ? '开户申请列表' : ''}
              ${this.currentPage === 'detail' ? '开户申请详情' : ''}
              ${this.currentPage === 'warning' ? '到期预警' : ''}
              ${this.currentPage === 'batch' ? '批量处理' : ''}
            </div>
            <div class="header-user">
              <div class="user-info">
                <div class="user-name">${this.currentUser?.realName}</div>
                <div class="user-role">${this._getRoleLabel(this.currentUser?.role)}</div>
              </div>
              <button class="logout-btn" @click=${this._handleLogout}>退出</button>
            </div>
          </header>

          <div class="content-area">
            ${this.currentPage === 'list' ? html`<application-list></application-list>` : ''}
            ${this.currentPage === 'detail' && this.selectedAppId
              ? html`<application-detail .applicationId=${this.selectedAppId}></application-detail>`
              : ''}
            ${this.currentPage === 'warning' ? html`<warning-board></warning-board>` : ''}
            ${this.currentPage === 'batch' ? html`<batch-process></batch-process>` : ''}
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('app-root', AppRoot);
