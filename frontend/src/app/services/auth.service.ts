import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { User } from '../models/loan.model';

const API_URL = 'http://localhost:8004/api';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
      try {
        this.userSubject.next(JSON.parse(saved));
      } catch (e) {}
    }
  }

  get currentUser(): User | null {
    return this.userSubject.value;
  }

  getAuthHeaders(): HttpHeaders {
    const user = this.currentUser;
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (user) {
      headers = headers.set('X-User-Name', user.username);
      headers = headers.set('X-User-Role', user.role);
    }
    return headers;
  }

  login(username: string, password: string): Observable<User> {
    return this.http.post<User>(`${API_URL}/login`, { username, password }).pipe(
      tap(user => {
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.userSubject.next(user);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    this.userSubject.next(null);
  }

  switchUser(user: User): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.userSubject.next(user);
  }
}
