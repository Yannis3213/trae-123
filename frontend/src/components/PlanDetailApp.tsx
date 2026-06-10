import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, Paperclip, Send, RotateCcw, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { getPlanDetail, advancePlan, correctPlan, rejectPlan } from '../lib/api';
import StatusBadge from './StatusBadge';
import ExpiryIndicator from './ExpiryIndicator';
import Timeline from './Timeline';
import AuditNotes from './AuditNotes';

interface PlanDetailAppProps {
  planId: string;
}

export default function PlanDetailApp({ planId }: PlanDetailAppProps) {
  const { currentUser } = useAuthStore();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<'advance' | 'reject' | 'correct'>('advance');
  const [comment, setComment] = useState('');
  const [versionConflict, setVersionConflict] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getPlanDetail(planId);
      setPlan(data);
    } catch (err: any) {
      setError(err.message || '加载计划详情失败');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadDetail();
  }, [planId]);

  function canAdvance(): boolean {
    if (!currentUser || !plan) return false;
    const { role } = currentUser;
    const { status } = plan;
    if (role === 'dispatcher' && (status === 'draft' || status === 'returned')) return true;
    if (role === 'route_supervisor' && (status === 'pending_review' || status === 'reviewing')) return true;
    if (role === 'ops_center' && (status === 'pending_approval' || status === 'approving')) return true;
    return false;
  }

  function canReject(): boolean {
    if (!currentUser || !plan) return false;
    const { role } = currentUser;
    const { status } = plan;
    if (role === 'route_supervisor' && (status === 'pending_review' || status === 'reviewing')) return true;
    if (role === 'ops_center' && (status === 'pending_approval' || status === 'approving')) return true;
    return false;
  }

  function canCorrect(): boolean {
    if (!currentUser || !plan) return false;
    return currentUser.role === 'dispatcher' && plan.status === 'returned';
  }

  function getAdvanceLabel(): string {
    if (!currentUser || !plan) return '';
    if (currentUser.role === 'dispatcher') return plan.status === 'returned' ? '补正提交' : '提交审核';
    if (currentUser.role === 'route_supervisor') {
      if (plan.status === 'pending_review') return '办理';
      if (plan.status === 'reviewing') return '审核通过';
    }
    if (currentUser.role === 'ops_center') {
      if (plan.status === 'pending_approval') return '办理';
      if (plan.status === 'approving') return '复核归档';
    }
    return '推进';
  }

  function getAdvanceAction(): string {
    if (!currentUser || !plan) return 'advance';
    if (currentUser.role === 'dispatcher') return 'submit';
    if (currentUser.role === 'route_supervisor') {
      if (plan.status === 'pending_review') return 'review';
      if (plan.status === 'reviewing') return 'approve';
    }
    if (currentUser.role === 'ops_center') {
      if (plan.status === 'pending_approval') return 'review';
      if (plan.status === 'approving') return 'archive';
    }
    return 'advance';
  }

  async function handleAction() {
    if (!plan) return;
    setActionLoading(true);
    setVersionConflict(false);
    try {
      if (actionType === 'advance') {
        await advancePlan(plan.id, { action: getAdvanceAction(), comment: comment || undefined, version: plan.version });
      } else if (actionType === 'reject') {
        await rejectPlan(plan.id, { reason: comment, version: plan.version });
      } else if (actionType === 'correct') {
        await correctPlan(plan.id, { comment: comment || '补正', version: plan.version });
      }
      setShowActionDialog(false);
      setComment('');
      window.location.href = '/';
    } catch (err: any) {
      if (err.message?.includes('版本冲突')) {
        setVersionConflict(true);
      } else {
        setError(err.message || '操作失败');
      }
    } finally {
      setActionLoading(false);
    }
  }

  function openActionDialog(type: 'advance' | 'reject' | 'correct') {
    setActionType(type);
    setComment('');
    setVersionConflict(false);
    setShowActionDialog(true);
  }

  const STATUS_LABELS: Record<string, string> = {
    draft: '草稿', pending_review: '待审核', reviewing: '审核中',
    pending_approval: '待复核', approving: '复核中', archived: '已归档', returned: '已退回',
  };

  const NOTE_TYPE_LABELS: Record<string, string> = {
    pending_sign: '待签收',
    exception_return: '异常回传',
    sign_complete: '签收完成',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
        <span className="ml-3 text-slate-500">加载中...</span>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || '计划不存在'}</p>
          <button onClick={() => window.location.href = '/'} className="text-brand-accent hover:underline">
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="px-6 py-4 flex items-center gap-4 border-b border-slate-200 bg-white">
        <button
          onClick={() => window.location.href = '/'}
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回队列
        </button>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <h1 className="text-xl font-bold text-slate-800">{plan.planNumber}</h1>
            <StatusBadge status={plan.status} />
            <ExpiryIndicator status={plan.expiryStatus} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            <div>
              <div className="text-xs text-slate-400 mb-1">线路</div>
              <div className="text-sm font-medium text-slate-800">{plan.routeName}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">发车日期</div>
              <div className="text-sm font-medium text-slate-800">{plan.planDate}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">车辆</div>
              <div className="text-sm font-medium text-slate-800">{plan.vehicleId}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">司机</div>
              <div className="text-sm font-medium text-slate-800">{plan.driverId}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
            <div>
              <div className="text-xs text-slate-400 mb-1">截止日期</div>
              <div className="text-sm font-medium text-slate-800">{plan.dueDate}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">版本</div>
              <div className="text-sm font-medium text-slate-800">v{plan.version}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">当前状态</div>
              <div className="text-sm font-medium text-slate-800">{STATUS_LABELS[plan.status] || plan.status}</div>
            </div>
          </div>

          {plan.notes && (
            <div className="mb-6">
              <div className="text-xs text-slate-400 mb-1">备注</div>
              <div className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">{plan.notes}</div>
            </div>
          )}

          {plan.attachments && plan.attachments.length > 0 && (
            <div className="mb-6">
              <div className="text-xs text-slate-400 mb-2">附件</div>
              <div className="flex flex-wrap gap-2">
                {plan.attachments.map((att: any) => (
                  <span key={att.id} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm">
                    <Paperclip className="w-3.5 h-3.5" />
                    {att.fileName}
                  </span>
                ))}
              </div>
              {plan.status === 'pending_review' && (
                <div className="mt-2">
                  {!plan.attachments.some((a: any) => a.fileType === 'vehicle_schedule') && (
                    <span className="text-xs text-red-500">⚠ 缺少车辆排班表</span>
                  )}
                  {!plan.attachments.some((a: any) => a.fileType === 'driver_checkin') && (
                    <span className="text-xs text-red-500 ml-3">⚠ 缺少司机签收单</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">处理记录</h2>
            <Timeline records={plan.processingRecords || []} />
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">审计备注</h2>
            <AuditNotes notes={plan.auditNotes || []} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">操作</h2>
          <div className="flex gap-3">
            {canAdvance() && (
              <button
                onClick={() => openActionDialog('advance')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
              >
                <Send className="w-4 h-4" />
                {getAdvanceLabel()}
              </button>
            )}
            {canReject() && (
              <button
                onClick={() => openActionDialog('reject')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                <RotateCcw className="w-4 h-4" />
                退回
              </button>
            )}
            {canCorrect() && (
              <button
                onClick={() => openActionDialog('correct')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
              >
                <AlertTriangle className="w-4 h-4" />
                补正
              </button>
            )}
            {!canAdvance() && !canReject() && !canCorrect() && (
              <p className="text-sm text-slate-400">当前角色无法操作此计划</p>
            )}
          </div>
        </div>
      </div>

      {showActionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              {actionType === 'advance' ? getAdvanceLabel() : actionType === 'reject' ? '退回' : '补正'}
            </h3>

            {versionConflict && (
              <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg">
                版本冲突：此计划已被他人修改，请刷新后重试。
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {actionType === 'reject' ? '退回原因' : '备注'}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={actionType === 'reject' ? '请填写退回原因' : '可选填写备注'}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowActionDialog(false)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading || (actionType === 'reject' && !comment.trim())}
                className="flex-1 px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
