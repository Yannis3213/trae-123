import { signal, computed } from "@preact/signals";
import type { User, Token } from "./types.ts";
import { apiFetch } from "./api.ts";

export const accessToken = signal<string | null>(
  typeof localStorage !== "undefined" ? localStorage.getItem("access_token") : null
);

export const currentUser = signal<User | null>(null);

export const isLoggedIn = computed(() => !!accessToken.value && !!currentUser.value);

export function setAuth(tokenData: Token) {
  accessToken.value = tokenData.access_token;
  currentUser.value = tokenData.user;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("access_token", tokenData.access_token);
    localStorage.setItem("current_user", JSON.stringify(tokenData.user));
  }
}

export function clearAuth() {
  accessToken.value = null;
  currentUser.value = null;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("current_user");
  }
}

export async function restoreAuth() {
  if (typeof localStorage === "undefined") return;
  const token = localStorage.getItem("access_token");
  const userStr = localStorage.getItem("current_user");
  if (token && userStr) {
    try {
      const user = JSON.parse(userStr) as User;
      currentUser.value = user;
      accessToken.value = token;
    } catch {
      clearAuth();
    }
  }
}

export async function login(username: string, password: string): Promise<Token> {
  const result = await apiFetch<Token>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setAuth(result);
  return result;
}

export function logout() {
  clearAuth();
}
