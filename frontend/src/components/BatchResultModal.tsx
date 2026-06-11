import { X, Check, XCircle } from 'lucide-react';
import type { BatchResult } from '@/types';

export default function BatchResultModal({
  results,
  onClose,
}: {
  results: BatchResult[];
  onClose: () => void;
}) {
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">批量处理结果</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-3 flex gap-4 text-sm">
          <span className="text-green-600 font-medium">成功: {successCount}</span>
          <span className="text-red-600 font-medium">失败: {failCount}</span>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b">
                <th className="text-left py-2 font-medium">订单号</th>
                <th className="text-center py-2 font-medium">结果</th>
                <th className="text-left py-2 font-medium">原因</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 text-gray-700">{r.orderNo}</td>
                  <td className="py-2 text-center">
                    {r.success ? (
                      <Check size={16} className="inline text-green-500" />
                    ) : (
                      <XCircle size={16} className="inline text-red-500" />
                    )}
                  </td>
                  <td className="py-2 text-gray-500">{r.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t">
          <button
            onClick={onClose}
            className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
