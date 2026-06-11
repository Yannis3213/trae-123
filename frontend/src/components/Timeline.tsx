'use client';

import { Clock, User, MessageSquare } from 'lucide-react';
import { STATUS_LABELS, type Status, type ProcessingRecord } from '@/types';

interface Props {
  records: ProcessingRecord[];
}

const ACTION_LABELS: Record<string, string> = {
  submit: '提交',
  process: '受理',
  verify: '核验',
  review: '复核',
  archive: '归档',
  return: '退回',
  resubmit: '重新提交',
};

export default function Timeline({ records }: Props) {
  if (!records.length) {
    return <div className="text-sm text-gray-400 py-4 text-center">暂无处理记录</div>;
  }
  const sorted = [...records].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return (
    <div className="relative">
      {sorted.map((r, i) => (
        <div key={r.id} className="flex gap-4 pb-6 last:pb-0">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            {i < sorted.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {ACTION_LABELS[r.action] ?? r.action}
              </span>
              <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString('zh-CN')}</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
              <User className="w-3 h-3" />
              <span>{r.handler_name}</span>
              {r.handler_role && <span className="ml-1">({r.handler_role})</span>}
              <span className="ml-1">{STATUS_LABELS[r.from_status as Status] ?? r.from_status} → {STATUS_LABELS[r.to_status as Status] ?? r.to_status}</span>
            </div>
            {r.opinion && (
              <div className="flex items-start gap-1 mt-1 text-xs text-gray-500">
                <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{r.opinion}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
