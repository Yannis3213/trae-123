import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h1 class="login-title">货运物流公司</h1>
        <h2 class="login-subtitle">月底集中处理运输订单系统</h2>
        <form class="login-form" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label>用户名</label>
            <input type="text" [(ngModel)]="username" name="username" required placeholder="请输入用户名" />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input type="password" [(ngModel)]="password" name="password" required placeholder="请输入密码" />
          </div>
          <div class="error-message" *ngIf="error()">{{ error() }}</div>
          <button type="submit" class="btn btn-primary btn-block" [disabled]="loading()">
            {{ loading() ? '登录中...' : '登录' }}
          </button>
        </form>
        <div class="demo-accounts">
          <h3>演示账号</h3>
          <ul>
            <li (click)="quickLogin('kefu', '123456')">
              <span class="role">客服专员</span>
              <span class="account">kefu / 123456</span>
            </li>
            <li (click)="quickLogin('diaodu', '123456')">
              <span class="role">调度主管</span>
              <span class="account">diaodu / 123456</span>
            </li>
            <li (click)="quickLogin('yunying', '123456')">
              <span class="role">运营经理</span>
              <span class="account">yunying / 123456</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }
    .login-card {
      background: #fff;
      border-radius: 8px;
      padding: 40px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }
    .login-title {
      font-size: 24px;
      font-weight: 600;
      text-align: center;
      color: #1f1f1f;
      margin-bottom: 4px;
    }
    .login-subtitle {
      font-size: 16px;
      font-weight: 400;
      text-align: center;
      color: #666;
      margin-bottom: 32px;
    }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; font-size: 14px; color: #333; }
    .form-group input {
      width: 100%; padding: 10px 12px; border: 1px solid #d9d9d9;
      border-radius: 4px; font-size: 14px; outline: none; transition: border-color 0.2s;
    }
    .form-group input:focus { border-color: #1677ff; }
    .btn-primary {
      background: #1677ff; color: #fff; border: none; padding: 10px 24px;
      border-radius: 4px; font-size: 14px; transition: background 0.2s;
    }
    .btn-primary:hover { background: #4096ff; }
    .btn-primary:disabled { background: #91caff; cursor: not-allowed; }
    .btn-block { width: 100%; }
    .error-message { color: #ff4d4f; margin-bottom: 12px; font-size: 13px; }
    .demo-accounts { margin-top: 24px; padding-top: 24px; border-top: 1px solid #f0f0f0; }
    .demo-accounts h3 { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #333; }
    .demo-accounts ul { list-style: none; }
    .demo-accounts li {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 12px; background: #fafafa; border-radius: 4px;
      margin-bottom: 8px; cursor: pointer; transition: background 0.2s;
    }
    .demo-accounts li:hover { background: #e6f4ff; }
    .demo-accounts .role { font-weight: 500; color: #1677ff; font-size: 14px; }
    .demo-accounts .account { color: #666; font-size: 13px; font-family: monospace; }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  loading = signal(false);
  error = signal('');

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit() {
    if (!this.username || !this.password) {
      this.error.set('请输入用户名和密码');
      return;
    }
    this.doLogin(this.username, this.password);
  }

  quickLogin(username: string, password: string) {
    this.username = username;
    this.password = password;
    this.doLogin(username, password);
  }

  private doLogin(username: string, password: string) {
    this.loading.set(true);
    this.error.set('');
    this.authService.login(username, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/orders']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.detail || err?.error?.message || '登录失败，请检查用户名和密码');
      }
    });
  }
}
