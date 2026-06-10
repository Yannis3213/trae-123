import { CheckCircle, XCircle, ArrowRight, Edit3, RotateCcw, FileText, Send } from 'lucide-react';

interface TimelineRecord {
  id: string;
  action: string;
  handlerRole: string;
  comment: string | null;
  version: number;
  createdAt: string;
  [key: string]: any;
}

interface TimelineProps {
  records: TimelineRecord[];
}

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  created: { label: '创建', color: 'bg-blue-500', icon: FileText },
  submitted: { label: '提交', color: 'bg-indigo-500', icon: Send },
  reviewing: { label: '审核中', color: 'bg-purple-500', icon: CheckCircle },
  approved: { label: '审核通过', color: 'bg-emerald-500', icon: CheckCircle },
  rejected: { label: '驳回', color: 'bg-red-500', icon: XCircle },
  corrected: { label: '补正', color: 'bg-amber-500', icon: Edit3 },
  archived: { label: '归档', color: 'bg-teal-500', icon: CheckCircle },
};

const ROLE_LABELS: Record<string, string> = {
  dispatcher: '发车登记员',
  route_supervisor: '发车审核主管',
  ops_center: '复核负责人',
};

export default function Timeline({ records }: TimelineProps) {
  if (!records || records.length === 0) {
    return <div className="text-center text-slate-400 py-8">暂无处理记录</div>;
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
      <div className="space-y-6">
        {records.map((record) => {
          const cfg = ACTION_CONFIG[record.action] || { label: record.action, color: 'bg-slate-400', icon: FileText };
          const Icon = cfg.icon;
          return (
            <div key={record.id} className="relative flex gap-4 pl-10">
              <div className={`absolute left-2 w-5 h-5 rounded-full ${cfg.color} flex items-center justify-center ring-4 ring-white`}>
                <Icon className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className="text-sm font-medium text-slate-800">{ROLE_LABELS[record.handlerRole] || record.handlerRole}</span>
                  <span className="text-xs text-slate-400">{record.createdAt}</span>
                  <span className="text-xs text-slate-300">v{record.version}</span>
                </div>
                {record.comment && (
                  <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mt-1">
                    {record.comment}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
