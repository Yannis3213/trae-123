import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { User } from './models/loan.model';
import { LoanService } from './services/loan.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  template: `
    <div class="app-container">
      <header class="app-header" *ngIf="currentUser">
        <div class="header-left">
          <h1 (click)="goHome()" class="logo">小贷公司 · 月底集中处理借款申请单系统</h1>
        </div>
        <div class="header-right">
          <div class="role-switcher">
            <label>角色切换:</label>
            <select (change)="onRoleChange($event)" [value]="currentUser?.username">
              <optgroup label="信贷员">
                <option *ngFor="let u of creditOfficers" [value]="u.username">
                  {{ u.name }} ({{ u.roleName }})
                </option>
              </optgroup>
              <optgroup label="风控审核员">
                <option *ngFor="let u of riskAuditors" [value]="u.username">
                  {{ u.name }} ({{ u.roleName }})
                </option>
              </optgroup>
              <optgroup label="贷后主管">
                <option *ngFor="let u of supervisors" [value]="u.username">
                  {{ u.name }} ({{ u.roleName }})
                </option>
              </optgroup>
            </select>
          </div>
          <span class="user-info">{{ currentUser?.name }} ({{ currentUser?.roleName }})</span>
          <button class="btn-link" (click)="logout()">退出</button>
        </div>
      </header>
      <main class="app-main">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-container { min-height: 100vh; display: flex; flex-direction: column; }
    .app-header {
      background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);
      color: white;
      padding: 0 24px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .logo { font-size: 18px; margin: 0; cursor: pointer; font-weight: 600; }
    .header-right { display: flex; align-items: center; gap: 16px; }
    .role-switcher { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .role-switcher select {
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.3);
      background: rgba(255,255,255,0.1);
      color: white;
      font-size: 13px;
    }
    .role-switcher select option { color: #333; }
    .user-info { font-size: 13px; opacity: 0.9; }
    .btn-link {
      background: none; border: none; color: white; cursor: pointer;
      text-decoration: underline; font-size: 13px;
    }
    .app-main { flex: 1; padding: 20px; background: #f0f2f5; }
  `]
})
export class AppComponent implements OnInit {
  currentUser: User | null = null;
  creditOfficers: User[] = [];
  riskAuditors: User[] = [];
  supervisors: User[] = [];
  allUsers: User[] = [];

  constructor(
    private auth: AuthService,
    private router: Router,
    private loanService: LoanService
  ) {}

  ngOnInit(): void {
    this.auth.user$.subscribe(user => {
      this.currentUser = user;
    });
    this.loadUsers();
  }

  loadUsers(): void {
    const defaultUsers: User[] = [
      { username: 'credit_officer_01', name: '张信贷', role: 'CREDIT_OFFICER', roleName: '信贷员' },
      { username: 'credit_officer_02', name: '李信贷', role: 'CREDIT_OFFICER', roleName: '信贷员' },
      { username: 'risk_auditor_01', name: '王风控', role: 'RISK_AUDITOR', roleName: '风控审核员' },
      { username: 'risk_auditor_02', name: '赵风控', role: 'RISK_AUDITOR', roleName: '风控审核员' },
      { username: 'supervisor_01', name: '陈主管', role: 'LOAN_SUPERVISOR', roleName: '贷后主管' },
    ];
    this.allUsers = defaultUsers;
    this.creditOfficers = defaultUsers.filter(u => u.role === 'CREDIT_OFFICER');
    this.riskAuditors = defaultUsers.filter(u => u.role === 'RISK_AUDITOR');
    this.supervisors = defaultUsers.filter(u => u.role === 'LOAN_SUPERVISOR');
  }

  onRoleChange(event: Event): void {
    const username = (event.target as HTMLSelectElement).value;
    const user = this.allUsers.find(u => u.username === username);
    if (user) {
      this.auth.switchUser(user);
      window.location.reload();
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
