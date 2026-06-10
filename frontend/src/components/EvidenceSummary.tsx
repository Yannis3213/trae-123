import { Bus, UserCheck, CheckCircle } from 'lucide-react';

interface EvidenceSummaryProps {
  summary: { vehicleSchedule: number; driverCheckin: number; dispatchConfirm: number };
}

const ITEMS = [
  { key: 'vehicleSchedule' as const, label: '车辆排班', icon: Bus, color: 'text-blue-500', bg: 'bg-blue-50' },
  { key: 'driverCheckin' as const, label: '司机签到', icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { key: 'dispatchConfirm' as const, label: '发车确认', icon: CheckCircle, color: 'text-purple-500', bg: 'bg-purple-50' },
];

export default function EvidenceSummary({ summary }: EvidenceSummaryProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">证据摘要</h3>
      <div className="space-y-3">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const count = summary[item.key] || 0;
          return (
            <div key={item.key} className={`flex items-center gap-3 p-3 rounded-xl ${item.bg}`}>
              <Icon className={`w-5 h-5 ${item.color}`} />
              <div className="flex-1">
                <div className="text-xs text-slate-500 font-medium">{item.label}</div>
                <div className={`text-xl font-bold ${item.color}`}>{count}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
