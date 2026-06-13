export const API_BASE = '';

export const STATUS_MAP = {
  PENDING_SUBMIT: { label: '待提交', color: '#909399', bg: '#f4f4f5' },
  PENDING_AUDIT: { label: '待审核', color: '#e6a23c', bg: '#fdf6ec' },
  PENDING_REVIEW: { label: '待复核', color: '#409eff', bg: '#ecf5ff' },
  AUDITED_PASSED: { label: '审核通过', color: '#67c23a', bg: '#f0f9eb' },
  RETURNED: { label: '退回补正', color: '#f56c6c', bg: '#fef0f0' },
  SYNCED: { label: '已同步', color: '#606266', bg: '#f0f2f5' },
};

export const ROLE_MAP = {
  REGISTRAR: { label: '护登记员', color: '#409eff' },
  AUDITOR: { label: '照护审核主管', color: '#67c23a' },
  REVIEWER: { label: '养老护理院复核负责人', color: '#909399' },
};

export const EVIDENCE_STATE_MAP = {
  COMPLETE: { label: '证据齐全', color: '#67c23a', bg: '#f0f9eb' },
  MISSING: { label: '缺证据', color: '#f56c6c', bg: '#fef0f0' },
  OVERDUE_PENDING: { label: '逾期待处理', color: '#e6a23c', bg: '#fdf6ec' },
  ARCHIVED: { label: '已归档', color: '#909399', bg: '#f4f4f5' },
};

export function formatDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function formatShortDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function daysUntil(d) {
  if (!d) return 999;
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
