import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';

interface ExpiryPanelProps {
  stats: { normal: number; approaching: number; overdue: number };
  onFilterByExpiry?: (status: string) => void;
  activeFilter?: string;
}

const CARDS = [
  { key: 'normal', label: '正常', icon: CheckCircle, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', iconColor: 'text-emerald-500', countColor: 'text-emerald-600', activeRing: 'ring-2 ring-emerald-400' },
  { key: 'approaching', label: '临期', icon: Clock, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', iconColor: 'text-amber-500', countColor: 'text-amber-600', activeRing: 'ring-2 ring-amber-400' },
  { key: 'overdue', label: '逾期', icon: AlertTriangle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', iconColor: 'text-red-500', countColor: 'text-red-600', activeRing: 'ring-2 ring-red-400' },
];

export default function ExpiryPanel({ stats, onFilterByExpiry, activeFilter = '' }: ExpiryPanelProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">到期预警</h3>
      <div className="space-y-3">
        {CARDS.map((card) => {
          const Icon = card.icon;
          const count = stats[card.key as keyof typeof stats] || 0;
          const isActive = activeFilter === card.key;
          return (
            <button
              key={card.key}
              onClick={() => onFilterByExpiry?.(card.key)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border ${card.border} ${card.bg} hover:shadow-sm transition-all text-left ${isActive ? card.activeRing : ''}`}
            >
              <Icon className={`w-5 h-5 ${card.iconColor}`} />
              <div className="flex-1">
                <div className={`text-xs font-medium ${card.text}`}>{card.label}</div>
                <div className={`text-2xl font-bold ${card.countColor}`}>{count}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
