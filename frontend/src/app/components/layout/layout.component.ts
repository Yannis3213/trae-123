import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { User, Statistics, ROLE_LABELS } from '../../models/models';

@Component({
  selector: 'app-layout',
  template: `
    <div style="display:flex;min-height:100vh;background:#f0f2f5">
      <div style="width:240px;background:#001529;color:#fff">
        <div style="padding:20px;font-size:18px;font-weight:bold;border-bottom:1px solid #1f1f1f">
          🚗 维修工单系统
        </div>
        <nav style="padding:10px 0">
          <div *ngFor="let menu of menus" (click)="router.navigate([menu.path])"
            [style.background]="router.url === menu.path ? '#1890ff' : 'transparent'"
            style="padding:12px 24px;cursor:pointer;display:flex;align-items:center;gap:10px"
            (mouseenter)="menu.hover = true" (mouseleave)="menu.hover = false"
            [style.background]="menu.hover && router.url !== menu.path ? '#112240' : null">
            <span>{{menu.icon}}</span>
            <span>{{menu.label}}</span>
          </div>
        </nav>
      </div>

      <div style="flex:1;display:flex;flex-direction:column">
        <header style="background:#fff;padding:0 24px;height:60px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
          <div style="display:flex;align-items:center;gap:20px">
            <h3 style="margin:0">{{currentPageTitle}}</h3>
            <span *ngIf="statistics" style="font-size:13px;color:#888">
              待处理: <span style="color:#1890ff;font-weight:bold">{{pendingCount}}</span>
              临期: <span style="color:#faad14;font-weight:bold">{{statistics.near_due}}</span>
              逾期: <span style="color:#ff4d4f;font-weight:bold">{{statistics.overdue}}</span>
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:15px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="color:#888">当前角色:</span>
              <span style="padding:4px 12px;background:#e6f7ff;color:#1890ff;border-radius:12px;font-size:13px">
                {{currentUser ? ROLE_LABELS[currentUser.role] : ''}}
              </span>
              <span style="color:#333;font-weight:500">{{currentUser?.name}}</span>
            </div>
            <select (change)="switchRole($any($event.target).value)"
              style="padding:6px 12px;border:1px solid #d9d9d9;border-radius:4px;font-size:13px">
              <option value="">切换角色</option>
              <option value="registrar">维修登记员</option>
              <option value="supervisor">维修审核主管</option>
              <option value="manager">复核负责人</option>
            </select>
            <button (click)="logout()"
              style="padding:6px 16px;background:#ff4d4f;color:#fff;border:none;border-radius:4px;cursor:pointer">
              退出
            </button>
          </div>
        </header>

        <main style="flex:1;padding:24px;overflow:auto">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `
})
export class LayoutComponent implements OnInit {
  currentUser: User | null = null;
  statistics: Statistics | null = null;

  menus = [
    { path: '/registration', label: '维修工单登记', icon: '📝', hover: false },
    { path: '/verification', label: '过程核验', icon: '✅', hover: false },
    { path: '/review', label: '复核归档', icon: '📋', hover: false },
    { path: '/warning', label: '到期预警队列', icon: '⚠️', hover: false },
    { path: '/ledger', label: '工单台账', icon: '📊', hover: false },
  ];

  ROLE_LABELS = ROLE_LABELS;

  constructor(
    public router: Router,
    private authService: AuthService,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
    this.loadStatistics();
  }

  get currentPageTitle(): string {
    const menu = this.menus.find(m => this.router.url.startsWith(m.path));
    return menu ? menu.label : '工作台';
  }

  get pendingCount(): number {
    if (!this.statistics) return 0;
    if (!this.currentUser) return 0;
    switch (this.currentUser.role) {
      case 'registrar': return this.statistics.correction;
      case 'supervisor': return this.statistics.pending_audit;
      case 'manager': return this.statistics.pending_review;
      default: return 0;
    }
  }

  loadStatistics(): void {
    this.apiService.getStatistics().subscribe(stats => {
      this.statistics = stats;
    });
  }

  switchRole(role: string): void {
    if (!role) return;
    const credentials: Record<string, { username: string; password: string }> = {
      registrar: { username: 'registrar', password: '123456' },
      supervisor: { username: 'supervisor', password: '123456' },
      manager: { username: 'manager', password: '123456' },
    };
    const cred = credentials[role];
    if (cred) {
      this.authService.switchUser(cred.username, cred.password).subscribe({
        next: () => {
          this.loadStatistics();
          this.router.navigate(['/registration']);
        }
      });
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
