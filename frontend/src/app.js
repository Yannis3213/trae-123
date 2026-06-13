import { LitElement, css, html } from 'lit';
import { api, setAuth, clearAuth, getAuthUser } from './api.js';
import { ROLE_MAP, STATUS_MAP, formatDate, formatShortDate, daysUntil } from './utils.js';

import './views/login-view.js';
import './views/dashboard-view.js';
import './views/list-view.js';
import './views/detail-view.js';
import './views/create-view.js';
import './views/warnings-view.js';

class CareApp extends LitElement {
  static properties = {
    user: { type: Object },
    route: { type: Object },
    stats: { type: Object },
    _loading: { state: true, type: Boolean },
    _message: { state: true, type: Object },
  };

  constructor() {
    super();
    this.user = null;
    this.route = { name: 'login' };
    this.stats = null;
    this._loading = false;
    this._message = null;
  }

  connectedCallback() {
    super.connectedCallback();
    const u = getAuthUser();
    if (u) {
      this.user = u;
      this.route = { name: 'dashboard' };
      this.loadStats();
    }
    window.addEventListener('hashchange', () => this._parseHash());
    this._parseHash();
  }

  _parseHash() {
    if (!this.user) return;
    const h = location.hash.replace(/^#\/?/, '');
    if (!h) {
      this.route = { name: 'dashboard' };
      return;
    }
    const [name, ...rest] = h.split('/');
    if (name === 'record' && rest[0]) {
      this.route = { name: 'record-detail', id: parseInt(rest[0], 10) };
    } else if (name === 'create') {
      this.route = { name: 'create' };
    } else if (name === 'list') {
      this.route = { name: 'list', module: rest[0] || '' };
    } else if (name === 'warnings') {
      this.route = { name: 'warnings' };
    } else if (name === 'dashboard') {
      this.route = { name: 'dashboard' };
    } else {
      this.route = { name: 'dashboard' };
    }
  }

  navigate(path) {
    location.hash = path;
  }

  showMessage(type, text, duration = 3000) {
    this._message = { type, text, t: Date.now() };
    if (duration > 0) {
      setTimeout(() => {
        if (this._message && Date.now() - this._message.t >= duration - 100) {
          this._message = null;
        }
      }, duration);
    }
  }

  async loadStats() {
    try {
      this.stats = await api.stats();
    } catch (e) {
      // ignore
    }
  }

  async handleLogin(username, password) {
    this._loading = true;
    try {
      const result = await api.login(username, password);
      setAuth(result.token, result.user);
      this.user = result.user;
      this.route = { name: 'dashboard' };
      location.hash = '/dashboard';
      this.loadStats();
      this.showMessage('success', `欢迎回来，${result.user.full_name}`);
    } catch (e) {
      this.showMessage('error', e.message);
    } finally {
      this._loading = false;
    }
  }

  handleLogout() {
    clearAuth();
    this.user = null;
    this.stats = null;
    this.route = { name: 'login' };
    location.hash = '';
  }

  switchRole() {
    this.handleLogout();
  }

  static styles = css`
    * { box-sizing: border-box; }
    :host { display: block; min-height: 100vh; background: #f5f7fa; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; color: #303133; }
    a { color: inherit; text-decoration: none; }
    button { font-family: inherit; cursor: pointer; }

    .app-layout { display: flex; min-height: 100vh; }
    .sidebar { width: 230px; background: linear-gradient(180deg, #1d4ed8 0%, #1e40af 100%); color: #fff; display: flex; flex-direction: column; }
    .logo { padding: 22px 20px 18px; font-size: 16px; font-weight: 700; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.12); line-height: 1.4; }
    .logo .sub { font-size: 11px; opacity: 0.75; font-weight: 400; margin-top: 4px; }
    .menu { padding: 12px 10px; flex: 1; }
    .menu-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; cursor: pointer; margin-bottom: 4px; color: rgba(255,255,255,0.85); font-size: 14px; transition: all 0.15s; }
    .menu-item:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .menu-item.active { background: rgba(255,255,255,0.18); color: #fff; font-weight: 500; }
    .menu-item .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0.6; }

    .sidebar-footer { padding: 14px 18px; border-top: 1px solid rgba(255,255,255,0.12); font-size: 12px; }
    .role-tag { display: inline-block; padding: 3px 10px; border-radius: 10px; background: rgba(255,255,255,0.2); font-size: 11px; margin-bottom: 8px; }
    .user-name { font-size: 14px; font-weight: 500; margin-bottom: 10px; }
    .logout-btn { width: 100%; padding: 7px; background: rgba(255,255,255,0.1); border: none; border-radius: 6px; color: #fff; font-size: 12px; }
    .logout-btn:hover { background: rgba(255,255,255,0.2); }

    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .topbar { height: 56px; background: #fff; border-bottom: 1px solid #ebeef5; display: flex; align-items: center; padding: 0 24px; justify-content: space-between; }
    .breadcrumb { font-size: 14px; color: #606266; }
    .breadcrumb strong { color: #303133; }
    .top-right { display: flex; align-items: center; gap: 16px; font-size: 13px; color: #606266; }
    .badge-sm { padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .content { flex: 1; padding: 20px 24px 32px; overflow: auto; }

    .message-layer { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 9999; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
    .msg-box { padding: 10px 18px; border-radius: 8px; font-size: 13px; box-shadow: 0 6px 20px rgba(0,0,0,0.12); pointer-events: auto; min-width: 220px; text-align: center; }
    .msg-box.success { background: #f0f9eb; color: #67c23a; border: 1px solid #e1f3d8; }
    .msg-box.error { background: #fef0f0; color: #f56c6c; border: 1px solid #fde2e2; }
    .msg-box.info { background: #ecf5ff; color: #409eff; border: 1px solid #d9ecff; }

    .loading-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; z-index: 9998; color: #fff; }
    .spinner { width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;

  _menuItems() {
    const items = [
      { key: 'dashboard', label: '工作台', path: '/dashboard', icon: '◆' },
    ];
    if (this.user?.role === 'REGISTRAR') {
      items.push({ key: 'list-register', label: '照护记录登记', path: '/list/register', icon: '✎' });
      items.push({ key: 'create', label: '新增登记', path: '/create', icon: '+' });
    }
    if (this.user?.role === 'AUDITOR') {
      items.push({ key: 'list-verify', label: '过程核验', path: '/list/verify', icon: '✓' });
    }
    if (this.user?.role === 'REVIEWER') {
      items.push({ key: 'list-review', label: '复核归档', path: '/list/review', icon: '★' });
    }
    items.push({ key: 'list-all', label: '记录总览', path: '/list', icon: '▤' });
    items.push({ key: 'warnings', label: '到期预警队列', path: '/warnings', icon: '!' });
    return items;
  }

  _breadcrumb() {
    const map = {
      dashboard: '工作台',
      'list-register': '照护记录登记',
      'list-verify': '过程核验',
      'list-review': '复核归档',
      list: '记录总览',
      create: '新增照护记录',
      'record-detail': '照护记录详情',
      warnings: '到期预警队列',
    };
    const key = this.route.name === 'list' ? (this.route.module ? `list-${this.route.module}` : 'list') : this.route.name;
    return map[key] || '工作台';
  }

  render() {
    if (!this.user) {
      return html`
        ${this._message ? html`<div class="message-layer"><div class="msg-box ${this._message.type}">${this._message.text}</div></div>` : ''}
        <login-view .onLogin=${(u, p) => this.handleLogin(u, p)} .loading=${this._loading}></login-view>
      `;
    }

    const menu = this._menuItems();
    const currentKey = this.route.name === 'list' ? (this.route.module ? `list-${this.route.module}` : 'list') : this.route.name;

    return html`
      <div class="app-layout">
        <aside class="sidebar">
          <div class="logo">
            养老护理院
            <div class="sub">月底集中处理照护记录系统</div>
          </div>
          <nav class="menu">
            ${menu.map(m => html`
              <div class="menu-item ${currentKey === m.key ? 'active' : ''}" @click=${() => this.navigate(m.path)}>
                <span>${m.icon}</span><span>${m.label}</span>
              </div>
            `)}
          </nav>
          <div class="sidebar-footer">
            <span class="role-tag" style="background: ${ROLE_MAP[this.user.role]?.color || '#666'}">${ROLE_MAP[this.user.role]?.label || this.user.role}</span>
            <div class="user-name">${this.user.full_name}</div>
            <button class="logout-btn" @click=${this.switchRole}>切换角色 / 登出</button>
          </div>
        </aside>
        <main class="main">
          <div class="topbar">
            <div class="breadcrumb">当前位置：<strong>${this._breadcrumb()}</strong></div>
            <div class="top-right">
              <span>${this.user.department || ''}</span>
              <span class="badge-sm" style="background:${ROLE_MAP[this.user.role]?.color}22;color:${ROLE_MAP[this.user.role]?.color}">
                ${ROLE_MAP[this.user.role]?.label}
              </span>
              <span>${formatDate(new Date())}</span>
            </div>
          </div>
          <div class="content">
            ${this._renderView()}
          </div>
        </main>
      </div>
      ${this._message ? html`<div class="message-layer"><div class="msg-box ${this._message.type}">${this._message.text}</div></div>` : ''}
      ${this._loading ? html`<div class="loading-mask"><div class="spinner"></div></div>` : ''}
    `;
  }

  _renderView() {
    const viewProps = {
      user: this.user,
      stats: this.stats,
      notify: (type, text) => this.showMessage(type, text),
      navigate: (p) => this.navigate(p),
      loadStats: () => this.loadStats(),
      setLoading: (v) => { this._loading = v; },
      route: this.route,
    };

    switch (this.route.name) {
      case 'dashboard':
        return html`<dashboard-view .props=${viewProps}></dashboard-view>`;
      case 'list':
        return html`<list-view .props=${viewProps} module=${this.route.module || ''}></list-view>`;
      case 'record-detail':
        return html`<detail-view .props=${viewProps} recordId=${this.route.id}></detail-view>`;
      case 'create':
        return html`<create-view .props=${viewProps}></create-view>`;
      case 'warnings':
        return html`<warnings-view .props=${viewProps}></warnings-view>`;
      default:
        return html`<dashboard-view .props=${viewProps}></dashboard-view>`;
    }
  }
}

customElements.define('care-app', CareApp);
