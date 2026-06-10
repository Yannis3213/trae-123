import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  template: `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f0f2f5">
      <div style="background:#fff;padding:40px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.1);width:400px">
        <h2 style="text-align:center;margin-bottom:30px;color:#1890ff">汽车4S店维修工单系统</h2>
        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
          <div style="margin-bottom:20px">
            <label style="display:block;margin-bottom:8px;color:#333">用户名</label>
            <input type="text" formControlName="username"
              style="width:100%;padding:10px;border:1px solid #d9d9d9;border-radius:4px;font-size:14px"
              placeholder="请输入用户名">
          </div>
          <div style="margin-bottom:20px">
            <label style="display:block;margin-bottom:8px;color:#333">密码</label>
            <input type="password" formControlName="password"
              style="width:100%;padding:10px;border:1px solid #d9d9d9;border-radius:4px;font-size:14px"
              placeholder="请输入密码">
          </div>
          <div *ngIf="error" style="color:#ff4d4f;margin-bottom:15px;font-size:14px">{{error}}</div>
          <button type="submit" [disabled]="loading"
            style="width:100%;padding:12px;background:#1890ff;color:#fff;border:none;border-radius:4px;font-size:16px;cursor:pointer">
            {{loading ? '登录中...' : '登录'}}
          </button>
        </form>
        <div style="margin-top:20px;padding:15px;background:#f6ffed;border:1px solid #b7eb8f;border-radius:4px">
          <div style="font-weight:bold;margin-bottom:8px;color:#52c41a">演示账号：</div>
          <div style="font-size:13px;color:#666;line-height:1.8">
            <div>registrar / 123456 (维修登记员)</div>
            <div>supervisor / 123456 (维修审核主管)</div>
            <div>manager / 123456 (复核负责人)</div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  error = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.error = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
        this.router.navigate([returnUrl]);
      },
      error: () => {
        this.error = '用户名或密码错误';
        this.loading = false;
      }
    });
  }
}
