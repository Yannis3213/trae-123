import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { ToastService } from './services/toast.service';
import { User } from './models/launch-plan';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-layout">
      <header class="app-header">
        <div class="header-left">
          <div class="logo" (click)="router.navigate(['/'])">
            <span class="logo-icon">🚀</span>
            <span class="logo-text">SaaS客户成功团队-月底集中处理上线计划单系统</span>
          </div>
        </div>
        <div class="header-right">
          <div class="role-switcher">
            <span class="current-label">当前用户：</span>
            <select class="select" style="width:220px" [value]="currentUser.name" (change)="onUserChange($event)">
              <option *ngFor="let u of users" [value]="u.name">
                {{u.name}}（{{u.role_name}}）
              </option>
            </select>
          </div>
        </div>
      </header>

      <main class="app-main">
        <router-outlet></router-outlet>
      </main>

      <div class="toast">
        <div *ngFor="let t of toasts" class="toast-item"
          [ngClass]="{
            'alert-success': t.type === 'success',
            'alert-error': t.type === 'error',
            'alert-warning': t.type === 'warning',
            'alert-info': t.type === 'info'
          }" (click)="toastService.remove(t.id)">
          {{ t.message }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .app-layout { min-height: 100vh; display: flex; flex-direction: column; }
    .app-header {
      height: 60px;
      background: linear-gradient(90deg, #1d4ed8, #2563eb);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.15);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
    }
    .logo-icon { font-size: 24px; }
    .logo-text { font-size: 17px; font-weight: 600; }
    .role-switcher {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .current-label {
      font-size: 13px;
      opacity: 0.9;
    }
    .role-switcher .select {
      background: rgba(255,255,255,0.95);
      color: #303133;
      border: none;
    }
    .app-main {
      flex: 1;
      padding: 20px;
      max-width: 1600px;
      width: 100%;
      margin: 0 auto;
    }
  `],
})
export class AppComponent {
  currentUser!: User;
  users!: User[];
  toasts: any[] = [];

  constructor(
    public router: Router,
    public auth: AuthService,
    public toastService: ToastService
  ) {
    this.users = auth.getAllUsers();
    auth.user$.subscribe((u) => (this.currentUser = u));
    toastService.toasts$.subscribe((t) => (this.toasts = t));
  }

  onUserChange(e: Event) {
    const name = (e.target as HTMLSelectElement).value;
    const u = this.users.find(x => x.name === name);
    if (u) this.auth.setUser(u);
  }
}
