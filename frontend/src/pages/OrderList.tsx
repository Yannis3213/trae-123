import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CheckSquare, CreditCard, MapPin, AlertTriangle, User, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import WarningBadge from '@/components/WarningBadge';
import BatchResultModal from '@/components/BatchResultModal';
import { USER_ROLE_LABELS } from '@/types';
import type { VenueOrder } from '@/types';

interface BatchEvidenceForm {
  paymentAmount: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentVerification: string;
  admissionStatus: string;
  admissionConfirmation: string;
  exceptionReason: string;
  responsibleNode: string;
  auditRemark: string;
  correctReason: string;
  returnOpinion: string;
}

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
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [batchEvidence, setBatchEvidence] = useState<BatchEvidenceForm>({
    paymentAmount: '',
    paymentMethod: '',
    paymentStatus: '',
    paymentVerification: '',
    admissionStatus: '',
    admissionConfirmation: '',
    exceptionReason: '',
    responsibleNode: '',
    auditRemark: '',
    correctReason: '',
    returnOpinion: '',
  });

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
    setShowEvidenceForm(false);
    setBatchEvidence({
      paymentAmount: '',
      paymentMethod: '',
      paymentStatus: action === 'approve' || action === 'finalize' ? '已核销' : '',
      paymentVerification: '',
      admissionStatus: action === 'finalize' ? '已确认' : '',
      admissionConfirmation: '',
      exceptionReason: action === 'reject' || action === 'return' ? '材料不完整' : '',
      responsibleNode: '',
      auditRemark: '',
      correctReason: '',
      returnOpinion: action === 'reject' || action === 'return' ? '' : '',
    });
    setShowBatchModal(true);
  };

  const handleEvidenceChange = (field: keyof BatchEvidenceForm, value: string) => {
    setBatchEvidence((prev) => ({ ...prev, [field]: value }));
  };

  const [batchValidationError, setBatchValidationError] = useState('');

  const submitBatch = async () => {
    setBatchValidationError('');

    if (!batchOpinion.trim()) {
      setBatchValidationError('处理意见不能为空');
      return;
    }

    const isReturnAction = batchAction === 'reject' || batchAction === 'return';
    if (isReturnAction && !batchEvidence.returnOpinion.trim()) {
      setBatchValidationError('退回操作必须填写退回意见');
      return;
    }

    const ids = Array.from(selectedIds);
    const selectedOrders = orders.filter((o) => ids.includes(o.id));

    const missingVersionOrders = selectedOrders.filter((o) => o.version === undefined || o.version === null);
    if (missingVersionOrders.length > 0) {
      setBatchValidationError(`以下订单缺少版本号：${missingVersionOrders.map((o) => o.orderNo).join('、')}，请刷新后重试`);
      return;
    }

    const ordersWithVersions = selectedOrders.map((o) => ({ id: o.id, version: o.version }));

    const evidenceData = {
      paymentAmount: batchEvidence.paymentAmount ? Number(batchEvidence.paymentAmount) : null,
      paymentMethod: batchEvidence.paymentMethod || null,
      paymentStatus: batchEvidence.paymentStatus || null,
      paymentVerification: batchEvidence.paymentVerification || null,
      admissionStatus: batchEvidence.admissionStatus || null,
      admissionConfirmation: batchEvidence.admissionConfirmation || null,
      exceptionReason: batchEvidence.exceptionReason || null,
      responsibleNode: batchEvidence.responsibleNode || null,
      auditRemark: batchEvidence.auditRemark || null,
      correctReason: batchEvidence.correctReason || null,
      returnOpinion: isReturnAction ? batchEvidence.returnOpinion : null,
    };

    if (batchType === 'review') {
      await batchReview(ids, {
        action: batchAction,
        opinion: batchOpinion,
        ordersWithVersions,
        ...evidenceData,
      });
    } else {
      await batchApprove(ids, {
        action: batchAction,
        opinion: batchOpinion,
        ordersWithVersions,
        ...evidenceData,
      });
    }
    setShowBatchModal(false);
    setSelectedIds(new Set());
    loadOrders();
    useAppStore.getState().fetchWarnings();
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 my-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {batchType === 'review' ? '批量审核' : '批量审批'} - {batchAction === 'approve' || batchAction === 'finalize' ? '通过' : '退回'}
              <span className="ml-2 text-sm font-normal text-gray-500">（已选择 {selectedIds.size} 项）</span>
            </h3>

            <div className="mb-4 p-2 bg-blue-50 rounded-lg">
              <div className="flex flex-wrap gap-2 text-xs text-blue-700">
                {Array.from(selectedIds).map((id) => {
                  const order = orders.find((o) => o.id === id);
                  return order ? (
                    <span key={id} className="bg-white px-2 py-1 rounded border border-blue-200">
                      {order.orderNo} <span className="text-blue-500">v{order.version}</span>
                    </span>
                  ) : null;
                })}
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">处理意见 <span className="text-red-500">*</span></label>
                <textarea
                  value={batchOpinion}
                  onChange={(e) => setBatchOpinion(e.target.value)}
                  placeholder="请输入处理意见"
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-20"
                />
              </div>

              {batchAction === 'reject' || batchAction === 'return' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">退回意见 <span className="text-red-500">*</span></label>
                  <textarea
                    value={batchEvidence.returnOpinion}
                    onChange={(e) => handleEvidenceChange('returnOpinion', e.target.value)}
                    placeholder="请输入退回意见（退回原因说明，必填）"
                    className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-16"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">补正原因 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={batchEvidence.correctReason}
                    onChange={(e) => handleEvidenceChange('correctReason', e.target.value)}
                    placeholder="补正原因说明（必填）"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              )}
            </div>

            <div className="mb-3">
              <button
                type="button"
                onClick={() => setShowEvidenceForm(!showEvidenceForm)}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary-light font-medium"
              >
                {showEvidenceForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showEvidenceForm ? '收起证据字段' : '展开证据字段（支付核销/入场确认/异常原因/责任节点）'}
              </button>
            </div>

            {showEvidenceForm && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                <p className="text-xs font-medium text-gray-700 flex items-center gap-1">
                  <CreditCard size={12} className="text-gray-500" /> 支付核销
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">支付金额（元）</label>
                    <input
                      type="number"
                      value={batchEvidence.paymentAmount}
                      onChange={(e) => handleEvidenceChange('paymentAmount', e.target.value)}
                      placeholder="如：200"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">支付方式</label>
                    <select
                      value={batchEvidence.paymentMethod}
                      onChange={(e) => handleEvidenceChange('paymentMethod', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">请选择</option>
                      <option value="微信支付">微信支付</option>
                      <option value="支付宝">支付宝</option>
                      <option value="现金">现金</option>
                      <option value="银行转账">银行转账</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">支付状态</label>
                    <select
                      value={batchEvidence.paymentStatus}
                      onChange={(e) => handleEvidenceChange('paymentStatus', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">请选择</option>
                      <option value="已核销">已核销</option>
                      <option value="待核销">待核销</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">支付核销凭证</label>
                    <input
                      type="text"
                      value={batchEvidence.paymentVerification}
                      onChange={(e) => handleEvidenceChange('paymentVerification', e.target.value)}
                      placeholder="如：订单号XD20260612001 已支付 核销时间 2026-06-12 15:30 凭证号WX202606120001"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-700 flex items-center gap-1">
                    <MapPin size={12} className="text-gray-500" /> 入场确认
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">入场状态</label>
                    <select
                      value={batchEvidence.admissionStatus}
                      onChange={(e) => handleEvidenceChange('admissionStatus', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">请选择</option>
                      <option value="已确认">已确认</option>
                      <option value="待确认">待确认</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">入场确认信息</label>
                    <input
                      type="text"
                      value={batchEvidence.admissionConfirmation}
                      onChange={(e) => handleEvidenceChange('admissionConfirmation', e.target.value)}
                      placeholder="如：入场时间 2026-06-15 08:55 确认人 张伟"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-700 flex items-center gap-1">
                    <AlertTriangle size={12} className="text-gray-500" /> 异常与责任
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">异常原因</label>
                    <input
                      type="text"
                      value={batchEvidence.exceptionReason}
                      onChange={(e) => handleEvidenceChange('exceptionReason', e.target.value)}
                      placeholder="如：支付凭证不全、入场确认缺失等"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">责任节点</label>
                    <input
                      type="text"
                      value={batchEvidence.responsibleNode}
                      onChange={(e) => handleEvidenceChange('responsibleNode', e.target.value)}
                      placeholder="如：registrar_missing_payment"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">审计备注</label>
                    <input
                      type="text"
                      value={batchEvidence.auditRemark}
                      onChange={(e) => handleEvidenceChange('auditRemark', e.target.value)}
                      placeholder="审计追踪备注（可选）"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              </div>
            )}

            {batchValidationError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {batchValidationError}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowBatchModal(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={submitBatch} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light">确认批量处理</button>
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
