import { ROLE_USERS, type User, type UserRole } from './types';

const USER_STORAGE_KEY = 'patrol_current_user';
const ROLE_STORAGE_KEY = 'patrol_current_role';

export function getCurrentRole(): UserRole {
  if (typeof window !== 'undefined') {
    const role = localStorage.getItem(ROLE_STORAGE_KEY) as UserRole | null;
    return role || 'inspector';
  }
  return 'inspector';
}

export function getCurrentUser(): User {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem(USER_STORAGE_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        // fall through
      }
    }
  }
  const role = getCurrentRole();
  const user = ROLE_USERS[role][0];
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
  return user;
}

export function setCurrentRole(role: UserRole): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
    const user = ROLE_USERS[role][0];
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
}

export function setCurrentUser(user: User): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(ROLE_STORAGE_KEY, user.role);
  }
}

export function getUsersByRole(role: UserRole): User[] {
  return ROLE_USERS[role];
}

export function hasPermission(action: string): boolean {
  const user = getCurrentUser();
  const role = user.role;

  switch (action) {
    case 'create_patrol':
      return role === 'inspector' || role === 'admin';
    case 'batch_process':
      return role === 'engineer' || role === 'manager' || role === 'admin';
    case 'batch_close_overdue':
      return role === 'manager' || role === 'admin';
    case 'dispatch':
      return role === 'manager' || role === 'admin';
    case 'handle_inspector':
      return role === 'inspector' || role === 'admin';
    case 'handle_engineer':
      return role === 'engineer' || role === 'admin';
    case 'handle_manager':
      return role === 'manager' || role === 'admin';
    case 'return_order':
      return role === 'engineer' || role === 'manager' || role === 'admin';
    case 'view_all':
      return true;
    default:
      return false;
  }
}
