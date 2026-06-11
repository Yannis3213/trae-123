const API_BASE = '/api';

let currentUser = null;

export const setCurrentUser = (user) => {
  currentUser = user;
  if (user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
  } else {
    localStorage.removeItem('currentUser');
  }
};

export const getCurrentUser = () => {
  if (!currentUser) {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      currentUser = JSON.parse(stored);
    }
  }
  return currentUser;
};

export const logout = () => {
  currentUser = null;
  localStorage.removeItem('currentUser');
};

const getHeaders = () => {
  const user = getCurrentUser();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (user) {
    headers['X-User-Id'] = user.id;
    headers['X-User-Role'] = user.role;
  }
  return headers;
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
};

export const login = async (username, password) => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const user = await handleResponse(response);
  setCurrentUser(user);
  return user;
};

export const fetchOrders = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE}/orders${query ? `?${query}` : ''}`, {
    headers: getHeaders()
  });
  return handleResponse(response);
};

export const fetchOrderStats = async () => {
  const response = await fetch(`${API_BASE}/orders/stats`, {
    headers: getHeaders()
  });
  return handleResponse(response);
};

export const fetchOverdueQueue = async (status) => {
  const query = status ? `?status=${status}` : '';
  const response = await fetch(`${API_BASE}/orders/overdue-queue${query}`, {
    headers: getHeaders()
  });
  return handleResponse(response);
};

export const fetchOrderDetail = async (id) => {
  const response = await fetch(`${API_BASE}/orders/${id}`, {
    headers: getHeaders()
  });
  return handleResponse(response);
};

export const createOrder = async (data) => {
  const response = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
};

export const submitMaterial = async (id, data) => {
  const response = await fetch(`${API_BASE}/orders/${id}/submit-material`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
};

export const submitAcceptance = async (id, data) => {
  const response = await fetch(`${API_BASE}/orders/${id}/submit-acceptance`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
};

export const submitReview = async (id, data) => {
  const response = await fetch(`${API_BASE}/orders/${id}/submit-review`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
};

export const batchProcess = async (ids, action, data = {}) => {
  const response = await fetch(`${API_BASE}/orders/batch-process`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ids, action, data })
  });
  return handleResponse(response);
};

export const uploadAttachment = async (orderId, files, uploadType) => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  formData.append('upload_type', uploadType);
  
  const headers = {};
  const user = getCurrentUser();
  if (user) {
    headers['X-User-Id'] = user.id;
    headers['X-User-Role'] = user.role;
  }
  
  const response = await fetch(`${API_BASE}/orders/${orderId}/attachments`, {
    method: 'POST',
    headers,
    body: formData
  });
  return handleResponse(response);
};

export const addAuditNote = async (orderId, note) => {
  const response = await fetch(`${API_BASE}/orders/${orderId}/audit-notes`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ note })
  });
  return handleResponse(response);
};

export const fetchStores = async () => {
  const response = await fetch(`${API_BASE}/stores`, {
    headers: getHeaders()
  });
  return handleResponse(response);
};

export const fetchUsers = async () => {
  const response = await fetch(`${API_BASE}/users`, {
    headers: getHeaders()
  });
  return handleResponse(response);
};
