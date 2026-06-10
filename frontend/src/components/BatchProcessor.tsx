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

const ROLE_ACTIONS: Record<string, { label: string; action: string }> = {
  dispatcher: { label: '批量提交', action: 'submit' },
  route_supervisor: { label: '批量办理', action: 'review' },
  ops_center: { label: '批量复核', action: 'review' },
};

export default function BatchProcessor({ selectedIds, currentRole, onBatchComplete, plans = [] }: BatchProcessorProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ planId: string; success: boolean; reason?: string }[] | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const action = ROLE_ACTIONS[currentRole];
  if (!action || selectedIds.length === 0) return null;

  async function handleBatch() {
    setLoading(true);
    try {
      const versions: Record<string, number> = {};
      for (const id of selectedIds) {
        const plan = plans.find((p: any) => p.id === id);
        versions[id] = plan?.version || 1;
      }
      const res = await batchAdvance({ planIds: selectedIds, action: action.action, versions });
      setResults(res || []);
      setShowDialog(true);
      onBatchComplete();
    } catch (err: any) {
      setResults(selectedIds.map((id) => ({ planId: id, success: false, reason: err.message || '未知错误' })));
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
          {action.label}
        </button>
      </div>

      {showDialog && results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">批量处理结果</h3>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {results.map((r) => (
                <div
                  key={r.planId}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    r.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  <span className="font-medium">{r.planId.slice(0, 8)}...</span>
                  <span>{r.success ? '成功' : `失败: ${r.reason || '未知原因'}`}</span>
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
