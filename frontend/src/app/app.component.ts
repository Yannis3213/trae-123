import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  template: `
    <div class="app-layout">
      <header class="app-header" *ngIf="authService.isLoggedIn()">
        <div class="header-left">
          <h1 class="app-title">货运物流公司-月底集中处理运输订单系统</h1>
        </div>
        <div class="header-right">
          <span class="user-info" *ngIf="authService.currentUser()">
            {{ authService.currentUser()?.full_name }}
            <span class="role-tag">{{ authService.currentUser()?.role }}</span>
          </span>
          <button class="btn btn-link" (click)="switchRole()">切换角色</button>
          <button class="btn btn-link" (click)="logout()">退出</button>
        </div>
      </header>
      <nav class="app-nav" *ngIf="authService.isLoggedIn()">
        <a routerLink="/orders" routerLinkActive="active" class="nav-item">运输订单登记</a>
        <a routerLink="/orders?tab=review" routerLinkActive="active" class="nav-item">过程核验</a>
        <a routerLink="/orders?tab=archive" routerLinkActive="active" class="nav-item">复核归档</a>
        <a routerLink="/warnings" routerLinkActive="active" class="nav-item">到期预警</a>
      </nav>
      <main class="app-main">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-layout { min-height: 100vh; display: flex; flex-direction: column; }
    .app-header {
      background: #001529; color: #fff; padding: 0 24px; height: 64px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .app-title { font-size: 18px; font-weight: 600; color: #fff; }
    .header-right { display: flex; align-items: center; gap: 16px; }
    .user-info { font-size: 14px; }
    .role-tag {
      display: inline-block; margin-left: 8px; padding: 2px 8px;
      background: #1677ff; color: #fff; border-radius: 4px; font-size: 12px;
    }
    .app-nav {
      background: #fff; border-bottom: 1px solid #f0f0f0;
      padding: 0 24px; display: flex; gap: 4px;
    }
    .nav-item {
      padding: 14px 20px; color: #000000d9; font-size: 14px;
      border-bottom: 2px solid transparent; transition: all 0.2s;
    }
    .nav-item:hover { color: #1677ff; }
    .nav-item.active { color: #1677ff; border-bottom-color: #1677ff; font-weight: 500; }
    .app-main { flex: 1; padding: 24px; }
    .btn { padding: 6px 16px; border-radius: 4px; border: 1px solid #d9d9d9; background: #fff; font-size: 14px; }
    .btn:hover { border-color: #1677ff; color: #1677ff; }
    .btn-link { border: none; background: transparent; color: #1677ff; padding: 4px 8px; }
    .btn-link:hover { color: #4096ff; }
  `]
})
export class AppComponent {
  constructor(public authService: AuthService, private router: Router) {}

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  switchRole() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
