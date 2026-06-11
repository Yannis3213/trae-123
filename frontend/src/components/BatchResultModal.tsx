'use client';

import { X, CheckCircle, XCircle } from 'lucide-react';
import type { BatchResult } from '@/types';

interface Props {
  result: BatchResult[];
  onClose: () => void;
}

export default function BatchResultModal({ result, onClose }: Props) {
  const total = result.length;
  const succeeded = result.filter((r) => r.success).length;
  const failed = total - succeeded;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">批量操作结果</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-4">
          <div className="flex gap-6 mb-4 text-sm">
            <span className="text-gray-600">总计: <strong>{total}</strong></span>
            <span className="text-green-600">成功: <strong>{succeeded}</strong></span>
            <span className="text-red-600">失败: <strong>{failed}</strong></span>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {result.map((r, i) => (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${r.success ? 'bg-green-50' : 'bg-red-50'}`}>
                {r.success ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                <span className="flex-1 text-gray-700">{r.id}</span>
                {!r.success && <span className="text-red-500 text-xs">{r.message}</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="px-6 py-3 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-primary text-white rounded hover:opacity-90 text-sm">确定</button>
        </div>
      </div>
    </div>
  );
}
