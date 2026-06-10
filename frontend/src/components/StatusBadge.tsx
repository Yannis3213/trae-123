type PlanStatus = 'draft' | 'pending_review' | 'reviewing' | 'pending_approval' | 'approving' | 'archived' | 'returned';

interface StatusBadgeProps {
  status: PlanStatus;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: '草稿', bg: 'bg-slate-100', text: 'text-slate-700' },
  pending_review: { label: '待审核', bg: 'bg-blue-100', text: 'text-blue-700' },
  reviewing: { label: '审核中', bg: 'bg-indigo-100', text: 'text-indigo-700' },
  pending_approval: { label: '待复核', bg: 'bg-purple-100', text: 'text-purple-700' },
  approving: { label: '复核中', bg: 'bg-violet-100', text: 'text-violet-700' },
  archived: { label: '已归档', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  returned: { label: '已退回', bg: 'bg-red-100', text: 'text-red-700' },
};

export type { PlanStatus };
export default function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}
