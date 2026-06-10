import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  username = '';
  password = '';
  error = '';
  loading = false;

  demoAccounts = [
    { label: '值机员 - 张值机', username: 'zhiJiYuan', password: '123456' },
    { label: '行李主管 - 李行李', username: 'xingLiZhuGuan', password: '123456' },
    { label: '站点经理 - 王站长', username: 'zhanDianJingLi', password: '123456' },
  ];

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit(): void {
    this.error = '';
    if (!this.username || !this.password) {
      this.error = '请输入用户名和密码';
      return;
    }
    this.loading = true;
    this.auth.login(this.username, this.password).subscribe({
      next: () => this.router.navigate(['/records']),
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || '登录失败，请检查用户名和密码';
      },
    });
  }

  quickLogin(account: { username: string; password: string }): void {
    this.username = account.username;
    this.password = account.password;
    this.onSubmit();
  }
}
