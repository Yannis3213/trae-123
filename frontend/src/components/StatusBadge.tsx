import { ORDER_STATUS_LABELS } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  pending_review: 'bg-blue-100 text-blue-700 border-blue-200',
  pending_correction: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  under_review: 'bg-purple-100 text-purple-700 border-purple-200',
  under_approval: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
};

export default function StatusBadge({ status }: { status: string }) {
  const label = ORDER_STATUS_LABELS[status] || status;
  const colorClass = STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {label}
    </span>
  );
}
