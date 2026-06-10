const BACKEND_PORT = Deno.env.get("BACKEND_PORT") || "8001";
const API_BASE = `http://localhost:${BACKEND_PORT}`;

export function getApiBase(): string {
  return API_BASE;
}

function getToken(): string | null {
  if (typeof document !== "undefined") {
    return localStorage.getItem("access_token");
  }
  return null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof document !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("current_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    throw new Error("未授权，请先登录");
  }

  const text = await response.text();
  let data: T;
  try {
    data = text ? JSON.parse(text) as T : ({} as T);
  } catch {
    data = {} as T;
  }

  if (!response.ok) {
    const err = (data as any)?.detail || (data as any)?.message || `请求失败: ${response.status}`;
    throw new Error(err);
  }

  return data;
}
