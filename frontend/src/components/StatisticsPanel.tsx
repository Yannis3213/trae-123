'use client';

import { useEffect, useState } from 'react';
import { Statistics } from '@/types';
import { api } from '@/lib/api';

export default function StatisticsPanel() {
  const [stats, setStats] = useState<Statistics | null>(null);

  const load = () => {
    api.getStatistics().then((d) => setStats(d as Statistics)).catch(() => {});
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  if (!stats) {
    return (
      <div className="card p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-library-100 rounded w-32" />
          <div className="h-20 bg-library-50 rounded" />
        </div>
      </div>
    );
  }

  const items = [
    { label: '待分派', value: stats.pending_assignment, color: 'bg-yellow-100 text-yellow-800' },
    { label: '已转办', value: stats.transferred, color: 'bg-blue-100 text-blue-800' },
    { label: '已回访', value: stats.revisited, color: 'bg-purple-100 text-purple-800' },
    { label: '退回补正', value: stats.returned_for_correction, color: 'bg-orange-100 text-orange-800' },
    { label: '复核归档', value: stats.reviewed_archived, color: 'bg-green-100 text-green-800' },
    { label: '超时未处理', value: stats.node_timeout_count, color: 'bg-red-100 text-red-800' },
  ];

  const overdueItems = [
    { label: '正常', value: stats.normal, color: 'bg-emerald-50 text-emerald-700' },
    { label: '临期(≤3天)', value: stats.approaching, color: 'bg-amber-50 text-amber-700' },
    { label: '已逾期', value: stats.overdue_count, color: 'bg-red-50 text-red-700' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div className="card p-4">
        <div className="text-sm font-medium text-library-600 mb-3">借阅记录流转概览（共 {stats.total_count} 条）</div>
        <div className="grid grid-cols-3 gap-2">
          {items.map((it) => (
            <div key={it.label} className={`p-3 rounded ${it.color}`}>
              <div className="text-xs opacity-80">{it.label}</div>
              <div className="text-xl font-bold">{it.value}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-4">
        <div className="text-sm font-medium text-library-600 mb-3">到期预警</div>
        <div className="grid grid-cols-3 gap-2">
          {overdueItems.map((it) => (
            <div key={it.label} className={`p-3 rounded ${it.color}`}>
              <div className="text-xs opacity-80">{it.label}</div>
              <div className="text-xl font-bold">{it.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
