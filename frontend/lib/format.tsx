import dayjs from 'dayjs';

export function fmtTime(s?: string | null) {
  if (!s) return '—';
  return dayjs(s).format('YYYY-MM-DD HH:mm');
}
export function fmtDate(s?: string | null) {
  if (!s) return '—';
  return dayjs(s).format('YYYY-MM-DD');
}
export function fmtAmount(v?: number | null) {
  if (v == null) return '¥0.00';
  return `¥${v.toFixed(2)}`;
}
export function urgencyBadge(level: string, label: string) {
  const cls = {
    normal: 'urgency-normal',
    warning: 'urgency-warning',
    overdue: 'urgency-overdue',
    none: '',
  }[level as string] || '';
  return <span className={`urgency-tag ${cls}`}>{label}</span>;
}
export function statusBadge(status: string, label: string) {
  const cls = `status-${status}`;
  return <span className={`status-badge ${cls}`}>{label}</span>;
}
export function relativeDeadline(info: any) {
  if (!info) return '';
  if (info.level === 'overdue') return `已逾期 ${info.overdueDays || 1} 天`;
  if (info.level === 'warning') return `剩 ${info.minutesLeft || 0} 分钟`;
  if (info.level === 'normal') return `剩 ${info.hoursLeft || 0} 小时`;
  return '无期限';
}
