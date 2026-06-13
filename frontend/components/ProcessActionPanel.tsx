'use client';

import { useState } from 'react';
import { OrderDetail, roleLabels, statusLabels } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface Props {
  order: OrderDetail;
  onProcessed: () => void;
}

export default function ProcessActionPanel({ order, onProcessed }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [remark, setRemark] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectReason, setShowRejectReason] = useState(false);

  if (!user) return null;

  const isCurrentHandler = user.id === order.current_handler;
  const isCreator = user.id === order.created_by;
  const isClosed = order.status === 'closed';
  const isPendingDispatch = order.status === 'pending_dispatch';
  const isProcessing = order.status === 'processing';
  const isReturned = order.status === 'returned';
  const hasMissingEvidence = order.missing_evidences && order.missing_evidences.length > 0;

  const canProcess = user.role === 'pharmacist' &&
    (isPendingDispatch || isReturned) &&
    isCurrentHandler &&
    !(isPendingDispatch && hasMissingEvidence);

  const canSubmitReview = user.role === 'pharmacist' &&
    isProcessing && isCurrentHandler && !hasMissingEvidence;

  const canReviewApprove = user.role === 'area_manager' &&
    isProcessing && isCurrentHandler && !hasMissingEvidence;

  const canReviewReject = user.role === 'area_manager' &&
    isProcessing && isCurrentHandler;

  const canCorrect = user.role === 'shop_clerk' &&
    (isReturned || isPendingDispatch) &&
    (isCreator || (isReturned && isCurrentHandler)) &&
    !hasMissingEvidence;

  const hasAnyAction = canProcess || canSubmitReview || canReviewApprove || canReviewReject || canCorrect;

  const handlerInfo = () => {
    if (isPendingDispatch) return order.current_handler || '待执业药师接单';
    if (isProcessing) return order.current_handler;
    if (isReturned) return order.current_handler + '（需补正）';
    if (isClosed) return '-';
    return order.current_handler || '-';
  };

  const nextStepHint = () => {
    if (isClosed) return '流程已结束';
    if (isPendingDispatch && user.role === 'pharmacist' && isCurrentHandler) {
      return hasMissingEvidence ? '→ 证据不全，需门店店员补齐' : '→ 点击「开始处理」接单';
    }
    if (isPendingDispatch && user.role === 'shop_clerk' && isCreator) {
      return hasMissingEvidence ? '→ 请补齐证据材料' : '→ 证据已齐，等待药师处理';
    }
    if (isPendingDispatch) return '→ 等待执业药师处理';
    if (isProcessing && user.role === 'pharmacist' && isCurrentHandler) {
      return hasMissingEvidence ? '→ 请补全证据材料后再提交' : '→ 补全证据后提交复核';
    }
    if (isProcessing && user.role === 'area_manager' && isCurrentHandler) {
      return hasMissingEvidence ? '→ 证据不全，建议退回补正' : '→ 可复核通过或退回';
    }
    if (isProcessing && !isCurrentHandler) return '→ 等待当前处理人操作';
    if (isReturned && user.role === 'shop_clerk' && (isCreator || isCurrentHandler)) {
      return hasMissingEvidence ? '→ 请补齐证据后补正提交' : '→ 可补正后重新提交';
    }
    if (isReturned && user.role !== 'shop_clerk') return '→ 等待门店店员补正';
    return '';
  };

  const handleProcess = async (action: string) => {
    if (action === 'review_reject' && !rejectReason.trim()) {
      setShowRejectReason(true);
      return;
    }

    setLoading(true);
    try {
      await api.processOrder(order.id, {
        version: order.version,
        action,
        remark: remark || undefined,
        exception_reason: action === 'review_reject' ? rejectReason : undefined,
      });
      onProcessed();
      setRemark('');
      setRejectReason('');
      setShowRejectReason(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-6">
      <h3 className="text-sm font-medium text-gray-700 mb-3">⚙️ 办理操作</h3>

      <div className="space-y-3">
        {isClosed ? (
          <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-500 text-center">
            处理单已关闭，无法操作
          </div>
        ) : (
          <>
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-blue-600">当前状态</span>
                <span className="text-blue-800 font-medium">{statusLabels[order.status]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600">处理人</span>
                <span className="text-blue-800 font-medium">{handlerInfo()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600">您的角色</span>
                <span className="text-blue-800 font-medium">{roleLabels[user.role]}</span>
              </div>
              <div className="text-blue-600 pt-1">{nextStepHint()}</div>
            </div>

            {!isCurrentHandler && !canCorrect && !isPendingDispatch && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                ⚠️ 您不是当前处理人，无法执行操作
              </div>
            )}

            {hasMissingEvidence && (canSubmitReview || canReviewApprove || canProcess) && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                ⚠️ 缺少证据：{order.missing_evidences.map(e => {
                  const map: Record<string, string> = { inspection: '巡检', transfer: '调拨', removal: '下架' };
                  return map[e] || e;
                }).join('、')}，需补齐后才能推进
              </div>
            )}

            {canProcess && (
              <button
                onClick={() => handleProcess('process')}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                开始处理
              </button>
            )}

            {canSubmitReview && (
              <button
                onClick={() => handleProcess('submit_review')}
                disabled={loading || hasMissingEvidence}
                className="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                提交复核
              </button>
            )}

            {canReviewApprove && (
              <button
                onClick={() => handleProcess('review_approve')}
                disabled={loading || hasMissingEvidence}
                className="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                复核通过并关闭
              </button>
            )}

            {canReviewReject && (
              <button
                onClick={() => {
                  setShowRejectReason(true);
                }}
                disabled={loading}
                className="w-full px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                退回补正
              </button>
            )}

            {canCorrect && (
              <button
                onClick={() => handleProcess('correct')}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                补正后重新提交
              </button>
            )}

            {!hasAnyAction && !isClosed && (
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-500 text-center">
                当前状态下无可执行操作
              </div>
            )}

            <div className="pt-3 border-t border-gray-100">
              <label className="block text-xs text-gray-500 mb-1">备注(可选)</label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                rows={2}
                placeholder="操作备注..."
              />
            </div>

            {showRejectReason && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <label className="block text-xs text-red-700 mb-1">退回原因 *</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-2 py-1.5 border border-red-300 rounded text-sm"
                  rows={2}
                  placeholder="请填写退回原因..."
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setShowRejectReason(false)}
                    className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleProcess('review_reject')}
                    disabled={!rejectReason.trim()}
                    className="flex-1 px-2 py-1 bg-red-600 text-white text-xs rounded disabled:opacity-50"
                  >
                    确认退回
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>版本号</span>
            <span className="text-gray-700">v{order.version}</span>
          </div>
          <div className="flex justify-between">
            <span>当前处理人</span>
            <span className="text-gray-700">{handlerInfo()}</span>
          </div>
          <div className="flex justify-between">
            <span>创建人</span>
            <span className="text-gray-700">{order.created_by}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
