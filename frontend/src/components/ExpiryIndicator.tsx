interface ExpiryIndicatorProps {
  status: 'normal' | 'approaching' | 'overdue';
}

const CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  normal: { label: '正常', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  approaching: { label: '临期', bg: 'bg-amber-100', text: 'text-amber-700' },
  overdue: { label: '逾期', bg: 'bg-red-100', text: 'text-red-700' },
};

export default function ExpiryIndicator({ status }: ExpiryIndicatorProps) {
  const cfg = CONFIG[status] || CONFIG.normal;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}
