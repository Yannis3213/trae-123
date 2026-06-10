import { create } from 'zustand';
import type { User, VisibleScope } from '../types';
import { authApi } from '../api/client';

interface AuthState {
  user: User | null;
  token: string | null;
  allUsers: User[];
  visibleScope: VisibleScope | null;
  isLoading: boolean;
  error: string | null;

  login: (username: string) => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  fetchAllUsers: () => Promise<void>;
  fetchScope: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  allUsers: [],
  visibleScope: null,
  isLoading: false,
  error: null,

  login: async (username: string) => {
    set({ isLoading: true, error: null });
    try {
      const resp = await authApi.login({ username });
      localStorage.setItem('auth_token', resp.token);
      set({ user: resp.user, token: resp.token, isLoading: false });
      await get().fetchScope();
      await get().fetchAllUsers();
    } catch (e: any) {
      set({
        error: e.response?.data?.message || '登录失败',
        isLoading: false,
      });
    }
  },

  switchUser: async (userId: string) => {
    const { allUsers } = get();
    const target = allUsers.find((u) => u.id === userId);
    if (target) {
      const token = `token-${target.id}`;
      localStorage.setItem('auth_token', token);
      set({ user: target, token });
      await get().fetchScope();
    }
  },

  fetchAllUsers: async () => {
    try {
      const users = await authApi.listUsers();
      set({ allUsers: users });
    } catch (e) {
      console.error('Failed to fetch users:', e);
    }
  },

  fetchScope: async () => {
    try {
      const scope = await authApi.getScope();
      set({ visibleScope: scope });
    } catch (e) {
      console.error('Failed to fetch scope:', e);
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    set({ user: null, token: null, visibleScope: null });
  },

  clearError: () => set({ error: null }),
}));
