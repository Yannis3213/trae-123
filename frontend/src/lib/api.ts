const API_BASE = 'http://localhost:8001/api';

let currentUser: { id: string; username: string; displayName: string; role: string; token: string } | null = null;

export function getCurrentUser() {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('agri_user');
    if (stored) {
      currentUser = JSON.parse(stored);
    }
  }
  return currentUser;
}

export function setCurrentUser(user: typeof currentUser) {
  currentUser = user;
  if (typeof window !== 'undefined') {
    if (user) {
      localStorage.setItem('agri_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('agri_user');
    }
  }
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const user = getCurrentUser();
  if (user) {
    headers['x-user-id'] = user.id;
    headers['x-user-role'] = user.role;
  }
  return headers;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: '请求失败' }));
    throw { status: res.status, ...data };
  }

  if (res.headers.get('content-type')?.includes('text/csv')) {
    return res.text() as any;
  }

  return res.json();
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    current: () => request('/auth/current'),
    users: () => request('/auth/users'),
  },
  tasks: {
    list: (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request(`/planting-tasks${query}`);
    },
    statistics: () => request('/planting-tasks/statistics'),
    detail: (id: string) => request(`/planting-tasks/${id}`),
    create: (data: any) => request('/planting-tasks', { method: 'POST', body: JSON.stringify(data) }),
    assign: (id: string, data: any) => request(`/planting-tasks/${id}/assign`, { method: 'PATCH', body: JSON.stringify(data) }),
    process: (id: string, data: any) => request(`/planting-tasks/${id}/process`, { method: 'PATCH', body: JSON.stringify(data) }),
    transfer: (id: string, data: any) => request(`/planting-tasks/${id}/transfer`, { method: 'PATCH', body: JSON.stringify(data) }),
    followUp: (id: string, data: any) => request(`/planting-tasks/${id}/follow-up`, { method: 'PATCH', body: JSON.stringify(data) }),
    archive: (id: string, data: any) => request(`/planting-tasks/${id}/archive`, { method: 'PATCH', body: JSON.stringify(data) }),
    returnForCorrection: (id: string, data: any) => request(`/planting-tasks/${id}/return`, { method: 'PATCH', body: JSON.stringify(data) }),
    batchProcess: (data: any) => request('/planting-tasks/batch-process', { method: 'POST', body: JSON.stringify(data) }),
    auditLogs: (id: string) => request(`/planting-tasks/${id}/audit-logs`),
    processingRecords: (id: string) => request(`/planting-tasks/${id}/processing-records`),
  },
  materials: {
    listByTask: (taskId: string) => request(`/material-requisitions/task/${taskId}`),
    create: (data: any) => request('/material-requisitions', { method: 'POST', body: JSON.stringify(data) }),
    approve: (id: string) => request(`/material-requisitions/${id}/approve`, { method: 'PATCH' }),
    reject: (id: string, remarks: string) => request(`/material-requisitions/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ remarks }) }),
  },
  fieldRecords: {
    listByTask: (taskId: string) => request(`/field-records/task/${taskId}`),
    create: (data: any) => request('/field-records', { method: 'POST', body: JSON.stringify(data) }),
  },
  auditLogs: {
    list: (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request(`/audit-logs${query}`);
    },
  },
  overdueQueue: {
    list: () => request('/overdue-queue'),
    batchAdvance: (data: any) => request('/overdue-queue/batch-advance', { method: 'POST', body: JSON.stringify(data) }),
  },
  export: {
    tasks: async (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      const res = await fetch(`${API_BASE}/export/planting-tasks${query}`, {
        headers: getHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: '导出失败' }));
        throw { status: res.status, ...data };
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      a.download = `种植任务_${timestamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
  },
};

export const ROLE_LABELS: Record<string, string> = {
  agricultural_technician: '农技员',
  cooperative_director: '合作社主任',
  field_manager: '田间管理员',
};

export const STATUS_LABELS: Record<string, string> = {
  pending_assign: '待分派',
  assigned: '已分派',
  processing: '处理中',
  transferred: '已转办',
  followed_up: '已回访',
  archived: '已归档',
  returned_for_correction: '退回补正',
};

export const STATUS_BADGE_CLASS: Record<string, string> = {
  pending_assign: 'badge-pending',
  assigned: 'badge-assigned',
  processing: 'badge-processing',
  transferred: 'badge-transferred',
  followed_up: 'badge-followed',
  archived: 'badge-archived',
  returned_for_correction: 'badge-returned',
};

export const OVERDUE_LABELS: Record<string, string> = {
  normal: '正常',
  near_expiry: '临期',
  overdue: '逾期',
};

export const FIELD_RECORD_TYPE_LABELS: Record<string, string> = {
  sowing: '播种',
  fertilizing: '施肥',
  pest_control: '病虫害防治',
  harvesting: '收获',
  inspection: '巡检',
  other: '其他',
};
