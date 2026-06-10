import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  dispatcher: '发车登记员',
  route_supervisor: '发车审核主管',
  ops_center: '复核负责人',
};

interface User {
  id: string;
  username: string;
  role: string;
  displayName: string;
}

interface AuthState {
  currentUser: User | null;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: string) => Promise<void>;
}

export { ROLE_DISPLAY_NAMES };
export type { User, AuthState };

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isLoggedIn: false,

      login: async (username: string, password: string) => {
        const res = await fetch('http://localhost:8002/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        if (!res.ok) throw new Error('登录失败');
        const json = await res.json();
        const userData = json.data;
        const user: User = {
          id: userData.id,
          username: userData.username,
          role: userData.role,
          displayName: userData.displayName || ROLE_DISPLAY_NAMES[userData.role] || userData.role,
        };
        set({ currentUser: user, isLoggedIn: true });
      },

      logout: () => {
        set({ currentUser: null, isLoggedIn: false });
      },

      switchRole: async (role: string) => {
        const roleCredentials: Record<string, { username: string; password: string }> = {
          dispatcher: { username: 'dispatcher', password: 'demo123' },
          route_supervisor: { username: 'route_supervisor', password: 'demo123' },
          ops_center: { username: 'ops_center', password: 'demo123' },
        };
        const creds = roleCredentials[role];
        if (!creds) return;
        await get().login(creds.username, creds.password);
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
