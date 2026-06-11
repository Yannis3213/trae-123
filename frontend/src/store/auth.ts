import { createSignal } from 'solid-js';
import type { User, UserRole } from '../types';
import { setToken, removeToken, getToken } from '../api/client';
import { login as apiLogin, getMe } from '../api/auth';
import { DEMO_ACCOUNTS } from '../utils/role';

const USER_KEY = 'auth_user';

const [user, setUserSignal] = createSignal<User | null>(null);
const [isLoading, setIsLoading] = createSignal(false);

const persistUser = (u: User | null) => {
  if (typeof window === 'undefined') return;
  if (u) {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  } else {
    localStorage.removeItem(USER_KEY);
  }
};

const loadPersistedUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(USER_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    return null;
  }
  return null;
};

export const setUser = (u: User | null) => {
  setUserSignal(u);
  persistUser(u);
};

export const login = async (username: string, password: string): Promise<User> => {
  setIsLoading(true);
  try {
    const response = await apiLogin({ username, password });
    setToken(response.token);
    setUser(response.user);
    return response.user;
  } finally {
    setIsLoading(false);
  }
};

export const loginWithDemo = async (role: UserRole): Promise<User> => {
  const account = DEMO_ACCOUNTS.find((a) => a.role === role);
  if (!account) {
    throw new Error('无效的角色');
  }
  return login(account.username, account.password);
};

export const logout = async () => {
  setUser(null);
  removeToken();
};

export const fetchMe = async (): Promise<User | null> => {
  const token = getToken();
  if (!token) return null;

  setIsLoading(true);
  try {
    const userData = await getMe();
    setUser(userData);
    return userData;
  } catch {
    const persisted = loadPersistedUser();
    if (persisted) {
      setUser(persisted);
      return persisted;
    }
    setUser(null);
    removeToken();
    return null;
  } finally {
    setIsLoading(false);
  }
};

if (typeof window !== 'undefined') {
  const persisted = loadPersistedUser();
  if (persisted) {
    setUserSignal(persisted);
  }
}

export { user, isLoading };
