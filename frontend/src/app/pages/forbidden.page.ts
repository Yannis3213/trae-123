import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, MatCardModule],
  template: `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#fef2f2;">
      <mat-card style="max-width:520px;padding:40px;text-align:center;">
        <div style="font-size:72px;margin-bottom:16px;">🚫</div>
        <div style="font-size:28px;font-weight:700;color:#dc2626;margin-bottom:8px;">403 权限不足</div>
        <div style="color:#6b7280;font-size:14px;margin-bottom:28px;line-height:1.7;">
          抱歉，您当前的角色无权访问此页面。<br />
          请联系系统管理员或使用其他账号登录。
        </div>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button mat-raised-button color="primary" routerLink="/topics">
            <mat-icon style="margin-right:6px;">home</mat-icon>返回首页
          </button>
          <button mat-stroked-button (click)="logout()">
            <mat-icon style="margin-right:6px;">logout</mat-icon>切换账号
          </button>
        </div>
      </mat-card>
    </div>
  `,
})
export class ForbiddenPageComponent {
  constructor(private router: Router) {}
  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
