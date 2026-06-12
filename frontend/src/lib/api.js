const API_BASE = '/api';

let currentActingRole = null;

export function setActingRole(role) {
	currentActingRole = role;
	if (role) {
		localStorage.setItem('acting_role', role);
	} else {
		localStorage.removeItem('acting_role');
	}
}

export function getActingRole() {
	if (!currentActingRole) {
		currentActingRole = localStorage.getItem('acting_role');
	}
	return currentActingRole;
}

async function request(url, options = {}) {
	const token = localStorage.getItem('token');
	const role = getActingRole();
	
	const headers = {
		'Content-Type': 'application/json',
		...options.headers
	};
	
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}
	if (role) {
		headers['X-Acting-Role'] = role;
	}
	
	let finalUrl = url;
	if (role && options.method !== 'POST') {
		const sep = finalUrl.includes('?') ? '&' : '?';
		finalUrl = `${finalUrl}${sep}acting_role=${encodeURIComponent(role)}`;
	}
	
	const response = await fetch(`${API_BASE}${finalUrl}`, {
		...options,
		headers
	});
	
	const data = await response.json();
	
	if (!response.ok) {
		throw new Error(data.message || '请求失败');
	}
	
	return data;
}

function injectActingRole(data) {
	const role = getActingRole();
	if (role && typeof data === 'object' && data !== null) {
		return { ...data, acting_role: role };
	}
	return role ? { acting_role: role, ...data } : data;
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
		const role = getActingRole();
		if (role && !params.acting_role) {
			query.append('acting_role', role);
		}
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
			body: JSON.stringify(injectActingRole(data))
		}),
	
	processApplication: (id, data) =>
		request(`/applications/${id}/process`, {
			method: 'POST',
			body: JSON.stringify(injectActingRole(data))
		}),
	
	batchProcess: (data) =>
		request('/applications/batch-process', {
			method: 'POST',
			body: JSON.stringify(injectActingRole(data))
		}),
	
	getStatistics: (actingRole) => {
		const role = actingRole || getActingRole();
		const qs = role ? `?acting_role=${encodeURIComponent(role)}` : '';
		return request(`/statistics${qs}`);
	},
	
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

export const loanStatusMap = {
	pending: { label: '待确认', color: '#faad14' },
	confirmed: { label: '已放款', color: '#52c41a' },
	rejected: { label: '已拒绝', color: '#ff4d4f' }
};

export const roleMap = {
	register: { label: '融资申请登记员', name: '客户运营' },
	auditor: { label: '融资申请审核主管', name: '风控审核' },
	reviewer: { label: '供应链金融平台复核负责人', name: '资金经理' }
};

export const exceptionTypeMap = {
	missing_material: { label: '材料缺失', color: '#ff4d4f' },
	reject_correction: { label: '审核退回补正', color: '#faad14' },
	review_return: { label: '复核退回补正', color: '#faad14' },
	overdue: { label: '节点逾期', color: '#ff4d4f' },
	invoice_verify_pending: { label: '发票核验待完成', color: '#faad14' },
	status_conflict: { label: '状态冲突', color: '#ff4d4f' },
	permission_denied: { label: '权限不足', color: '#ff4d4f' },
	version_conflict: { label: '版本冲突', color: '#faad14' },
	duplicate_submit: { label: '重复提交', color: '#faad14' },
	missing_evidence: { label: '缺少必填证据', color: '#ff4d4f' }
};

export const evidenceTypeMap = {
	contract: { label: '购销合同', required: true },
	invoice: { label: '增值税发票', required: true },
	invoice_list: { label: '发票清单', required: false },
	loan_voucher: { label: '放款凭证', required: false },
	bank_statement: { label: '银行流水', required: false },
	tax_certificate: { label: '纳税证明', required: false }
};

export const actionMap = {
	create: { label: '创建', color: '#1890ff' },
	submit: { label: '提交核验', color: '#1890ff' },
	pass: { label: '核验通过', color: '#52c41a' },
	reject: { label: '退回补正', color: '#ff4d4f' },
	resubmit: { label: '重新提交', color: '#1890ff' },
	archive: { label: '复核归档', color: '#52c41a' },
	return: { label: '复核退回', color: '#ff4d4f' },
	note: { label: '添加备注', color: '#999' }
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

export function getSeverityClass(severity) {
	switch (severity) {
		case 'error': return 'bg-red-100 text-red-700 border-red-200';
		case 'warning': return 'bg-orange-100 text-orange-700 border-orange-200';
		default: return 'bg-gray-100 text-gray-700 border-gray-200';
	}
}
