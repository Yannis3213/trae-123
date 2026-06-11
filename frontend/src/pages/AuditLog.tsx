import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useAppStore } from '@/store';
import { USER_ROLE_LABELS } from '@/types';

const ACTION_LABELS: Record<string, string> = {
  create: '创建订单',
  correct: '修正补正',
  review_approve: '审核通过',
  review_reject: '审核退回',
  approve_finalize: '审批完成',
  approve_return: '审批退回',
  return: '退回',
  overdue: '逾期标记',
};

const operatorOptions = [
  { value: 'u1', label: '张伟（场地登记员）' },
  { value: 'u2', label: '李明（审核主管）' },
  { value: 'u3', label: '王芳（复核负责人）' },
  { value: 'system', label: '系统' },
];

export default function AuditLog() {
  const { auditLogs, loading, fetchAuditLogs } = useAppStore();
  const [orderSearch, setOrderSearch] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [sortDesc, setSortDesc] = useState(true);

  const loadAuditLogs = useCallback(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const handleSearch = () => {
    fetchAuditLogs({
      orderId: orderSearch || undefined,
      operator: operatorFilter || undefined,
    });
  };

  const filteredLogs = [...auditLogs].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return sortDesc ? tb - ta : ta - tb;
  });

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">审计日志</h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">订单号搜索</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="输入订单号"
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>
          <div className="w-48">
            <label className="block text-xs text-gray-500 mb-1">操作人</label>
            <select
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">全部</option>
              {operatorOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button onClick={handleSearch} className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors">
            查询
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">暂无审计日志</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  <button onClick={() => setSortDesc(!sortDesc)} className="flex items-center gap-1 hover:text-primary">
                    时间 {sortDesc ? '↓' : '↑'}
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">订单号</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">操作人</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">角色</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">操作</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">详情</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const names: Record<string, string> = { u1: '张伟', u2: '李明', u3: '王芳', system: '系统' };
                return (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-mono text-primary text-xs">{log.orderId}</td>
                    <td className="px-4 py-2.5 text-gray-700">{names[log.operator] || log.operator}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{USER_ROLE_LABELS[log.operatorRole] || log.operatorRole}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">{log.detail || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
