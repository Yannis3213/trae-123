import { apiFetch } from "./api";

export type UserRole = "financial_advisor" | "compliance_officer" | "branch_manager";

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  financial_advisor: "理财顾问",
  compliance_officer: "合规专员",
  branch_manager: "营业部经理",
};

export const DEMO_ACCOUNTS: Record<UserRole, { username: string; password: string }> = {
  financial_advisor: { username: "advisor1", password: "password123" },
  compliance_officer: { username: "compliance1", password: "password123" },
  branch_manager: { username: "manager1", password: "password123" },
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function removeToken() {
  localStorage.removeItem("token");
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User) {
  localStorage.setItem("user", JSON.stringify(user));
}

export function removeCurrentUser() {
  localStorage.removeItem("user");
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  setCurrentUser(data.user);
  return data;
}

export async function demoLogin(role: UserRole): Promise<{ token: string; user: User }> {
  const account = DEMO_ACCOUNTS[role];
  return login(account.username, account.password);
}

export function logout() {
  removeToken();
  removeCurrentUser();
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
