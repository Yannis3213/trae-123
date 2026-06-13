import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService, TopicService, UserService } from '../services/api.service';
import { UserInfo, UserRole, ROLE_LABEL, StatisticsResponse, ApiError, FRONTEND_PORT, BACKEND_PORT, LoginResponse } from '../models';
import { filter } from 'rxjs';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    MatBadgeModule,
    MatSnackBarModule,
  ],
  template: `
    <div style="min-height:100vh;display:flex;flex-direction:column;">
      <mat-toolbar color="primary" style="height:64px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="font-size:20px;font-weight:700;">📰 新闻采编中心</div>
          <div style="font-size:13px;opacity:0.85;background:rgba(255,255,255,0.15);padding:4px 10px;border-radius:20px;">月底集中处理选题单系统</div>
        </div>
        <nav style="display:flex;align-items:center;gap:4px;margin:0 24px;">
          <button
            mat-button
            routerLink="/topics"
            routerLinkActive="active-route"
            style="color:white;font-weight:500;"
          >
            <mat-icon>list_alt</mat-icon>
            <span style="margin-left:4px;">选题单列表</span>
            <mat-badge *ngIf="stats && stats.my_pending > 0" [matBadge]="stats.my_pending" matBadgeColor="warn" matBadgeOverlap="false" matBadgeSize="small" style="margin-left:4px;"></mat-badge>
          </button>
          <button
            *ngIf="isRegistrar"
            mat-button
            routerLink="/topics/new"
            routerLinkActive="active-route"
            style="color:white;font-weight:500;"
          >
            <mat-icon>add_circle</mat-icon>
            <span style="margin-left:4px;">新建选题</span>
          </button>
          <button
            mat-button
            routerLink="/topics/batch"
            routerLinkActive="active-route"
            style="color:white;font-weight:500;"
          >
            <mat-icon>playlist_add_check</mat-icon>
            <span style="margin-left:4px;">批量处理</span>
          </button>
          <button
            mat-button
            routerLink="/exception-demo"
            routerLinkActive="active-route"
            style="color:white;font-weight:500;"
          >
            <mat-icon>bug_report</mat-icon>
            <span style="margin-left:4px;">异常测试</span>
          </button>
        </nav>
        <div style="display:flex;align-items:center;gap:12px;">
          <div *ngIf="stats" style="font-size:12px;background:rgba(255,255,255,0.12);padding:6px 12px;border-radius:6px;">
            <span style="opacity:0.8;">待办：</span>
            <span style="font-weight:600;color:#fef08a;">{{ stats.my_pending }}</span>
            <span style="opacity:0.5;margin:0 6px;">|</span>
            <span style="opacity:0.8;">预警：</span>
            <span style="color:#fca5a5;font-weight:600;">{{ stats.warning.overdue }}</span>
            <span style="opacity:0.5;margin:0 6px;">/</span>
            <span style="color:#fde047;font-weight:600;">{{ stats.warning.warning }}</span>
          </div>
          <button mat-button [matMenuTriggerFor]="roleMenu" style="color:white;">
            <mat-icon>swap_horiz</mat-icon>
            <span style="margin:0 4px;">切换角色</span>
          </button>
          <mat-menu #roleMenu="matMenu">
            <button mat-menu-item *ngFor="let u of userList" (click)="switchTo(u)" [disabled]="u.id === user?.id">
              <span style="font-weight:600;">{{ u.display_name }}</span>
              <span style="margin-left:8px;font-size:12px;color:#6b7280;">{{ ROLE_LABEL[u.role] }}</span>
              <span *ngIf="u.id === user?.id" style="color:#2563eb;margin-left:auto;font-weight:600;">（当前）</span>
            </button>
          </mat-menu>
          <button mat-button [matMenuTriggerFor]="userMenu" style="color:white;">
            <mat-icon style="margin-right:4px;">account_circle</mat-icon>
            <span style="font-weight:600;">{{ user?.display_name || '用户' }}</span>
            <mat-icon style="margin-left:2px;font-size:18px;">arrow_drop_down</mat-icon>
          </button>
          <mat-menu #userMenu="matMenu">
            <div mat-menu-item disabled style="opacity:1;cursor:default;padding:12px 16px;border-bottom:1px solid #e5e7eb;">
              <div style="font-weight:600;">{{ user?.display_name }}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px;">{{ user?.username }} · {{ ROLE_LABEL[user!.role] }}</div>
            </div>
            <button mat-menu-item (click)="refresh()">
              <mat-icon style="margin-right:8px;color:#3b82f6;">refresh</mat-icon>
              刷新数据
            </button>
            <button mat-menu-item (click)="logout()">
              <mat-icon style="margin-right:8px;color:#ef4444;">logout</mat-icon>
              退出登录
            </button>
          </mat-menu>
        </div>
      </mat-toolbar>
      <div style="flex:1;padding:24px;max-width:1600px;margin:0 auto;width:100%;">
        <router-outlet></router-outlet>
      </div>
      <div style="background:#111827;color:#9ca3af;padding:10px 24px;font-size:11.5px;display:flex;justify-content:space-between;">
        <div>新闻采编中心选题单系统 · 服务于选题申报-采访安排-稿件提交闭环流转</div>
        <div>前端端口：{{ FRONTEND_PORT }} · 后端端口：{{ BACKEND_PORT }}</div>
      </div>
    </div>
  `,
  styles: [
    `
      .active-route {
        background: rgba(255,255,255,0.2) !important;
        border-radius: 6px;
      }
    `,
  ],
})
export class LayoutPageComponent implements OnInit {
  user: UserInfo | null = null;
  userList: UserInfo[] = [];
  stats: StatisticsResponse | null = null;
  FRONTEND_PORT = FRONTEND_PORT;
  BACKEND_PORT = BACKEND_PORT;
  ROLE_LABEL = ROLE_LABEL;

  constructor(
    private auth: AuthService,
    private userService: UserService,
    private topicService: TopicService,
    private router: Router,
    private snack: MatSnackBar
  ) {}

  ngOnInit() {
    this.auth.user$.subscribe((u) => (this.user = u));
    this.user = this.auth.currentUser;
    this.loadUserList();
    this.loadStats();
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.loadStats());
  }

  get isRegistrar(): boolean {
    return this.user?.role === 'registrar';
  }

  loadUserList() {
    this.userService.list().subscribe({
      next: (list) => (this.userList = list),
      error: () => {},
    });
  }

  loadStats() {
    this.topicService.statistics().subscribe({
      next: (s) => (this.stats = s),
      error: (_e: ApiError) => {},
    });
  }

  switchTo(u: UserInfo) {
    if (u.id === this.user?.id) return;
    const pwMap: Record<string, string> = {
      zhuli: 'zhuli123',
      bianji: 'bianji123',
      zongbian: 'zongbian123',
    };
    const pw = pwMap[u.username];
    if (!pw) {
      this.snack.open('该账号无法快速切换，请手动登录', '知道了', { duration: 3000 });
      return;
    }
    this.auth.login({ username: u.username, password: pw }).subscribe({
      next: (_r: LoginResponse) => {
        this.snack.open(`已切换到 ${u.display_name}`, '好的', { duration: 2500 });
        this.loadStats();
        if (this.router.url === '/exception-demo') {
          this.router.navigate(['/topics']);
        }
      },
      error: (e: ApiError) => {
        this.snack.open(`切换失败：${e.message}`, '知道了', { duration: 4000 });
      },
    });
  }

  refresh() {
    this.loadStats();
    this.snack.open('数据已刷新', '好的', { duration: 2000 });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
    this.snack.open('已退出登录', '好的', { duration: 2000 });
  }
}
