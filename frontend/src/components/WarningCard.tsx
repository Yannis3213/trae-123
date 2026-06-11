'use client';

import { CheckCircle, AlertTriangle, XCircle, Paperclip, FileText } from 'lucide-react';
import type { RepairOrder } from '@/types';

interface Props {
  type: 'normal' | 'approaching' | 'overdue';
  count: number;
  orders?: RepairOrder[];
  onClick?: () => void;
  active?: boolean;
}

const config = {
  normal: { label: '正常', icon: CheckCircle, bg: 'bg-green-50 border-green-200', iconColor: 'text-green-500', countBg: 'bg-green-100 text-green-700' },
  approaching: { label: '临期', icon: AlertTriangle, bg: 'bg-yellow-50 border-yellow-200', iconColor: 'text-yellow-500', countBg: 'bg-yellow-100 text-yellow-700' },
  overdue: { label: '逾期', icon: XCircle, bg: 'bg-red-50 border-red-200', iconColor: 'text-red-500', countBg: 'bg-red-100 text-red-700' },
};

export default function WarningCard({ type, count, orders, onClick, active }: Props) {
  const c = config[type];
  const Icon = c.icon;

  const totalAttachments = orders?.reduce((sum, o) => sum + (o.attachment_count ?? o.attachments?.length ?? 0), 0) ?? 0;
  const totalRecords = orders?.reduce((sum, o) => sum + (o.processing_record_count ?? o.processing_records?.length ?? 0), 0) ?? 0;

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-2 px-4 py-3 rounded-lg border-2 transition-all text-left ${c.bg} ${active ? 'ring-2 ring-offset-1 ring-primary' : 'hover:shadow-md'} w-full`}
    >
      <div className="flex items-center gap-3 w-full">
        <Icon className={`w-6 h-6 flex-shrink-0 ${c.iconColor}`} />
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-700">{c.label}</div>
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-lg font-bold ${c.countBg}`}>
            {count}
          </span>
          <span className="text-xs text-gray-500 ml-2">单</span>
        </div>
      </div>
      {(orders && orders.length > 0) && (
        <div className="flex items-center gap-3 text-xs text-gray-500 w-full pt-1 border-t border-gray-200/50">
          <div className="flex items-center gap-1">
            <Paperclip className="w-3 h-3" />
            <span>附件 {totalAttachments}</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            <span>记录 {totalRecords}</span>
          </div>
        </div>
      )}
    </button>
  );
}
