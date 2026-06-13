import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../services/api.service';
import { ApiError, ROLE_SHORT_LABEL } from '../models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  template: `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%);">
      <mat-card style="width:100%;max-width:460px;padding:24px 32px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-size:22px;font-weight:700;color:#1e3a8a;margin-bottom:6px;">📰 新闻采编中心</div>
          <div style="font-size:16px;color:#374151;font-weight:500;">月底集中处理选题单系统</div>
        </div>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div style="margin-bottom:20px;">
            <mat-label style="font-size:13px;color:#6b7280;margin-bottom:6px;display:block;">快速选择演示账号</mat-label>
            <mat-form-field appearance="outline" style="width:100%;">
              <mat-select (selectionChange)="onSelectDemo($event.value)" [value]="''">
                <mat-option value="">—— 手动输入账号 ——</mat-option>
                <mat-option *ngFor="let a of demoAccounts" [value]="a.username">
                  {{ a.name }}（{{ ROLE_SHORT_LABEL[a.role as keyof typeof ROLE_SHORT_LABEL] }}） - {{ a.username }} / {{ a.password }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" style="width:100%;margin-bottom:16px;">
            <mat-label>用户名</mat-label>
            <input matInput formControlName="username" placeholder="如：zhuli / bianji / zongbian" autocomplete="username" />
          </mat-form-field>
          <mat-form-field appearance="outline" style="width:100%;margin-bottom:20px;">
            <mat-label>密码</mat-label>
            <input matInput formControlName="password" type="password" placeholder="演示账号密码与用户名对应" autocomplete="current-password" />
          </mat-form-field>
          <button
            mat-raised-button
            color="primary"
            type="submit"
            style="width:100%;height:48px;font-size:15px;"
            [disabled]="loading || form.invalid"
          >
            {{ loading ? '登录中...' : '登 录' }}
          </button>
        </form>
        <div style="margin-top:24px;padding:14px 16px;background:#fef3c7;border-radius:8px;font-size:12.5px;color:#92400e;line-height:1.7;">
          <div style="font-weight:600;margin-bottom:4px;">🔑 演示账号（密码=账号名+123）：</div>
          <div *ngFor="let a of demoAccounts" style="margin-left:6px;">
            • {{ a.name }}：{{ a.username }} / {{ a.password }}
          </div>
        </div>
      </mat-card>
    </div>
  `,
})
export class LoginPageComponent implements OnInit {
  form: FormGroup;
  loading = false;
  ROLE_SHORT_LABEL = ROLE_SHORT_LABEL;

  demoAccounts = [
    { username: 'zhuli', password: 'zhuli123', name: '采编助理-张明', role: 'registrar' as const },
    { username: 'bianji', password: 'bianji123', name: '责任编辑-李华', role: 'auditor' as const },
    { username: 'zongbian', password: 'zongbian123', name: '总编室-王芳', role: 'reviewer' as const },
  ];

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snack: MatSnackBar
  ) {
    this.form = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
    });
  }

  ngOnInit() {}

  onSelectDemo(u: string) {
    if (!u) return;
    const d = this.demoAccounts.find((a) => a.username === u);
    if (d) {
      this.form.patchValue({ username: d.username, password: d.password });
    }
  }

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.auth.login(this.form.value).subscribe({
      next: (r) => {
        this.snack.open(`欢迎，${r.user.display_name}！`, '关闭', { duration: 3000 });
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/topics';
        this.router.navigate([returnUrl]);
      },
      error: (e: ApiError) => {
        this.loading = false;
        this.snack.open(`登录失败：${e.message}`, '知道了', { duration: 4000, panelClass: 'warn-snack' });
      },
    });
  }
}
