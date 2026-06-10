const BASE_URL = '';

async function request(method, path, data = null) {
  const opts = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  };
  if (data !== null) {
    opts.body = JSON.stringify(data);
  }
  const res = await fetch(`${BASE_URL}/api${path}`, opts);
  const json = await res.json();
  return json;
}

export const authApi = {
  login(username, password) {
    return request('POST', '/auth/login', { username, password });
  },
  logout() {
    return request('POST', '/auth/logout');
  },
  me() {
    return request('GET', '/auth/me');
  },
  roles() {
    return request('GET', '/auth/roles');
  },
};

export const orderApi = {
  list(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.append(k, v);
      }
    });
    return request('GET', `/material/orders?${params.toString()}`);
  },
  count(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.append(k, v);
      }
    });
    return request('GET', `/material/orders/count?${params.toString()}`);
  },
  statistics() {
    return request('GET', '/material/orders/statistics');
  },
  detail(id) {
    return request('GET', `/material/orders/${id}`);
  },
  records(id) {
    return request('GET', `/material/orders/${id}/records`);
  },
  exceptions(id) {
    return request('GET', `/material/orders/${id}/exceptions`);
  },
  attachments(id) {
    return request('GET', `/material/orders/${id}/attachments`);
  },
  bomRecords(id) {
    return request('GET', `/material/orders/${id}/bom-records`);
  },
  substituteRecords(id) {
    return request('GET', `/material/orders/${id}/substitute-records`);
  },
  pilotRecords(id) {
    return request('GET', `/material/orders/${id}/pilot-records`);
  },
  create(data) {
    return request('POST', '/material/orders', data);
  },
  update(id, data) {
    return request('PUT', `/material/orders/${id}`, data);
  },
  action(id, data) {
    return request('POST', `/material/orders/${id}/action`, data);
  },
  batchAction(data) {
    return request('POST', '/material/orders/batch-action', data);
  },
  saveEvidence(id, type, data) {
    return request('POST', `/material/orders/${id}/evidence/${type}`, data);
  },
  refreshWarnings() {
    return request('POST', '/material/orders/refresh-warnings');
  },
  metaStatus() {
    return request('GET', '/material/meta/status-options');
  },
  metaChangeType() {
    return request('GET', '/material/meta/change-type-options');
  },
  metaUrgency() {
    return request('GET', '/material/meta/urgency-options');
  },
  metaWarn() {
    return request('GET', '/material/meta/warn-options');
  },
};
