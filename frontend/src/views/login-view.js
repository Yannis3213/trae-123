import { LitElement, css, html } from 'lit';

export class LoginView extends LitElement {
  static properties = {
    username: { type: String },
    password: { type: String },
    loading: { type: Boolean },
    onLogin: { type: Object },
  };

  constructor() {
    super();
    this.username = '';
    this.password = '';
    this.loading = false;
  }

  static styles = css`
    :host { display: block; min-height: 100vh; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%); display: flex; align-items: center; justify-content: center; font-family: -apple-system, "PingFang SC", sans-serif; }
    .wrap { display: flex; gap: 0; background: #fff; border-radius: 16px; box-shadow: 0 24px 60px rgba(30, 58, 138, 0.3); overflow: hidden; width: 900px; max-width: 96vw; min-height: 520px; }
    .brand { width: 420px; background: linear-gradient(180deg, #1e40af, #1e3a8a); color: #fff; padding: 48px 40px; display: flex; flex-direction: column; justify-content: space-between; }
    .brand h1 { font-size: 26px; font-weight: 700; line-height: 1.4; margin: 0 0 16px; }
    .brand h1 span { display: block; font-size: 15px; opacity: 0.8; font-weight: 400; margin-top: 10px; }
    .brand .tagline { font-size: 13px; opacity: 0.75; line-height: 1.8; }
    .features { margin-top: 28px; }
    .features li { list-style: none; font-size: 13px; padding: 8px 0; display: flex; align-items: center; gap: 10px; opacity: 0.9; }
    .features li::before { content: '✓'; width: 20px; height: 20px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
    .footer-note { font-size: 11px; opacity: 0.55; }

    .form-box { flex: 1; padding: 48px 48px; display: flex; flex-direction: column; justify-content: center; }
    .form-box h2 { font-size: 22px; margin: 0 0 8px; color: #1e293b; }
    .form-box .tip { font-size: 13px; color: #64748b; margin-bottom: 32px; }
    .field { margin-bottom: 18px; }
    .field label { display: block; font-size: 13px; color: #475569; margin-bottom: 6px; font-weight: 500; }
    .field input { width: 100%; height: 42px; padding: 0 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; transition: all 0.15s; outline: none; }
    .field input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
    .btn { width: 100%; height: 44px; background: linear-gradient(90deg, #1e40af, #3b82f6); color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.15s; margin-top: 12px; }
    .btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(59, 130, 246, 0.35); }
    .btn:disabled { opacity: 0.7; cursor: not-allowed; }

    .account-list { margin-top: 28px; padding-top: 20px; border-top: 1px dashed #e2e8f0; }
    .account-list .title { font-size: 12px; color: #64748b; margin-bottom: 10px; }
    .accounts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .acc { padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.15s; background: #f8fafc; }
    .acc:hover { background: #eff6ff; border-color: #93c5fd; }
    .acc .role { color: #1e40af; font-weight: 600; margin-right: 6px; }
    .acc .pw { color: #94a3b8; }
  `;

  _submit(e) {
    e.preventDefault();
    if (!this.username || !this.password) return;
    if (this.onLogin) this.onLogin(this.username, this.password);
  }

  _quickLogin(u, p) {
    this.username = u;
    this.password = p;
    setTimeout(() => this._submit(new Event('submit')), 50);
  }

  render() {
    return html`
      <div class="wrap">
        <div class="brand">
          <div>
            <h1>
              养老护理院
              <span>月底集中处理照护记录系统</span>
            </h1>
            <div class="tagline">
              全流程闭环：照护登记 → 护士长核验 → 院区主任复核归档<br/>
              角色级权限、乐观锁版本控制、证据链完整可追溯
            </div>
            <ul class="features">
              <li>药品发放 / 生命体征补正 / 异常复核 自动关联状态</li>
              <li>版本号校验 + 当前角色 + 当前处理人 三重拦截</li>
              <li>批量处理逐条结果、越权 / 状态冲突 / 旧版本拦截</li>
              <li>到期预警：正常 · 临期(≤2天) · 逾期 三色分明</li>
            </ul>
          </div>
          <div class="footer-note">© 2026 养老护理院信息中心 · 端口: 前端 3105 / 后端 8105</div>
        </div>
        <form class="form-box" @submit=${this._submit}>
          <h2>欢迎登录</h2>
          <div class="tip">请使用演示账号登录并切换角色体验完整流程</div>
          <div class="field">
            <label>用户名</label>
            <input type="text" .value=${this.username} @input=${e => this.username = e.target.value} placeholder="请输入用户名" autocomplete="username">
          </div>
          <div class="field">
            <label>密码</label>
            <input type="password" .value=${this.password} @input=${e => this.password = e.target.value} placeholder="请输入密码" autocomplete="current-password">
          </div>
          <button class="btn" type="submit" ?disabled=${this.loading || !this.username || !this.password}>
            ${this.loading ? '登录中...' : '登录系统'}
          </button>
          <div class="account-list">
            <div class="title">演示账号（点击快速填入）</div>
            <div class="accounts">
              <div class="acc" @click=${() => this._quickLogin('nurse01', '123456')}>
                <span class="role">护登记员</span>nurse01 <span class="pw">/ 123456</span>
              </div>
              <div class="acc" @click=${() => this._quickLogin('nurse02', '123456')}>
                <span class="role">护理员</span>nurse02 <span class="pw">/ 123456</span>
              </div>
              <div class="acc" @click=${() => this._quickLogin('shenzhang', '123456')}>
                <span class="role">护士长</span>shenzhang <span class="pw">/ 123456</span>
              </div>
              <div class="acc" @click=${() => this._quickLogin('yuanzhu', '123456')}>
                <span class="role">院区主任</span>yuanzhu <span class="pw">/ 123456</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    `;
  }
}
customElements.define('login-view', LoginView);
