import { Injectable } from '@nestjs/common';

const DEMO_USERS = [
  { id: 1, username: 'registrar', role: 'registrar' as const, name: '张晓明' },
  { id: 2, username: 'reviewer', role: 'reviewer' as const, name: '李审核' },
  { id: 3, username: 'director', role: 'director' as const, name: '王总监' },
];

@Injectable()
export class AuthService {
  private currentUser = DEMO_USERS[0];

  login(username: string) {
    const user = DEMO_USERS.find((u) => u.username === username);
    if (!user) return null;
    this.currentUser = user;
    return user;
  }

  switchRole(role: string) {
    const user = DEMO_USERS.find((u) => u.role === role);
    if (!user) return null;
    this.currentUser = user;
    return user;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getAllUsers() {
    return DEMO_USERS;
  }
}
