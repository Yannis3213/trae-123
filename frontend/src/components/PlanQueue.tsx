import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ExpiryIndicator from './ExpiryIndicator';

interface Plan {
  id: string;
  planNumber: string;
  routeName: string;
  planDate: string;
  vehicleId: string;
  driverId: string;
  status: string;
  expiryStatus: 'normal' | 'approaching' | 'overdue';
  currentRole: string;
  version: number;
  [key: string]: any;
}

interface PlanQueueProps {
  plans: Plan[];
  onPlanClick: (id: string) => void;
  onBatchSelect: (ids: string[]) => void;
  currentRole: string;
  statusFilter?: string;
  onStatusFilterChange?: (v: string) => void;
}

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'pending_review', label: '待审核' },
  { value: 'reviewing', label: '审核中' },
  { value: 'pending_approval', label: '待复核' },
  { value: 'approving', label: '复核中' },
  { value: 'archived', label: '已归档' },
  { value: 'returned', label: '已退回' },
];

const ROLE_LABELS: Record<string, string> = {
  dispatcher: '发车登记员',
  route_supervisor: '发车审核主管',
  ops_center: '复核负责人',
};

export default function PlanQueue({ plans, onPlanClick, onBatchSelect, currentRole, statusFilter = '', onStatusFilterChange }: PlanQueueProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const filtered = plans.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        p.planNumber.toLowerCase().includes(q) ||
        p.routeName.toLowerCase().includes(q) ||
        p.vehicleId.toLowerCase().includes(q) ||
        p.driverId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
      onBatchSelect([]);
    } else {
      const ids = filtered.map((p) => p.id);
      setSelected(new Set(ids));
      onBatchSelect(ids);
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    onBatchSelect(Array.from(next));
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" />
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange?.(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索编号、线路、车辆、司机..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th className="px-4 py-3 text-left w-10">
                <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded border-slate-300 text-brand-accent focus:ring-brand-accent" />
              </th>
              <th className="px-4 py-3 text-left font-medium">编号</th>
              <th className="px-4 py-3 text-left font-medium">线路</th>
              <th className="px-4 py-3 text-left font-medium">发车日期</th>
              <th className="px-4 py-3 text-left font-medium">车辆</th>
              <th className="px-4 py-3 text-left font-medium">司机</th>
              <th className="px-4 py-3 text-left font-medium">状态</th>
              <th className="px-4 py-3 text-left font-medium">到期</th>
              <th className="px-4 py-3 text-left font-medium">当前角色</th>
              <th className="px-4 py-3 text-left font-medium">版本</th>
              <th className="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400">暂无数据</td></tr>
            )}
            {filtered.map((plan) => (
              <tr key={plan.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => onPlanClick(plan.id)}>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(plan.id)} onChange={() => toggleOne(plan.id)} className="rounded border-slate-300 text-brand-accent focus:ring-brand-accent" />
                </td>
                <td className="px-4 py-3 text-slate-900 font-medium">{plan.planNumber}</td>
                <td className="px-4 py-3 text-slate-600">{plan.routeName}</td>
                <td className="px-4 py-3 text-slate-600">{plan.planDate}</td>
                <td className="px-4 py-3 text-slate-600">{plan.vehicleId}</td>
                <td className="px-4 py-3 text-slate-600">{plan.driverId}</td>
                <td className="px-4 py-3"><StatusBadge status={plan.status} /></td>
                <td className="px-4 py-3"><ExpiryIndicator status={plan.expiryStatus} /></td>
                <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[plan.currentRole] || plan.currentRole}</td>
                <td className="px-4 py-3 text-slate-500">v{plan.version}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onPlanClick(plan.id)} className="text-brand-accent hover:text-orange-600 text-sm font-medium transition-colors">查看</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
