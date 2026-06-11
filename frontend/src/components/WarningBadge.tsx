import { WARNING_LEVEL_LABELS } from '@/types';

const WARNING_COLORS: Record<string, string> = {
  normal: 'bg-green-100 text-green-700 border-green-200',
  approaching: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
};

export default function WarningBadge({ level }: { level: string }) {
  const label = WARNING_LEVEL_LABELS[level] || level;
  const colorClass = WARNING_COLORS[level] || 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {label}
    </span>
  );
}
