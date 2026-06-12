export type UserRole = "dispatcher" | "supervisor" | "manager";

interface AuthState {
  token: string;
  role: UserRole;
  username: string;
}

let authState: AuthState | null = null;

export function getAuth(): AuthState | null {
  return authState;
}

export function setAuthState(val: AuthState | null) {
  authState = val;
}

export function loadAuthFromStorage() {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role") as UserRole | null;
  const username = localStorage.getItem("username");
  if (token && role && username) {
    authState = { token, role, username };
  } else {
    authState = null;
  }
}

export function setAuth(data: { token: string; role: UserRole; username: string }) {
  if (typeof window === "undefined") return;
  localStorage.setItem("token", data.token);
  localStorage.setItem("role", data.role);
  localStorage.setItem("username", data.username);
  authState = data;
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("username");
  authState = null;
}

export function isLoggedIn(): boolean {
  return authState !== null;
}

export function getRole(): UserRole | null {
  return authState?.role ?? null;
}

export function getUsername(): string | null {
  return authState?.username ?? null;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  dispatcher: "派单客服",
  supervisor: "服务督导",
  manager: "城市经理",
};
