import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CheckSquare, CreditCard, MapPin, AlertTriangle, User } from 'lucide-react';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import WarningBadge from '@/components/WarningBadge';
import BatchResultModal from '@/components/BatchResultModal';
import { USER_ROLE_LABELS } from '@/types';
import type { VenueOrder } from '@/types';

function getPaymentStatusBadge(status: string | null) {
  if (!status) return <span className="text-gray-300">-</span>;
  const className = status === '已核销' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>{status}</span>;
}

function getAdmissionStatusBadge(status: string | null) {
  if (!status) return <span className="text-gray-300">-</span>;
  const className = status === '已确认' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>{status}</span>;
}

function getExceptionBadge(reason: string | null, node: string | null) {
  if (!reason) return <span className="text-gray-300">-</span>;
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 w-fit" title={reason}>
        <AlertTriangle size={10} className="inline mr-1" />
        {reason.length > 8 ? reason.substring(0, 8) + '...' : reason}
      </span>
      {node && (
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <User size={10} />{node}
        </span>
      )}
    </div>
  );
}

const STATUS_TABS = [
  { key: '', label: '全部' },
  { key: 'pending_review', label: '待审核' },
  { key: 'pending_correction', label: '待补正' },
  { key: 'under_review', label: '审核中' },
  { key: 'under_approval', label: '复核中' },
  { key: 'completed', label: '办结' },
  { key: 'overdue', label: '逾期' },
];

const WARNING_FILTERS = [
  { key: '', label: '全部', className: 'bg-gray-100 text-gray-600' },
  { key: 'normal', label: '正常', className: 'bg-green-100 text-green-700' },
  { key: 'approaching', label: '临期', className: 'bg-yellow-100 text-yellow-700' },
  { key: 'overdue', label: '逾期', className: 'bg-red-100 text-red-700' },
];

export default function OrderList() {
  const navigate = useNavigate();
  const { orders, currentUser, loading, batchResults, fetchOrders, batchReview, batchApprove } = useAppStore();
  const [statusFilter, setStatusFilter] = useState('');
  const [warningFilter, setWarningFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchOpinion, setBatchOpinion] = useState('');
  const [batchAction, setBatchAction] = useState<'approve' | 'reject' | 'finalize' | 'return'>('approve');
  const [batchType, setBatchType] = useState<'review' | 'approve'>('review');

  const loadOrders = useCallback(() => {
    fetchOrders({ status: statusFilter || undefined, warningLevel: warningFilter || undefined, role: currentUser?.role });
  }, [statusFilter, warningFilter, currentUser?.role, fetchOrders]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = orders.filter((o) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return o.orderNo.toLowerCase().includes(q) || o.applicantName.toLowerCase().includes(q);
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const handleBatch = (type: 'review' | 'approve', action: 'approve' | 'reject' | 'finalize' | 'return') => {
    setBatchType(type);
    setBatchAction(action);
    setBatchOpinion('');
    setShowBatchModal(true);
  };

  const submitBatch = async () => {
    const ids = Array.from(selectedIds);
    if (batchType === 'review') {
      await batchReview(ids, { action: batchAction, opinion: batchOpinion });
    } else {
      await batchApprove(ids, { action: batchAction, opinion: batchOpinion });
    }
    setShowBatchModal(false);
    setSelectedIds(new Set());
    loadOrders();
  };

  const getHandlerName = (order: VenueOrder) => {
    if (!order.currentHandler) return '-';
    const names: Record<string, string> = { u1: '张伟', u2: '李明', u3: '王芳' };
    const roleLabel = USER_ROLE_LABELS[order.currentHandlerRole] || '';
    return `${names[order.currentHandler] || order.currentHandler}（${roleLabel}）`;
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">订单列表</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {WARNING_FILTERS.map((wf) => (
              <button
                key={wf.key}
                onClick={() => setWarningFilter(wf.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  warningFilter === wf.key ? `${wf.className} ring-2 ring-offset-1 ring-current` : 'bg-gray-50 text-gray-400'
                }`}
              >
                {wf.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索订单号/申请人"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
          <CheckSquare size={16} className="text-primary" />
          <span className="text-sm text-primary font-medium">已选择 {selectedIds.size} 项</span>
          {currentUser?.role === 'reviewer' && (
            <>
              <button onClick={() => handleBatch('review', 'approve')} className="ml-2 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">批量审核通过</button>
              <button onClick={() => handleBatch('review', 'reject')} className="px-3 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600">批量审核退回</button>
            </>
          )}
          {currentUser?.role === 'approver' && (
            <>
              <button onClick={() => handleBatch('approve', 'finalize')} className="ml-2 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">批量审批通过</button>
              <button onClick={() => handleBatch('approve', 'return')} className="px-3 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600">批量审批退回</button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">暂无订单数据</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0} onChange={toggleAll} className="rounded" />
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-gray-600">订单号</th>
                  <th className="text-left px-3 py-3 font-medium text-gray-600">场馆</th>
                  <th className="text-left px-3 py-3 font-medium text-gray-600">场地</th>
                  <th className="text-left px-3 py-3 font-medium text-gray-600">预约日期</th>
                  <th className="text-left px-3 py-3 font-medium text-gray-600">申请人</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">支付状态</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">入场状态</th>
                  <th className="text-left px-3 py-3 font-medium text-gray-600">异常原因</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">状态</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">预警级别</th>
                  <th className="text-left px-3 py-3 font-medium text-gray-600">当前处理人</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggleSelect(order.id)} className="rounded" />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-primary font-medium">{order.orderNo}</td>
                    <td className="px-3 py-2.5 text-gray-700">{order.venueName}</td>
                    <td className="px-3 py-2.5 text-gray-700">{order.courtName}</td>
                    <td className="px-3 py-2.5 text-gray-700">{order.reservationDate}</td>
                    <td className="px-3 py-2.5 text-gray-700">{order.applicantName}</td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <CreditCard size={12} className="text-gray-400" />
                        {getPaymentStatusBadge(order.paymentStatus)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <MapPin size={12} className="text-gray-400" />
                        {getAdmissionStatusBadge(order.admissionStatus)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{getExceptionBadge(order.exceptionReason, order.responsibleNode)}</td>
                    <td className="px-3 py-2.5 text-center"><StatusBadge status={order.status} /></td>
                    <td className="px-3 py-2.5 text-center"><WarningBadge level={order.warningLevel} /></td>
                    <td className="px-3 py-2.5 text-gray-700 text-xs">{getHandlerName(order)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => navigate(`/orders/${order.id}`)} className="text-primary hover:text-primary-light text-xs font-medium">查看</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {batchType === 'review' ? '批量审核' : '批量审批'} - {batchAction === 'approve' || batchAction === 'finalize' ? '通过' : '退回'}
            </h3>
            <textarea
              value={batchOpinion}
              onChange={(e) => setBatchOpinion(e.target.value)}
              placeholder="请输入处理意见"
              className="w-full border border-gray-200 rounded-lg p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-24"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowBatchModal(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={submitBatch} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light">确认</button>
            </div>
          </div>
        </div>
      )}

      {batchResults.length > 0 && !showBatchModal && (
        <BatchResultModal results={batchResults} onClose={() => useAppStore.setState({ batchResults: [] })} />
      )}
    </div>
  );
}
