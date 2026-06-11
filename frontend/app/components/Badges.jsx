import { STATUS_NAMES, WARNING_GROUP_NAMES } from '../constants';

export function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={`status-badge status-${status}`}>
      {STATUS_NAMES[status] || status}
    </span>
  );
}

export function WarningBadge({ group }) {
  if (!group || group === 'normal') return null;
  return (
    <span className={`status-badge warning-${group}`}>
      {WARNING_GROUP_NAMES[group] || group}
    </span>
  );
}

export function StatCard({ label, value, color = 'blue' }) {
  const colorMap = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
    gray: 'from-gray-500 to-gray-600'
  };
  return (
    <div className="card p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 bg-gradient-to-r ${colorMap[color]} bg-clip-text text-transparent`}>
        {value || 0}
      </div>
    </div>
  );
}
