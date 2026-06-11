'use client';

import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface Props {
  type: 'normal' | 'approaching' | 'overdue';
  count: number;
  onClick?: () => void;
  active?: boolean;
}

const config = {
  normal: { label: '正常', icon: CheckCircle, bg: 'bg-green-50 border-green-200', iconColor: 'text-green-500', countBg: 'bg-green-100 text-green-700' },
  approaching: { label: '临期', icon: AlertTriangle, bg: 'bg-yellow-50 border-yellow-200', iconColor: 'text-yellow-500', countBg: 'bg-yellow-100 text-yellow-700' },
  overdue: { label: '逾期', icon: XCircle, bg: 'bg-red-50 border-red-200', iconColor: 'text-red-500', countBg: 'bg-red-100 text-red-700' },
};

export default function WarningCard({ type, count, onClick, active }: Props) {
  const c = config[type];
  const Icon = c.icon;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all ${c.bg} ${active ? 'ring-2 ring-offset-1 ring-primary' : 'hover:shadow-md'} w-full`}
    >
      <Icon className={`w-6 h-6 ${c.iconColor}`} />
      <div className="text-left flex-1">
        <div className="text-sm font-medium text-gray-700">{c.label}</div>
        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-sm font-bold ${c.countBg}`}>
          {count}
        </span>
      </div>
    </button>
  );
}
