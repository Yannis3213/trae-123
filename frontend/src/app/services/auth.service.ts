import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

const API_BASE = '';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _currentUser = signal<User | null>(null);
  private _token = signal<string | null>(null);

  constructor(private http: HttpClient, private router: Router) {
    const token = localStorage.getItem('access_token');
    const userStr = localStorage.getItem('current_user');
    if (token && userStr) {
      this._token.set(token);
      try {
        this._currentUser.set(JSON.parse(userStr));
      } catch {}
    }
  }

  currentUser() { return this._currentUser.asReadonly(); }
  token() { return this._token.asReadonly(); }
  isLoggedIn() { return !!this._token(); }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_BASE}/api/auth/login`, { username, password }).pipe(
      tap(res => {
        localStorage.setItem('access_token', res.access_token);
        localStorage.setItem('current_user', JSON.stringify(res.user));
        this._token.set(res.access_token);
        this._currentUser.set(res.user);
      })
    );
  }

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_user');
    this._token.set(null);
    this._currentUser.set(null);
  }

  hasRole(role: string): boolean {
    return this._currentUser()?.role === role;
  }

  isCustomerService(): boolean { return this.hasRole('客服专员'); }
  isDispatchSupervisor(): boolean { return this.hasRole('调度主管'); }
  isOperationsManager(): boolean { return this.hasRole('运营经理'); }
}
