import { Injectable, Scope, HttpException, HttpStatus } from '@nestjs/common';
// @ts-ignore
import { AsyncLocalStorage } from 'async_hooks';

export const DEMO_USERS: { id: number; username: string; role: 'registrar' | 'reviewer' | 'director'; name: string }[] = [
  { id: 1, username: 'registrar', role: 'registrar', name: '张晓明' },
  { id: 2, username: 'reviewer', role: 'reviewer', name: '李审核' },
  { id: 3, username: 'director', role: 'director', name: '王总监' },
];

export interface CurrentUser {
  id: number;
  username: string;
  role: 'registrar' | 'reviewer' | 'director';
  name: string;
}

export const userAsyncLocalStorage = new AsyncLocalStorage<CurrentUser>();

@Injectable({ scope: Scope.DEFAULT })
export class AuthService {
  login(username: string) {
    const user = DEMO_USERS.find((u) => u.username === username);
    if (!user) return null;
    return user;
  }

  switchRole(role: string) {
    const user = DEMO_USERS.find((u) => u.role === role);
    if (!user) return null;
    return user;
  }

  getCurrentUser(): CurrentUser {
    const user = userAsyncLocalStorage.getStore();
    if (user) return user;
    throw new HttpException('未登录', HttpStatus.UNAUTHORIZED);
  }

  getAllUsers() {
    return DEMO_USERS;
  }
}

export function resolveUserFromHeaders(headers: Record<string, any>): CurrentUser | null {
  const role = headers['x-user-role'];
  const name = headers['x-user-name'];
  const id = headers['x-user-id'];

  if (role && name && id) {
    const matched = DEMO_USERS.find(
      (u) => u.role === role && u.name === name && u.id === parseInt(id, 10),
    );
    if (matched) return matched;
  }

  const headerUser = headers['x-demo-user'];
  if (headerUser) {
    const found = DEMO_USERS.find((u) => u.username === headerUser);
    if (found) return found;
  }

  return null;
}
