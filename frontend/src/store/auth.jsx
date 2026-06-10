import { createContext, useContext, createSignal, createEffect, onMount } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';

const BASE = '/api';

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const userId = localStorage.getItem('user_id');
  if (userId) headers['X-User-Id'] = userId;

  try {
    const res = await fetch(BASE + path, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json();
    return data;
  } catch (e) {
    return { success: false, error: { message: '网络请求失败: ' + e.message, code: 'NETWORK', type: '系统错误' } };
  }
}

export const api = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  listUsers: () => request('/auth/users'),

  listCustomers: (keyword) => request(`/customers${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`),
  getCustomer: (id) => request(`/customers/${id}`),
  updateCustomer: (id, data) => request(`/customers/${id}`, { method: 'PUT', body: data }),

  listPricing: (keyword) => request(`/pricing${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`),
  getPricing: (id) => request(`/pricing/${id}`),
  updatePricing: (id, data) => request(`/pricing/${id}`, { method: 'PUT', body: data }),

  listContracts: (params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/contracts${qs ? `?${qs}` : ''}`);
  },
  getContractStats: () => request('/contracts/stats'),
  getContract: (id) => request(`/contracts/${id}`),
  createContract: (data) => request('/contracts', { method: 'POST', body: data }),
  processContract: (data) => request('/contracts/process', { method: 'POST', body: data }),
  batchProcess: (data) => request('/contracts/batch', { method: 'POST', body: data }),
  getOverdueResponsibles: () => request('/contracts/overdue-responsibles'),
  addAttachment: (contractId, data) => request(`/contracts/${contractId}/attachments`, { method: 'POST', body: data }),
  health: () => request('/health'),
};

export const AuthContext = createContext();

export function AuthProvider(props) {
  const [user, setUser] = createSignal(null);
  const [users, setUsers] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const navigate = useNavigate();
  const location = useLocation();

  onMount(async () => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
    const r = await api.listUsers();
    if (r.success) setUsers(r.data);
    setLoading(false);
  });

  async function login(username, password) {
    const r = await api.login(username, password);
    if (r.success) {
      setUser(r.user);
      localStorage.setItem('user', JSON.stringify(r.user));
      localStorage.setItem('user_id', r.user.id);
      localStorage.setItem('token', r.token);
      return { ok: true };
    }
    return { ok: false, message: r.error?.message };
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('user_id');
    localStorage.removeItem('token');
    navigate('/login');
  }

  function switchTo(uid) {
    const target = users().find(u => u.id === uid);
    if (target) {
      setUser(target);
      localStorage.setItem('user', JSON.stringify(target));
      localStorage.setItem('user_id', target.id);
    }
  }

  createEffect(() => {
    if (loading()) return;
    if (!user() && location.pathname !== '/login') {
      navigate('/login');
    } else if (user() && location.pathname === '/login') {
      navigate('/');
    }
  });

  return (
    <AuthContext.Provider value={{ user, users, login, logout, switchTo, loading }}>
      {props.children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export const STATUS_TAGS = {
  '待提交': 'tag-primary',
  '待审核': 'tag-warning',
  '待复核': 'tag-purple',
  '已退回': 'tag-danger',
  '重新提交': 'tag-info',
  '已完成': 'tag-success',
};

export const STAGE_NAMES = {
  'customer_manager': '客户经理',
  'trade_specialist': '交易专员',
  'risk_manager': '风控经理',
  'completed': '已完成',
  'closed': '已关闭',
};

export const ROLE_NAMES = {
  'customer_manager': '客户经理',
  'trade_specialist': '交易专员',
  'risk_manager': '风控经理',
  'admin': '系统管理员',
};

export const ACTION_NAMES = {
  'submit': '提交审核',
  'approve': '审核通过',
  'finalize': '复核完成',
  'return': '退回补正',
  'reject': '驳回',
  'resubmit': '重新提交',
};

export const WARNING_LABEL = {
  'normal': '正常',
  'warning': '临期',
  'overdue': '逾期',
};
