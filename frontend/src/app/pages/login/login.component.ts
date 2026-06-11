import { Component } from '@angular/core';
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
      <div class="login-box">
        <h2>小贷公司 · 月底集中处理借款申请单系统</h2>
        <p class="subtitle">贷后主管复核视角</p>
        <form (ngSubmit)="onLogin()">
          <div class="form-group">
            <label>用户名</label>
            <input type="text" [(ngModel)]="username" name="username" placeholder="请输入用户名" required>
          </div>
          <div class="form-group">
            <label>密码</label>
            <input type="password" [(ngModel)]="password" name="password" placeholder="请输入密码" required>
          </div>
          <div *ngIf="error" class="error">{{ error }}</div>
          <button type="submit" class="btn-primary">登录</button>
        </form>
        <div class="quick-login">
          <p>快速登录（密码均为 123456）：</p>
          <div class="quick-buttons">
            <button (click)="quickLogin('credit_officer_01')">张信贷</button>
            <button (click)="quickLogin('risk_auditor_01')">王风控</button>
            <button (click)="quickLogin('supervisor_01')">陈主管</button>
          </div>
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
    }
    .login-box {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      width: 400px;
    }
    h2 { margin: 0 0 8px 0; color: #1e3a5f; font-size: 20px; text-align: center; }
    .subtitle { text-align: center; color: #666; margin: 0 0 24px 0; font-size: 14px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 6px; font-size: 13px; color: #333; }
    .form-group input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      box-sizing: border-box;
    }
    .form-group input:focus { outline: none; border-color: #2c5282; }
    .btn-primary {
      width: 100%;
      padding: 12px;
      background: #2c5282;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 15px;
      cursor: pointer;
      margin-top: 8px;
    }
    .btn-primary:hover { background: #1e3a5f; }
    .error { color: #e53e3e; font-size: 13px; margin-bottom: 12px; padding: 8px; background: #fff5f5; border-radius: 4px; }
    .quick-login { margin-top: 20px; padding-top: 16px; border-top: 1px solid #eee; }
    .quick-login p { font-size: 13px; color: #666; margin: 0 0 10px 0; }
    .quick-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
    .quick-buttons button {
      flex: 1;
      padding: 8px;
      border: 1px solid #2c5282;
      background: white;
      color: #2c5282;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      min-width: 80px;
    }
    .quick-buttons button:hover { background: #f0f7ff; }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

  onLogin(): void {
    this.error = '';
    this.auth.login(this.username, this.password).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => {
        this.error = err.error?.error || '登录失败';
      }
    });
  }

  quickLogin(username: string): void {
    this.username = username;
    this.password = '123456';
    this.onLogin();
  }
}
