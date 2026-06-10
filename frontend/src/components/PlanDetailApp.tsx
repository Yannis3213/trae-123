import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, Paperclip, Send, RotateCcw, AlertTriangle, Plus, X, Upload } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { getPlanDetail, advancePlan, correctPlan, rejectPlan, uploadAttachment } from '../lib/api';
import StatusBadge from './StatusBadge';
import ExpiryIndicator from './ExpiryIndicator';
import Timeline from './Timeline';
import AuditNotes from './AuditNotes';

interface PlanDetailAppProps {
  planId: string;
}

type FileType = 'vehicle_schedule' | 'driver_checkin' | 'dispatch_confirm';

const ATTACHMENT_CONFIG: Record<FileType, { label: string; placeholder: string }> = {
  vehicle_schedule: { label: '车辆排班表', placeholder: '例: 1路车辆排班表.pdf' },
  driver_checkin: { label: '司机签收单', placeholder: '例: 司机签收单-1路.pdf' },
  dispatch_confirm: { label: '发车确认单', placeholder: '例: 发车确认单-20240101.pdf' },
};

const EXCEPTION_COLORS: Record<string, string> = {
  MISSING_EVIDENCE: 'bg-red-100 text-red-700',
  OVERDUE: 'bg-orange-100 text-orange-700',
  VERSION_CONFLICT: 'bg-yellow-100 text-yellow-700',
  STATUS_CONFLICT: 'bg-purple-100 text-purple-700',
  PERMISSION_DENIED: 'bg-rose-100 text-rose-700',
  RETURNED_CORRECT: 'bg-blue-100 text-blue-700',
};

const EXCEPTION_LABELS: Record<string, string> = {
  MISSING_EVIDENCE: '证据缺失',
  OVERDUE: '超时',
  VERSION_CONFLICT: '版本冲突',
  STATUS_CONFLICT: '状态冲突',
  PERMISSION_DENIED: '权限不足',
  RETURNED_CORRECT: '退回补正',
};

const ROLE_LABELS: Record<string, string> = {
  dispatcher: '发车登记员',
  route_supervisor: '发车审核主管',
  ops_center: '复核负责人',
};

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

  const [uploadingType, setUploadingType] = useState<FileType | null>(null);
  const [uploadInputs, setUploadInputs] = useState<Record<FileType, string>>({
    vehicle_schedule: '',
    driver_checkin: '',
    dispatch_confirm: '',
  });

  const [correctUploadInputs, setCorrectUploadInputs] = useState<Record<FileType, string>>({
    vehicle_schedule: '',
    driver_checkin: '',
    dispatch_confirm: '',
  });
  const [correctUploadFiles, setCorrectUploadFiles] = useState<Record<FileType, string[]>>({
    vehicle_schedule: [],
    driver_checkin: [],
    dispatch_confirm: [],
  });

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
    if (role === 'dispatcher' && status === 'draft') return true;
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

  function canUploadEvidence(): boolean {
    if (!currentUser || !plan) return false;
    return currentUser.role === 'dispatcher' && (plan.status === 'draft' || plan.status === 'returned');
  }

  function hasAttachment(fileType: FileType): boolean {
    if (!plan?.attachments) return false;
    return plan.attachments.some((a: any) => a.fileType === fileType);
  }

  function getAttachmentFileName(fileType: FileType): string {
    if (!plan?.attachments) return '';
    const att = plan.attachments.find((a: any) => a.fileType === fileType);
    return att?.fileName || '';
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

  async function handleUpload(fileType: FileType) {
    const fileName = uploadInputs[fileType].trim();
    if (!fileName) return;
    setUploadingType(fileType);
    try {
      await uploadAttachment(planId, { fileType, fileName });
      setUploadInputs(prev => ({ ...prev, [fileType]: '' }));
      await loadDetail();
    } catch (err: any) {
      setError(err.message || '上传失败');
    } finally {
      setUploadingType(null);
    }
  }

  function addCorrectFile(type: FileType) {
    const fileName = correctUploadInputs[type].trim();
    if (!fileName) return;
    setCorrectUploadFiles(prev => ({
      ...prev,
      [type]: [...prev[type], fileName],
    }));
    setCorrectUploadInputs(prev => ({ ...prev, [type]: '' }));
  }

  function removeCorrectFile(type: FileType, index: number) {
    setCorrectUploadFiles(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index),
    }));
  }

  async function handleAction() {
    if (!plan) return;
    setActionLoading(true);
    setVersionConflict(false);
    try {
      if (actionType === 'correct') {
        const allAttachments: { fileType: FileType; fileName: string }[] = [];
        (Object.keys(correctUploadFiles) as FileType[]).forEach(type => {
          correctUploadFiles[type].forEach(f => allAttachments.push({ fileType: type, fileName: f }));
        });
        for (const att of allAttachments) {
          await uploadAttachment(planId, att);
        }
        await correctPlan(plan.id, { comment: comment || '补正', version: plan.version });
      } else if (actionType === 'advance') {
        await advancePlan(plan.id, { action: getAdvanceAction(), comment: comment || undefined, version: plan.version });
      } else if (actionType === 'reject') {
        await rejectPlan(plan.id, { reason: comment, version: plan.version });
      }
      setShowActionDialog(false);
      setComment('');
      setCorrectUploadInputs({ vehicle_schedule: '', driver_checkin: '', dispatch_confirm: '' });
      setCorrectUploadFiles({ vehicle_schedule: [], driver_checkin: [], dispatch_confirm: [] });
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
    setCorrectUploadInputs({ vehicle_schedule: '', driver_checkin: '', dispatch_confirm: '' });
    setCorrectUploadFiles({ vehicle_schedule: [], driver_checkin: [], dispatch_confirm: [] });
    setShowActionDialog(true);
  }

  const STATUS_LABELS: Record<string, string> = {
    draft: '草稿', pending_review: '待审核', reviewing: '审核中',
    pending_approval: '待复核', approving: '复核中', archived: '已归档', returned: '已退回',
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

  const missingVehicleSchedule = plan.status === 'pending_review' && !hasAttachment('vehicle_schedule');
  const missingDriverCheckin = plan.status === 'pending_review' && !hasAttachment('driver_checkin');

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

          <div className="mb-6">
            <div className="text-xs text-slate-400 mb-2">附件</div>
            {plan.attachments && plan.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {plan.attachments.map((att: any) => (
                  <span key={att.id} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm">
                    <Paperclip className="w-3.5 h-3.5" />
                    {att.fileName}
                    {att.fileType && (
                      <span className="ml-1 text-xs text-blue-500">({ATTACHMENT_CONFIG[att.fileType as FileType]?.label || att.fileType})</span>
                    )}
                  </span>
                ))}
              </div>
            )}
            {(missingVehicleSchedule || missingDriverCheckin) && (
              <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-1 text-xs text-red-600 font-medium mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  缺少必要凭证
                </div>
                {missingVehicleSchedule && (
                  <span className="text-xs text-red-500">⚠ 缺少车辆排班表</span>
                )}
                {missingDriverCheckin && (
                  <span className="text-xs text-red-500 ml-3">⚠ 缺少司机签收单</span>
                )}
              </div>
            )}
            {canUploadEvidence() && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">凭证上传</span>
                  <span className="text-xs text-slate-400">（演示模式：输入文件名即可）</span>
                </div>
                {(['vehicle_schedule', 'driver_checkin', 'dispatch_confirm'] as FileType[]).map(type => (
                  <div key={type} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Paperclip className="w-4 h-4 text-brand-accent" />
                      <span className="text-sm font-medium text-slate-700">{ATTACHMENT_CONFIG[type].label}</span>
                      {hasAttachment(type) && (
                        <span className="text-xs text-emerald-600">已上传: {getAttachmentFileName(type)}</span>
                      )}
                    </div>
                    {!hasAttachment(type) && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={uploadInputs[type]}
                          onChange={(e) => setUploadInputs(prev => ({ ...prev, [type]: e.target.value }))}
                          placeholder={ATTACHMENT_CONFIG[type].placeholder}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleUpload(type))}
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpload(type)}
                          disabled={!uploadInputs[type].trim() || uploadingType === type}
                          className="inline-flex items-center gap-1 px-3 py-2 bg-brand-accent text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {uploadingType === type ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          上传
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">异常原因</h2>
          {plan.exceptionReasons && plan.exceptionReasons.length > 0 ? (
            <div className="space-y-3">
              {plan.exceptionReasons.map((ex: any, idx: number) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${EXCEPTION_COLORS[ex.reasonCode] || 'bg-slate-100 text-slate-700'}`}>
                        {EXCEPTION_LABELS[ex.reasonCode] || ex.reasonCode}
                      </span>
                      <span className="text-xs text-slate-400">
                        责任方: {ROLE_LABELS[ex.responsibleRole] || ex.responsibleRole}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">{ex.createdAt}</span>
                  </div>
                  {ex.reasonDetail && (
                    <p className="text-sm text-slate-600">{ex.reasonDetail}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">暂无异常记录</p>
          )}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
              <h3 className="text-lg font-semibold text-slate-800">
                {actionType === 'advance' ? getAdvanceLabel() : actionType === 'reject' ? '退回' : '补正'}
              </h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              {versionConflict && (
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg">
                  版本冲突：此计划已被他人修改，请刷新后重试。
                </div>
              )}

              <div>
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

              {actionType === 'correct' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">快速补正凭证</span>
                    <span className="text-xs text-slate-400">（演示模式：输入文件名即可）</span>
                  </div>
                  {(['vehicle_schedule', 'driver_checkin', 'dispatch_confirm'] as FileType[]).map(type => {
                    const alreadyHas = hasAttachment(type);
                    return (
                      <div key={type} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                        <div className="flex items-center gap-2 mb-2">
                          <Paperclip className="w-3.5 h-3.5 text-brand-accent" />
                          <span className="text-xs font-medium text-slate-700">{ATTACHMENT_CONFIG[type].label}</span>
                          {alreadyHas && (
                            <span className="text-xs text-emerald-600">已存在: {getAttachmentFileName(type)}</span>
                          )}
                        </div>
                        {correctUploadFiles[type].length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {correctUploadFiles[type].map((fileName, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs"
                              >
                                <Paperclip className="w-2.5 h-2.5 text-slate-400" />
                                {fileName}
                                <button
                                  type="button"
                                  onClick={() => removeCorrectFile(type, idx)}
                                  className="ml-0.5 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={correctUploadInputs[type]}
                            onChange={(e) => setCorrectUploadInputs(prev => ({ ...prev, [type]: e.target.value }))}
                            placeholder={ATTACHMENT_CONFIG[type].placeholder}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCorrectFile(type))}
                            className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/30 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => addCorrectFile(type)}
                            disabled={!correctUploadInputs[type].trim()}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            添加
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3 pt-2">
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
                  {actionType === 'correct' ? '确认补正' : '确认'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
