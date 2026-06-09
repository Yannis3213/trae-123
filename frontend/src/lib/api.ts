const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8004/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
    cache: 'no-store',
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }
  return data.data as T;
}

export const api = {
  listRoles: () => request('/roles'),
  listBorrowRecords: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/borrow-records${qs}`);
  },
  getBorrowRecord: (id: string) => request(`/borrow-records/${id}`),
  createBorrowRecord: (body: unknown) =>
    request('/borrow-records', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  processBorrowRecord: (id: string, body: unknown) =>
    request(`/borrow-records/${id}/process`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  batchProcess: (body: unknown) =>
    request('/borrow-records/batch-process', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getAuditNotes: (id: string) => request(`/borrow-records/${id}/audit-notes`),
  getProcessHistory: (id: string) => request(`/borrow-records/${id}/process-history`),
  listReaders: () => request('/readers'),
  getReader: (id: string) => request(`/readers/${id}`),
  getStatistics: () => request('/statistics'),
};
