import { Injectable, Scope, HttpException, HttpStatus } from '@nestjs/common';
// @ts-ignore
import { AsyncLocalStorage } from 'async_hooks';

const DEMO_USERS = [
  { id: 1, username: 'registrar', role: 'registrar' as const, name: '张晓明' },
  { id: 2, username: 'reviewer', role: 'reviewer' as const, name: '李审核' },
  { id: 3, username: 'director', role: 'director' as const, name: '王总监' },
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

  if (role && name) {
    const matched = DEMO_USERS.find((u) => u.role === role && u.name === name);
    if (matched) return matched;
    return {
      id: parseInt(id, 10) || 0,
      username: role,
      role: role as any,
      name: name,
    };
  }

  const headerUser = headers['x-demo-user'];
  if (headerUser) {
    const found = DEMO_USERS.find((u) => u.username === headerUser);
    if (found) return found;
  }

  return null;
}
