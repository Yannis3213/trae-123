'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { BatchResult } from '@/lib/types';

interface Props {
  orderIds: string[];
  action: string;
  onClose: () => void;
  onSuccess: () => void;
}

const actionLabels: Record<string, string> = {
  process: '批量处理',
  submit_review: '批量提交复核',
  review_approve: '批量复核通过',
  review_reject: '批量退回补正',
};

export default function BatchProcessModal({ orderIds, action, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BatchResult[] | null>(null);
  const [remark, setRemark] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const data = await api.batchProcess({
        order_ids: orderIds,
        action,
        remark: remark || undefined,
      });
      setResults(data);
      setDone(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const successCount = results?.filter(r => r.success).length || 0;
  const failCount = results?.filter(r => !r.success).length || 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">{actionLabels[action] || '批量处理'}</h3>
          <p className="text-sm text-gray-500 mt-1">共 {orderIds.length} 条记录</p>
        </div>

        <div className="p-6">
          {!done ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={2}
                  placeholder="可选"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                ⚠️ 批量操作将逐条执行，失败的记录会返回具体原因，请确认后操作。
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '处理中...' : '确认执行'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{successCount}</div>
                  <div className="text-xs text-green-700">成功</div>
                </div>
                <div className="flex-1 text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{failCount}</div>
                  <div className="text-xs text-red-700">失败</div>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                {results?.map((result, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-2 border-b border-gray-100 text-sm flex items-center justify-between ${
                      result.success ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  >
                    <span className="font-mono text-gray-700">{result.order_id.slice(0, 8)}...</span>
                    <span className={result.success ? 'text-green-700' : 'text-red-700'}>
                      {result.success ? '✓ ' : '✗ '}{result.message}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={onSuccess}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  完成
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
