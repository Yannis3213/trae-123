import type { User } from '../../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

class AuthStore {
  private state: AuthState;

  constructor() {
    const token = this.getStoredToken();
    const user = this.getStoredUser();
    this.state = {
      user,
      token,
      isAuthenticated: !!token,
    };
  }

  private getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  private getStoredUser(): User | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  private storeToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
  }

  private storeUser(user: User): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  private clearStorage(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  login(token: string, user: User): void {
    this.storeToken(token);
    this.storeUser(user);
    this.state = {
      user,
      token,
      isAuthenticated: true,
    };
  }

  logout(): void {
    this.clearStorage();
    this.state = {
      user: null,
      token: null,
      isAuthenticated: false,
    };
  }

  updateUser(user: User): void {
    this.storeUser(user);
    this.state.user = user;
  }

  getState(): AuthState {
    return { ...this.state };
  }

  getToken(): string | null {
    return this.state.token;
  }

  getUser(): User | null {
    return this.state.user;
  }

  isLoggedIn(): boolean {
    return this.state.isAuthenticated;
  }
}

export const authStore = new AuthStore();

export default authStore;
