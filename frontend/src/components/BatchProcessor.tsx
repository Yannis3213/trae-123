import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { batchAdvance } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

interface BatchProcessorProps {
  selectedIds: string[];
  currentRole: string;
  onBatchComplete: () => void;
  plans?: any[];
}

const ROLE_LABELS: Record<string, string> = {
  dispatcher: '批量提交',
  route_supervisor: '批量办理',
  ops_center: '批量复核',
};

function getActionForPlan(plan: any, role: string): string {
  const { status } = plan;
  if (role === 'dispatcher') {
    if (status === 'draft') return 'submit';
  }
  if (role === 'route_supervisor') {
    if (status === 'pending_review') return 'review';
    if (status === 'reviewing') return 'approve';
  }
  if (role === 'ops_center') {
    if (status === 'pending_approval') return 'review';
    if (status === 'approving') return 'archive';
  }
  return '';
}

export default function BatchProcessor({ selectedIds, currentRole, onBatchComplete, plans = [] }: BatchProcessorProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ planId: string; planNumber?: string; success: boolean; reason?: string; action?: string }[] | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const label = ROLE_LABELS[currentRole];
  if (!label || selectedIds.length === 0) return null;

  async function handleBatch() {
    setLoading(true);
    try {
      const perPlanActions: Record<string, string> = {};
      const planIds: string[] = [];
      const versions: Record<string, number> = {};

      for (const id of selectedIds) {
        const plan = plans.find((p: any) => p.id === id);
        if (!plan) continue;
        const act = getActionForPlan(plan, currentRole);
        if (!act) continue;
        planIds.push(id);
        versions[id] = plan.version;
        perPlanActions[id] = act;
      }

      if (planIds.length === 0) {
        setResults(selectedIds.map((id) => ({
          planId: id,
          planNumber: plans.find((p: any) => p.id === id)?.planNumber,
          success: false,
          reason: '当前状态不支持批量操作',
        })));
        setShowDialog(true);
        return;
      }

      const res = await batchAdvance({ planIds, action: 'batch', versions, actions: perPlanActions });
      const resultsWithInfo = (res || []).map((r: any) => ({
        ...r,
        planNumber: plans.find((p: any) => p.id === r.planId)?.planNumber,
        action: perPlanActions[r.planId],
      }));
      setResults(resultsWithInfo);
      setShowDialog(true);
      onBatchComplete();
    } catch (err: any) {
      setResults(selectedIds.map((id) => ({
        planId: id,
        planNumber: plans.find((p: any) => p.id === id)?.planNumber,
        success: false,
        reason: err.message || '未知错误',
      })));
      setShowDialog(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200 rounded-b-xl mt-px">
        <span className="text-sm text-slate-500">
          已选择 <strong className="text-slate-800">{selectedIds.length}</strong> 项
        </span>
        <button
          onClick={handleBatch}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {label}
        </button>
      </div>

      {showDialog && results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">批量处理结果</h3>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {results.map((r) => (
                <div
                  key={r.planId}
                  className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${
                    r.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  <span className="font-medium shrink-0">{r.planNumber || r.planId.slice(0, 10)}</span>
                  <span className="text-xs opacity-75 shrink-0">[{r.action || '-'}]</span>
                  <span className="break-all">{r.success ? '成功' : `失败: ${r.reason || '未知原因'}`}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowDialog(false)}
              className="mt-4 w-full px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </>
  );
}
