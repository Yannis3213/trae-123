import { createSignal, createEffect } from 'solid-js';
import type { User, Role } from '../utils/api';

const [currentUser, setCurrentUser] = createSignal<User | null>(null);
const [initialized, setInitialized] = createSignal(false);

createEffect(() => {
  const stored = localStorage.getItem('pr_user');
  if (stored) {
    try {
      setCurrentUser(JSON.parse(stored));
    } catch {}
  }
  setInitialized(true);
});

export { currentUser, initialized };

export function setUser(user: User) {
  setCurrentUser(user);
  localStorage.setItem('pr_user', JSON.stringify(user));
}

export function clearUser() {
  setCurrentUser(null);
  localStorage.removeItem('pr_user');
}

export function switchRole(role: Role) {
  const roleUserMap: Record<Role, User> = {
    registrar: { id: 1, username: 'registrar', role: 'registrar', name: '张晓明' },
    reviewer: { id: 2, username: 'reviewer', role: 'reviewer', name: '李审核' },
    director: { id: 3, username: 'director', role: 'director', name: '王总监' },
  };
  const user = roleUserMap[role];
  setUser(user);
  return user;
}
