import { createSignal, createContext, useContext } from 'solid-js';
import type { User, Role } from '@/types';
import { login as apiLogin } from '@/api';

interface AuthContextType {
  user: () => User | null;
  login: (role: Role, username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>();

export function AuthProvider(props: { children: any }) {
  const stored = localStorage.getItem('user');
  const [user, setUser] = createSignal<User | null>(
    stored ? (JSON.parse(stored) as User) : null
  );

  const login = async (role: Role, username: string, password: string) => {
    const res = await apiLogin({ role, username, password });
    if (res.data) {
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data));
      setUser(res.data);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {props.children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
