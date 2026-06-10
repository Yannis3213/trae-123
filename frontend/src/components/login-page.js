import { LitElement, html, css } from 'lit';
import { api } from '../api.js';

class LoginPage extends LitElement {
  static properties = {
    username: { type: String },
    password: { type: String },
    loading: { type: Boolean },
    error: { type: String },
  };

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #1890ff 0%, #0050b3 100%);
    }

    .login-card {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      width: 360px;
    }

    .login-title {
      font-size: 22px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 8px;
      color: #262626;
    }

    .login-subtitle {
      font-size: 13px;
      color: #8c8c8c;
      text-align: center;
      margin-bottom: 32px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: #595959;
      font-size: 14px;
    }

    .form-group input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d9d9d9;
      border-radius: 6px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }

    .form-group input:focus {
      border-color: #1890ff;
      box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
    }

    .login-btn {
      width: 100%;
      padding: 12px;
      background-color: #1890ff;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .login-btn:hover:not(:disabled) {
      background-color: #40a9ff;
    }

    .login-btn:disabled {
      background-color: #bfbfbf;
      cursor: not-allowed;
    }

    .error-msg {
      color: #f5222d;
      font-size: 13px;
      margin-bottom: 16px;
      padding: 8px 12px;
      background-color: #fff1f0;
      border-radius: 4px;
    }

    .demo-accounts {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #f0f0f0;
    }

    .demo-title {
      font-size: 13px;
      color: #8c8c8c;
      margin-bottom: 12px;
    }

    .demo-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .demo-item {
      padding: 8px 12px;
      background-color: #f5f5f5;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      justify-content: space-between;
      transition: background-color 0.2s;
    }

    .demo-item:hover {
      background-color: #e6f7ff;
    }

    .demo-role {
      color: #595959;
    }

    .demo-user {
      color: #1890ff;
      font-weight: 500;
    }
  `;

  constructor() {
    super();
    this.username = '';
    this.password = '';
    this.loading = false;
    this.error = '';
  }

  _handleInput(e) {
    const { name, value } = e.target;
    this[name] = value;
    if (this.error) this.error = '';
  }

  async _handleLogin(e) {
    e.preventDefault();
    if (!this.username || !this.password) {
      this.error = '请输入用户名和密码';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      const data = await api.login(this.username, this.password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.dispatchEvent(new CustomEvent('auth-login', { detail: { user: data.user } }));
    } catch (err) {
      this.error = err.message || '登录失败';
    } finally {
      this.loading = false;
    }
  }

  _quickLogin(username, password) {
    this.username = username;
    this.password = password;
    this._handleLogin({ preventDefault: () => {} });
  }

  render() {
    return html`
      <div class="login-card">
        <h1 class="login-title">水务营业厅</h1>
        <p class="login-subtitle">月底集中处理开户申请系统</p>

        ${this.error ? html`<div class="error-msg">${this.error}</div>` : ''}

        <form @submit=${this._handleLogin}>
          <div class="form-group">
            <label>用户名</label>
            <input
              type="text"
              name="username"
              .value=${this.username}
              @input=${this._handleInput}
              placeholder="请输入用户名"
            />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input
              type="password"
              name="password"
              .value=${this.password}
              @input=${this._handleInput}
              placeholder="请输入密码"
            />
          </div>
          <button type="submit" class="login-btn" ?disabled=${this.loading}>
            ${this.loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <div class="demo-accounts">
          <div class="demo-title">演示账号（点击快速登录）</div>
          <ul class="demo-list">
            <li
              class="demo-item"
              @click=${() => this._quickLogin('window1', '123456')}
            >
              <span class="demo-role">窗口人员</span>
              <span class="demo-user">window1 / 123456</span>
            </li>
            <li
              class="demo-item"
              @click=${() => this._quickLogin('meter1', '123456')}
            >
              <span class="demo-role">抄表主管</span>
              <span class="demo-user">meter1 / 123456</span>
            </li>
            <li
              class="demo-item"
              @click=${() => this._quickLogin('manager1', '123456')}
            >
              <span class="demo-role">营业经理</span>
              <span class="demo-user">manager1 / 123456</span>
            </li>
          </ul>
        </div>
      </div>
    `;
  }
}

customElements.define('login-page', LoginPage);
