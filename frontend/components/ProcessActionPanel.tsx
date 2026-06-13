'use client';

import { useState } from 'react';
import { OrderDetail, roleLabels } from '@/lib/types';
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
  const isClosed = order.status === 'closed';

  const canProcess = user.role === 'pharmacist' && 
    (order.status === 'pending_dispatch' || order.status === 'returned') &&
    (isCurrentHandler || order.status === 'returned');

  const canSubmitReview = user.role === 'pharmacist' &&
    order.status === 'processing' && isCurrentHandler;

  const canReview = user.role === 'area_manager' &&
    order.status === 'processing' && isCurrentHandler;

  const canCorrect = user.role === 'shop_clerk' &&
    order.status === 'returned';

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
      <h3 className="text-sm font-medium text-gray-700 mb-3">⚙️ 操作</h3>

      <div className="space-y-3">
        {isClosed ? (
          <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-500 text-center">
            处理单已关闭，无法操作
          </div>
        ) : (
          <>
            <div className="text-xs text-gray-500 mb-2">
              当前角色: <span className="text-gray-700 font-medium">{roleLabels[user.role]}</span>
            </div>

            {!isCurrentHandler && !canCorrect && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                ⚠️ 您不是当前处理人，部分操作可能无法执行
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
                disabled={loading || order.missing_evidences.length > 0}
                className="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {order.missing_evidences.length > 0 ? '缺少证据材料，无法提交' : '提交复核'}
              </button>
            )}

            {canReview && (
              <>
                <button
                  onClick={() => handleProcess('review_approve')}
                  disabled={loading || order.missing_evidences.length > 0}
                  className="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {order.missing_evidences.length > 0 ? '缺少证据，无法通过' : '复核通过并关闭'}
                </button>
                <button
                  onClick={() => handleProcess('review_reject')}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  退回补正
                </button>
              </>
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

            {!canProcess && !canSubmitReview && !canReview && !canCorrect && !isClosed && (
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
            <span className="text-gray-700">{order.current_handler || '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
