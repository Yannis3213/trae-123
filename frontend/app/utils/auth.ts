import { createContext, useContext } from "react";
import { api } from "./api";
import type { User, LoginRequest, LoginResponse, UserRole } from "./types";

const USER_KEY = "current_user";
const TOKEN_KEY = "token";

export interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  switchRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  switchRole: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export { AuthContext };

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User, token: string): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearCurrentUser(): void {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export async function login(username: string, password: string): Promise<User> {
  const res = await api.post<LoginResponse>("/auth/login", {
    username,
    password,
  } as LoginRequest);
  const user: User = {
    id: res.user_id,
    name: res.name,
    role: res.role as UserRole,
  };
  setCurrentUser(user, res.token);
  return user;
}

export function logout(): void {
  clearCurrentUser();
}

export function hasRole(user: User | null, role: UserRole): boolean {
  return user?.role === role;
}

export function isDutyOfficer(user: User | null): boolean {
  return hasRole(user, "duty_officer");
}

export function isMaintenanceEngineer(user: User | null): boolean {
  return hasRole(user, "maintenance_engineer");
}

export function isOperationsManager(user: User | null): boolean {
  return hasRole(user, "operations_manager");
}
