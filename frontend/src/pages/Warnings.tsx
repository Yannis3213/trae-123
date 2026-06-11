import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAppStore } from '@/store';
import { USER_ROLE_LABELS } from '@/types';
import type { VenueOrder } from '@/types';

const columns = [
  { key: 'normal' as const, label: '正常', icon: CheckCircle, bg: 'bg-green-50', border: 'border-green-200', headerBg: 'bg-green-100', headerText: 'text-green-700' },
  { key: 'approaching' as const, label: '临期', icon: Clock, bg: 'bg-yellow-50', border: 'border-yellow-200', headerBg: 'bg-yellow-100', headerText: 'text-yellow-700' },
  { key: 'overdue' as const, label: '逾期', icon: AlertTriangle, bg: 'bg-red-50', border: 'border-red-200', headerBg: 'bg-red-100', headerText: 'text-red-700' },
];

export default function Warnings() {
  const navigate = useNavigate();
  const { warningOrders, loading, fetchWarnings } = useAppStore();

  const loadWarnings = useCallback(() => {
    fetchWarnings();
  }, [fetchWarnings]);

  useEffect(() => {
    loadWarnings();
  }, [loadWarnings]);

  const getDaysRemaining = (deadline: string) => {
    const now = new Date();
    const dl = new Date(deadline + 'T23:59:59');
    const diff = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getHandlerName = (order: VenueOrder) => {
    if (!order.currentHandler) return '-';
    const names: Record<string, string> = { u1: '张伟', u2: '李明', u3: '王芳' };
    const roleLabel = USER_ROLE_LABELS[order.currentHandlerRole] || '';
    return `${names[order.currentHandler] || order.currentHandler}（${roleLabel}）`;
  };

  if (loading) return <div className="text-center py-12 text-gray-400">加载中...</div>;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">到期预警</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map((col) => {
          const Icon = col.icon;
          const orders = warningOrders[col.key] || [];
          return (
            <div key={col.key} className={`${col.bg} ${col.border} border rounded-xl overflow-hidden`}>
              <div className={`${col.headerBg} px-4 py-3 flex items-center gap-2`}>
                <Icon size={18} className={col.headerText} />
                <span className={`font-semibold ${col.headerText}`}>{col.label}</span>
                <span className={`ml-auto text-sm font-medium ${col.headerText}`}>{orders.length} 条</span>
              </div>
              <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
                {orders.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">暂无{col.label}订单</p>
                ) : (
                  orders.map((order) => {
                    const days = getDaysRemaining(order.deadline);
                    return (
                      <div
                        key={order.id}
                        onClick={() => navigate(`/orders/${order.id}`)}
                        className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-sm text-primary font-medium">{order.orderNo}</span>
                          <span className={`text-xs font-bold ${days < 0 ? 'text-red-600' : days <= 3 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {days < 0 ? `超期 ${Math.abs(days)} 天` : days === 0 ? '今日到期' : `剩余 ${days} 天`}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <p>{order.venueName} · {order.courtName}</p>
                          <p>截止：{order.deadline}</p>
                          <p>处理人：{getHandlerName(order)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
