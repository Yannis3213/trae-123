import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { tap, map, catchError } from 'rxjs/operators';
import { User } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private tokenKey = 'auth_token';
  private userKey = 'auth_user';

  currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();
  isLoggedIn$: Observable<boolean> = this.currentUserSubject.pipe(map(u => !!u));

  constructor(private http: HttpClient) {
    this.loadStoredUser();
  }

  private loadStoredUser(): void {
    const token = localStorage.getItem(this.tokenKey);
    const userJson = localStorage.getItem(this.userKey);
    if (token && userJson) {
      try {
        this.currentUserSubject.next(JSON.parse(userJson));
      } catch {
        this.clearAuth();
      }
    }
  }

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(username: string, password: string): Observable<User> {
    return this.http.post<{ token: string; user: User }>('/api/auth/login', { username, password }).pipe(
      tap(res => {
        localStorage.setItem(this.tokenKey, res.token);
        localStorage.setItem(this.userKey, JSON.stringify(res.user));
        this.currentUserSubject.next(res.user);
      }),
      map(res => res.user)
    );
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>('/api/auth/me');
  }

  switchRole(username: string, password: string): Observable<User> {
    return this.login(username, password);
  }

  logout(): void {
    this.clearAuth();
  }

  private clearAuth(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.currentUserSubject.next(null);
  }
}
