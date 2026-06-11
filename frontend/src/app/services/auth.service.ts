import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User } from '../models/launch-plan';

const DEFAULT_USERS: User[] = [
  { name: '张三', role: 'cs_manager', role_name: '客户成功经理' },
  { name: '王五', role: 'cs_manager', role_name: '客户成功经理' },
  { name: '李四', role: 'delivery_consultant', role_name: '交付顾问' },
  { name: '赵六', role: 'delivery_consultant', role_name: '交付顾问' },
  { name: '王总', role: 'cs_lead', role_name: '客户成功负责人' },
];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User>(DEFAULT_USERS[0]);
  user$ = this.userSubject.asObservable();
  private storageKey = 'launch-system-user';

  constructor() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const match = DEFAULT_USERS.find(u => u.name === parsed.name);
        if (match) this.userSubject.next(match);
      } catch {}
    }
  }

  get currentUser(): User {
    return this.userSubject.value;
  }

  getAllUsers(): User[] {
    return DEFAULT_USERS;
  }

  setUser(user: User) {
    this.userSubject.next(user);
    localStorage.setItem(this.storageKey, JSON.stringify(user));
  }

  getHeaders(): Record<string, string> {
    const u = this.currentUser;
    return {
      'X-User-Name': u.name,
      'X-User-Role': u.role,
    };
  }
}
