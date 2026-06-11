const API_BASE = 'http://localhost:8002';

export async function apiFetch(path: string, options?: RequestInit, token?: string) {
  const headers: any = { 'Content-Type': 'application/json', ...(options?.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || `API Error: ${res.status}`);
  }
  return res.json();
}
