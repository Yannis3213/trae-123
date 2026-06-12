import { createContext, useContext, Show, createEffect, type JSX } from 'solid-js';
import { currentUser, setUser, clearUser, switchRole, initialized } from '../store/auth';
import type { Role } from '../utils/api';
import { ROLE_LABELS, apiFetch, setAuthHeaderProvider } from '../utils/api';

const AuthContext = createContext<{
  user: typeof currentUser;
  login: (username: string) => Promise<void>;
  logout: () => void;
  switchTo: (role: Role) => Promise<void>;
  initialized: typeof initialized;
} | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider(props: { children: JSX.Element }) {
  createEffect(() => {
    setAuthHeaderProvider(() => {
      const u = currentUser();
      return u ? { 'X-User-Role': u.role, 'X-User-Name': u.name, 'X-User-Id': String(u.id) } : {};
    });
  });

  const login = async (username: string) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    if (res.code === 0 && res.data) {
      setUser(res.data);
    } else {
      throw new Error(res.message);
    }
  };

  const logout = () => {
    clearUser();
  };

  const switchTo = async (role: Role) => {
    const res = await apiFetch('/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    if (res.code === 0 && res.data) {
      setUser(res.data);
    } else {
      const user = switchRole(role);
      setUser(user);
    }
  };

  const contextValue = {
    user: currentUser,
    login,
    logout,
    switchTo,
    initialized,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      <Show when={initialized()} fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div style={{ color: '#999' }}>初始化中...</div>
        </div>
      }>
        {props.children}
      </Show>
    </AuthContext.Provider>
  );
}

export function RoleSwitcher() {
  const { user, switchTo, logout } = useAuth();
  const roles: Role[] = ['registrar', 'reviewer', 'director'];

  return (
    <div class="flex items-center gap-3 px-4 py-2 bg-[var(--color-primary)] text-white">
      <div class="flex items-center gap-2 flex-1">
        <span class="text-sm font-medium">公关传播团队 - 传播计划单系统</span>
        <span class="text-xs text-gray-400">|</span>
        <span class="text-xs text-[var(--color-accent)]">
          当前角色：{user()?.name}（{ROLE_LABELS[user()?.role || 'registrar']}）
        </span>
      </div>
      <div class="flex items-center gap-2">
        {roles.map((r) => (
          <button
            class={`text-xs px-3 py-1 rounded ${
              user()?.role === r
                ? 'bg-[var(--color-accent)] text-[var(--color-primary)] font-bold'
                : 'bg-white/10 hover:bg-white/20'
            }`}
            onClick={() => switchTo(r)}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
        <button
          class="text-xs px-3 py-1 rounded bg-white/10 hover:bg-white/20 ml-2"
          onClick={logout}
        >
          退出
        </button>
      </div>
    </div>
  );
}
