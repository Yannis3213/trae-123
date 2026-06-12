const API_BASE = '/api';

async function request(url, options = {}) {
	const token = localStorage.getItem('token');
	
	const headers = {
		'Content-Type': 'application/json',
		...options.headers
	};
	
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}
	
	const response = await fetch(`${API_BASE}${url}`, {
		...options,
		headers
	});
	
	const data = await response.json();
	
	if (!response.ok) {
		throw new Error(data.message || '请求失败');
	}
	
	return data;
}

export const api = {
	login: (username, password) => 
		request('/auth/login', {
			method: 'POST',
			body: JSON.stringify({ username, password })
		}),
	
	getMe: () => request('/auth/me'),
	
	getApplications: (params = {}) => {
		const query = new URLSearchParams();
		Object.entries(params).forEach(([k, v]) => {
			if (v !== undefined && v !== null && v !== '') {
				query.append(k, v);
			}
		});
		return request(`/applications?${query.toString()}`);
	},
	
	getApplication: (id) => request(`/applications/${id}`),
	
	createApplication: (data) =>
		request('/applications', {
			method: 'POST',
			body: JSON.stringify(data)
		}),
	
	processApplication: (id, data) =>
		request(`/applications/${id}/process`, {
			method: 'POST',
			body: JSON.stringify(data)
		}),
	
	batchProcess: (data) =>
		request('/applications/batch-process', {
			method: 'POST',
			body: JSON.stringify(data)
		}),
	
	getStatistics: () => request('/statistics'),
	
	health: () => request('/health')
};

export const statusMap = {
	draft: { label: '草稿', color: '#999' },
	pending_verify: { label: '待核验', color: '#faad14' },
	pending_correction: { label: '待补正', color: '#ff4d4f' },
	verify_passed: { label: '核验通过', color: '#52c41a' },
	verify_failed: { label: '核验失败', color: '#ff4d4f' },
	overdue: { label: '已逾期', color: '#ff4d4f' },
	archived: { label: '已归档', color: '#1890ff' }
};

export const nodeMap = {
	register: { label: '登记中', order: 1 },
	register_done: { label: '登记完成', order: 2 },
	verify_rejected: { label: '核验退回', order: 3 },
	verify_done: { label: '核验完成', order: 4 },
	review_returned: { label: '复核退回', order: 5 },
	review_done: { label: '复核完成', order: 6 }
};

export const warningLevelMap = {
	normal: { label: '正常', color: '#52c41a' },
	warning: { label: '临期', color: '#faad14' },
	overdue: { label: '逾期', color: '#ff4d4f' }
};

export const verifyStatusMap = {
	pending: { label: '待核验', color: '#faad14' },
	passed: { label: '已通过', color: '#52c41a' },
	failed: { label: '未通过', color: '#ff4d4f' }
};

export const roleMap = {
	register: { label: '融资申请登记员', name: '客户运营' },
	auditor: { label: '融资申请审核主管', name: '风控审核' },
	reviewer: { label: '供应链金融平台复核负责人', name: '资金经理' }
};

export const exceptionTypeMap = {
	missing_material: { label: '材料缺失', color: '#ff4d4f' },
	reject_correction: { label: '退回补正', color: '#faad14' },
	overdue: { label: '逾期', color: '#ff4d4f' },
	invoice_verify_pending: { label: '发票核验待完成', color: '#faad14' },
	status_conflict: { label: '状态冲突', color: '#ff4d4f' },
	permission_denied: { label: '权限不足', color: '#ff4d4f' },
	version_conflict: { label: '版本冲突', color: '#faad14' },
	duplicate_submit: { label: '重复提交', color: '#faad14' }
};

export function formatMoney(amount) {
	if (amount === undefined || amount === null) return '-';
	return Number(amount).toLocaleString('zh-CN', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
}

export function formatDate(dateStr) {
	if (!dateStr) return '-';
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return '-';
	return d.toLocaleString('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
}
