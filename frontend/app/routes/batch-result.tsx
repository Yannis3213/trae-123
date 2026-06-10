import { useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import { CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import type { BatchResult } from "../utils/types";

export default function BatchResultPage() {
  const [results, setResults] = useState<BatchResult[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = sessionStorage.getItem("batchResults");
    if (stored) {
      try {
        setResults(JSON.parse(stored));
      } catch {
        setResults([]);
      }
    }
  }, []);

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-gray-800">
          批量处理结果
        </h2>
      </div>

      <div className="flex gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex-1 text-center">
          <p className="text-2xl font-bold text-emerald-accent">{successCount}</p>
          <p className="text-sm text-emerald-600 mt-1">成功</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex-1 text-center">
          <p className="text-2xl font-bold text-coral-red">{failCount}</p>
          <p className="text-sm text-red-600 mt-1">失败</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">巡检单ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">结果</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">原因</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {results.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-8 text-gray-400 text-sm">
                  无结果数据
                </td>
              </tr>
            ) : (
              results.map((r) => (
                <tr key={r.inspection_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">
                    {r.inspection_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    {r.success ? (
                      <span className="inline-flex items-center gap-1 text-emerald-accent text-sm font-medium">
                        <CheckCircle size={16} />
                        成功
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-coral-red text-sm font-medium">
                        <XCircle size={16} />
                        失败
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {r.reason || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => navigate("/")}
          className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          返回列表
        </button>
      </div>
    </div>
  );
}
