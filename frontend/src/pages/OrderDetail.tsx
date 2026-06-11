import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Upload, Clock, Tag, CreditCard, MapPin, AlertTriangle, User, FileText } from 'lucide-react';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import WarningBadge from '@/components/WarningBadge';
import { USER_ROLE_LABELS, ORDER_STATUS_LABELS } from '@/types';
import type { VenueOrder, ProcessingRecord } from '@/types';
import * as api from '@/api';

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

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return '操作失败';
}

function getPaymentStatusBadge(status: string | null) {
  if (!status) return null;
  const className = status === '已核销' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>{status}</span>;
}

function getAdmissionStatusBadge(status: string | null) {
  if (!status) return null;
  const className = status === '已确认' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>{status}</span>;
}

function RecordEvidence({ record }: { record: ProcessingRecord }) {
  const hasEvidence = record.paymentStatus || record.paymentVerification || record.admissionStatus || 
    record.admissionConfirmation || record.correctReason || record.returnOpinion || 
    record.exceptionReason || record.responsibleNode || record.paymentAmount || record.paymentMethod;
  
  if (!hasEvidence) return null;

  return (
    <div className="mt-2 bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs">
      {record.paymentAmount && (
        <p className="text-gray-600"><span className="text-gray-400">支付金额：</span>¥{record.paymentAmount}</p>
      )}
      {record.paymentMethod && (
        <p className="text-gray-600"><span className="text-gray-400">支付方式：</span>{record.paymentMethod}</p>
      )}
      {record.paymentStatus && (
        <p className="text-gray-600 flex items-center gap-1.5">
          <CreditCard size={12} className="text-gray-400" />
          <span className="text-gray-400">支付状态：</span>{getPaymentStatusBadge(record.paymentStatus)}
        </p>
      )}
      {record.paymentVerification && (
        <p className="text-gray-600"><span className="text-gray-400">支付核销凭证：</span>{record.paymentVerification}</p>
      )}
      {record.admissionStatus && (
        <p className="text-gray-600 flex items-center gap-1.5">
          <MapPin size={12} className="text-gray-400" />
          <span className="text-gray-400">入场状态：</span>{getAdmissionStatusBadge(record.admissionStatus)}
        </p>
      )}
      {record.admissionConfirmation && (
        <p className="text-gray-600"><span className="text-gray-400">入场确认信息：</span>{record.admissionConfirmation}</p>
      )}
      {record.correctReason && (
        <p className="text-yellow-700 bg-yellow-50 px-2 py-1 rounded"><span className="font-medium">补正原因：</span>{record.correctReason}</p>
      )}
      {record.returnOpinion && (
        <p className="text-orange-700 bg-orange-50 px-2 py-1 rounded"><span className="font-medium">退回意见：</span>{record.returnOpinion}</p>
      )}
      {record.exceptionReason && (
        <p className="text-red-700 bg-red-50 px-2 py-1 rounded flex items-center gap-1.5">
          <AlertTriangle size={12} />
          <span className="font-medium">异常原因：</span>{record.exceptionReason}
        </p>
      )}
      {record.responsibleNode && (
        <p className="text-red-700 bg-red-50 px-2 py-1 rounded flex items-center gap-1.5">
          <User size={12} />
          <span className="font-medium">责任节点：</span>{record.responsibleNode}
        </p>
      )}
      {record.auditRemark && (
        <p className="text-gray-600 flex items-center gap-1.5">
          <FileText size={12} className="text-gray-400" />
          <span className="text-gray-400">审计备注：</span>{record.auditRemark}
        </p>
      )}
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrder, currentUser, loading, error, fetchOrder, correctOrder, reviewOrder, approveOrder, returnOrder } = useAppStore();
  const [opinion, setOpinion] = useState('');
  const [correctReason, setCorrectReason] = useState('');
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [evidenceForm, setEvidenceForm] = useState({
    paymentAmount: '',
    paymentMethod: '',
    paymentStatus: '',
    paymentVerification: '',
    admissionStatus: '',
    admissionConfirmation: '',
    exceptionReason: '',
    responsibleNode: '',
    auditRemark: '',
    venueName: '',
    courtName: '',
    reservationDate: '',
    timeSlot: '',
    applicantName: '',
    applicantPhone: '',
    deadline: '',
  });

  const loadOrder = useCallback(() => {
    if (id) fetchOrder(id);
  }, [id, fetchOrder]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (currentOrder) {
      setEvidenceForm({
        paymentAmount: currentOrder.paymentAmount?.toString() || '',
        paymentMethod: currentOrder.paymentMethod || '',
        paymentStatus: currentOrder.paymentStatus || '',
        paymentVerification: currentOrder.paymentVerification || '',
        admissionStatus: currentOrder.admissionStatus || '',
        admissionConfirmation: currentOrder.admissionConfirmation || '',
        exceptionReason: currentOrder.exceptionReason || '',
        responsibleNode: currentOrder.responsibleNode || '',
        auditRemark: currentOrder.auditRemark || '',
        venueName: currentOrder.venueName || '',
        courtName: currentOrder.courtName || '',
        reservationDate: currentOrder.reservationDate || '',
        timeSlot: currentOrder.timeSlot || '',
        applicantName: currentOrder.applicantName || '',
        applicantPhone: currentOrder.applicantPhone || '',
        deadline: currentOrder.deadline || '',
      });
    }
  }, [currentOrder]);

  const order = currentOrder;
  const role = currentUser?.role;

  const canCorrect = role === 'registrar' && order?.currentHandler === currentUser?.id && order?.status === 'pending_correction';
  const canReview = role === 'reviewer' && order?.currentHandler === currentUser?.id && (order?.status === 'pending_review' || order?.status === 'under_review');
  const canApprove = role === 'approver' && order?.currentHandler === currentUser?.id && order?.status === 'under_approval';

  const handleEvidenceChange = (field: string, value: string) => {
    setEvidenceForm((prev) => ({ ...prev, [field]: value }));
  };

  const getEvidenceData = () => ({
    paymentAmount: evidenceForm.paymentAmount ? Number(evidenceForm.paymentAmount) : null,
    paymentMethod: evidenceForm.paymentMethod || null,
    paymentStatus: evidenceForm.paymentStatus || null,
    paymentVerification: evidenceForm.paymentVerification || null,
    admissionStatus: evidenceForm.admissionStatus || null,
    admissionConfirmation: evidenceForm.admissionConfirmation || null,
    exceptionReason: evidenceForm.exceptionReason || null,
    responsibleNode: evidenceForm.responsibleNode || null,
    auditRemark: evidenceForm.auditRemark || null,
  });

  const handleCorrect = async () => {
    if (!order || !correctReason.trim()) return;
    try {
      setLocalError('');
      await correctOrder(order.id, {
        version: order.version,
        correctReason,
        venueName: evidenceForm.venueName || undefined,
        courtName: evidenceForm.courtName || undefined,
        reservationDate: evidenceForm.reservationDate || undefined,
        timeSlot: evidenceForm.timeSlot || undefined,
        applicantName: evidenceForm.applicantName || undefined,
        applicantPhone: evidenceForm.applicantPhone || undefined,
        deadline: evidenceForm.deadline || undefined,
        ...getEvidenceData(),
      });
      setCorrectReason('');
    } catch (err: unknown) {
      setLocalError(getErrorMessage(err));
    }
  };

  const handleReview = async (action: string) => {
    if (!order || !opinion.trim()) return;
    try {
      setLocalError('');
      await reviewOrder(order.id, {
        version: order.version,
        action,
        opinion,
        ...getEvidenceData(),
      });
      setOpinion('');
    } catch (err: unknown) {
      setLocalError(getErrorMessage(err));
    }
  };

  const handleApprove = async (action: string) => {
    if (!order || !opinion.trim()) return;
    try {
      setLocalError('');
      await approveOrder(order.id, {
        version: order.version,
        action,
        opinion,
        ...getEvidenceData(),
      });
      setOpinion('');
    } catch (err: unknown) {
      setLocalError(getErrorMessage(err));
    }
  };

  const handleReturn = async () => {
    if (!order || !opinion.trim()) return;
    try {
      setLocalError('');
      await returnOrder(order.id, {
        version: order.version,
        returnOpinion: opinion,
        ...getEvidenceData(),
      });
      setOpinion('');
    } catch (err: unknown) {
      setLocalError(getErrorMessage(err));
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !order) return;
    setUploading(true);
    try {
      await api.uploadAttachment(order.id, file);
      fetchOrder(order.id);
    } catch (err: unknown) {
      setLocalError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const getHandlerName = (o: VenueOrder) => {
    if (!o.currentHandler) return '-';
    const names: Record<string, string> = { u1: '张伟', u2: '李明', u3: '王芳' };
    const roleLabel = USER_ROLE_LABELS[o.currentHandlerRole] || '';
    return `${names[o.currentHandler] || o.currentHandler}（${roleLabel}）`;
  };

  if (loading) return <div className="text-center py-12 text-gray-400">加载中...</div>;
  if (!order) return <div className="text-center py-12 text-gray-400">订单不存在</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/orders')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <h2 className="text-xl font-bold text-gray-900">订单详情</h2>
        <span className="ml-2"><StatusBadge status={order.status} /></span>
        <span className="ml-1"><WarningBadge level={order.warningLevel} /></span>
      </div>

      {(error || localError) && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error || localError}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">订单信息</h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <div><span className="text-gray-400">订单号</span><p className="font-mono text-primary font-medium">{order.orderNo}</p></div>
              <div><span className="text-gray-400">版本</span><p className="text-gray-700">v{order.version}</p></div>
              <div><span className="text-gray-400">场馆名称</span><p className="text-gray-700">{order.venueName}</p></div>
              <div><span className="text-gray-400">场地名称</span><p className="text-gray-700">{order.courtName}</p></div>
              <div><span className="text-gray-400">预约日期</span><p className="text-gray-700">{order.reservationDate}</p></div>
              <div><span className="text-gray-400">时段</span><p className="text-gray-700">{order.timeSlot}</p></div>
              <div><span className="text-gray-400">申请人</span><p className="text-gray-700">{order.applicantName}</p></div>
              <div><span className="text-gray-400">联系电话</span><p className="text-gray-700">{order.applicantPhone}</p></div>
              <div><span className="text-gray-400">截止日期</span><p className="text-gray-700">{order.deadline}</p></div>
              <div><span className="text-gray-400">当前处理人</span><p className="text-gray-700">{getHandlerName(order)}</p></div>
              <div><span className="text-gray-400">创建时间</span><p className="text-gray-700">{new Date(order.createdAt).toLocaleString()}</p></div>
              <div><span className="text-gray-400">更新时间</span><p className="text-gray-700">{new Date(order.updatedAt).toLocaleString()}</p></div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CreditCard size={16} className="text-primary" />支付信息
              </h4>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <div><span className="text-gray-400">支付金额</span><p className="text-gray-700">{order.paymentAmount ? `¥${order.paymentAmount}` : '-'}</p></div>
                <div><span className="text-gray-400">支付方式</span><p className="text-gray-700">{order.paymentMethod || '-'}</p></div>
                <div><span className="text-gray-400">支付状态</span><p>{getPaymentStatusBadge(order.paymentStatus) || '-'}</p></div>
                <div className="col-span-2"><span className="text-gray-400">支付核销凭证</span><p className="text-gray-700 mt-0.5">{order.paymentVerification || '-'}</p></div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MapPin size={16} className="text-primary" />入场信息
              </h4>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <div><span className="text-gray-400">入场状态</span><p>{getAdmissionStatusBadge(order.admissionStatus) || '-'}</p></div>
                <div className="col-span-2"><span className="text-gray-400">入场确认信息</span><p className="text-gray-700 mt-0.5">{order.admissionConfirmation || '-'}</p></div>
              </div>
            </div>

            {order.auditRemark && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-primary" />审计备注
                </h4>
                <p className="text-sm text-gray-700">{order.auditRemark}</p>
              </div>
            )}

            {order.correctReason && (
              <div className="mt-4 flex items-start gap-2">
                <Tag size={14} className="text-yellow-500 mt-0.5" />
                <span className="text-sm text-yellow-700 bg-yellow-50 px-2 py-1 rounded">补正原因：{order.correctReason}</span>
              </div>
            )}
            {order.exceptionReason && (
              <div className="mt-2 flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 mt-0.5" />
                <span className="text-sm text-red-700 bg-red-100 px-2 py-1 rounded font-medium">异常原因：{order.exceptionReason}</span>
              </div>
            )}
            {order.responsibleNode && (
              <div className="mt-2 flex items-start gap-2">
                <User size={14} className="text-red-500 mt-0.5" />
                <span className="text-sm text-red-700 bg-red-100 px-2 py-1 rounded font-medium">责任节点：{order.responsibleNode}</span>
              </div>
            )}
            {order.returnOpinion && (
              <div className="mt-2 flex items-start gap-2">
                <Tag size={14} className="text-orange-500 mt-0.5" />
                <span className="text-sm text-orange-700 bg-orange-50 px-2 py-1 rounded">退回意见：{order.returnOpinion}</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">附件</h3>
            {order.attachments?.length > 0 ? (
              <div className="space-y-2">
                {order.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={api.downloadAttachmentUrl(att.id)}
                    className="flex items-center gap-2 text-sm text-primary hover:text-primary-light p-2 rounded hover:bg-blue-50 transition-colors"
                  >
                    <Download size={14} />
                    {att.fileName}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">暂无附件</p>
            )}
            <label className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary hover:text-primary cursor-pointer transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload size={14} />
              {uploading ? '上传中...' : '上传附件'}
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2"><Clock size={16} />处理记录</h3>
            <div className="space-y-0">
              {order.processingRecords?.length > 0 ? (
                order.processingRecords.map((record, i) => (
                  <div key={record.id} className="flex gap-4 pb-4 relative">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-primary' : 'bg-gray-300'} ring-4 ring-white`} />
                      {i < order.processingRecords.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                    </div>
                    <div className="flex-1 -mt-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{ACTION_LABELS[record.action] || record.action}</span>
                        <span className="text-xs text-gray-400">{new Date(record.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{record.operator} · {USER_ROLE_LABELS[record.operatorRole] || record.operatorRole}</p>
                      {record.opinion && <p className="text-sm text-gray-600 mt-1 bg-gray-50 px-3 py-1.5 rounded-lg">{record.opinion}</p>}
                      <RecordEvidence record={record} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">暂无处理记录</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {canCorrect && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">补正提交</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">补正原因 <span className="text-red-500">*</span></label>
                  <textarea value={correctReason} onChange={(e) => setCorrectReason(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-20" placeholder="请输入补正原因" />
                </div>
                <div className="border-t pt-3">
                  <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                    <CreditCard size={12} className="text-primary" />支付信息
                  </h4>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">支付金额</label>
                      <input type="number" value={evidenceForm.paymentAmount} onChange={(e) => handleEvidenceChange('paymentAmount', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="金额" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">支付方式</label>
                      <select value={evidenceForm.paymentMethod} onChange={(e) => handleEvidenceChange('paymentMethod', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                        <option value="">请选择</option>
                        <option value="微信支付">微信支付</option>
                        <option value="支付宝">支付宝</option>
                        <option value="现金">现金</option>
                        <option value="对公转账">对公转账</option>
                        <option value="会员卡">会员卡</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">支付状态</label>
                      <select value={evidenceForm.paymentStatus} onChange={(e) => handleEvidenceChange('paymentStatus', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                        <option value="">请选择</option>
                        <option value="已核销">已核销</option>
                        <option value="待核销">待核销</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="text-xs text-gray-500 mb-1 block">支付核销凭证</label>
                    <textarea value={evidenceForm.paymentVerification} onChange={(e) => handleEvidenceChange('paymentVerification', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-16" placeholder="核销凭证" />
                  </div>
                </div>
                <div className="border-t pt-3">
                  <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                    <MapPin size={12} className="text-primary" />入场信息
                  </h4>
                  <div className="mb-2">
                    <label className="text-xs text-gray-500 mb-1 block">入场状态</label>
                    <select value={evidenceForm.admissionStatus} onChange={(e) => handleEvidenceChange('admissionStatus', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">请选择</option>
                      <option value="已确认">已确认</option>
                      <option value="待确认">待确认</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="text-xs text-gray-500 mb-1 block">入场确认信息</label>
                    <textarea value={evidenceForm.admissionConfirmation} onChange={(e) => handleEvidenceChange('admissionConfirmation', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-16" placeholder="确认信息" />
                  </div>
                </div>
                <div className="border-t pt-3">
                  <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-primary" />异常与责任
                  </h4>
                  <div className="mb-2">
                    <label className="text-xs text-gray-500 mb-1 block">异常原因</label>
                    <textarea value={evidenceForm.exceptionReason} onChange={(e) => handleEvidenceChange('exceptionReason', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-12" placeholder="异常原因" />
                  </div>
                  <div className="mb-2">
                    <label className="text-xs text-gray-500 mb-1 block">责任节点</label>
                    <input type="text" value={evidenceForm.responsibleNode} onChange={(e) => handleEvidenceChange('responsibleNode', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="责任节点" />
                  </div>
                </div>
                <div className="border-t pt-3">
                  <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                    <FileText size={12} className="text-primary" />审计备注
                  </h4>
                  <textarea value={evidenceForm.auditRemark} onChange={(e) => handleEvidenceChange('auditRemark', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-12" placeholder="审计备注" />
                </div>
                <button onClick={handleCorrect} disabled={!correctReason.trim()} className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-50 transition-colors">提交补正</button>
              </div>
            </div>
          )}

          {canReview && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">审核办理</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">审核意见 <span className="text-red-500">*</span></label>
                  <textarea value={opinion} onChange={(e) => setOpinion(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-20" placeholder="请输入审核意见" />
                </div>
                <div className="border-t pt-3">
                  <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                    <CreditCard size={12} className="text-primary" />支付信息确认
                  </h4>
                  <div className="mb-2">
                    <label className="text-xs text-gray-500 mb-1 block">支付状态</label>
                    <select value={evidenceForm.paymentStatus} onChange={(e) => handleEvidenceChange('paymentStatus', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">请选择</option>
                      <option value="已核销">已核销</option>
                      <option value="待核销">待核销</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="text-xs text-gray-500 mb-1 block">支付核销凭证</label>
                    <textarea value={evidenceForm.paymentVerification} onChange={(e) => handleEvidenceChange('paymentVerification', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-16" placeholder="核销凭证" />
                  </div>
                </div>
                <div className="border-t pt-3">
                  <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                    <MapPin size={12} className="text-primary" />入场信息确认
                  </h4>
                  <div className="mb-2">
                    <label className="text-xs text-gray-500 mb-1 block">入场状态</label>
                    <select value={evidenceForm.admissionStatus} onChange={(e) => handleEvidenceChange('admissionStatus', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">请选择</option>
                      <option value="已确认">已确认</option>
                      <option value="待确认">待确认</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleReview('approve')} disabled={!opinion.trim()} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">审核通过</button>
                  <button onClick={() => handleReview('reject')} disabled={!opinion.trim()} className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">审核退回</button>
                </div>
              </div>
            </div>
          )}

          {canApprove && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">复核归档</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">审批意见 <span className="text-red-500">*</span></label>
                  <textarea value={opinion} onChange={(e) => setOpinion(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-20" placeholder="请输入审批意见" />
                </div>
                <div className="border-t pt-3">
                  <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                    <CreditCard size={12} className="text-primary" />支付信息确认
                  </h4>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">支付金额</label>
                      <input type="number" value={evidenceForm.paymentAmount} onChange={(e) => handleEvidenceChange('paymentAmount', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="金额" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">支付方式</label>
                      <select value={evidenceForm.paymentMethod} onChange={(e) => handleEvidenceChange('paymentMethod', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                        <option value="">请选择</option>
                        <option value="微信支付">微信支付</option>
                        <option value="支付宝">支付宝</option>
                        <option value="现金">现金</option>
                        <option value="对公转账">对公转账</option>
                        <option value="会员卡">会员卡</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">支付状态</label>
                      <select value={evidenceForm.paymentStatus} onChange={(e) => handleEvidenceChange('paymentStatus', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                        <option value="">请选择</option>
                        <option value="已核销">已核销</option>
                        <option value="待核销">待核销</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="text-xs text-gray-500 mb-1 block">支付核销凭证</label>
                    <textarea value={evidenceForm.paymentVerification} onChange={(e) => handleEvidenceChange('paymentVerification', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-16" placeholder="核销凭证" />
                  </div>
                </div>
                <div className="border-t pt-3">
                  <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                    <MapPin size={12} className="text-primary" />入场信息确认
                  </h4>
                  <div className="mb-2">
                    <label className="text-xs text-gray-500 mb-1 block">入场状态</label>
                    <select value={evidenceForm.admissionStatus} onChange={(e) => handleEvidenceChange('admissionStatus', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">请选择</option>
                      <option value="已确认">已确认</option>
                      <option value="待确认">待确认</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="text-xs text-gray-500 mb-1 block">入场确认信息</label>
                    <textarea value={evidenceForm.admissionConfirmation} onChange={(e) => handleEvidenceChange('admissionConfirmation', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-16" placeholder="确认信息" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove('finalize')} disabled={!opinion.trim()} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">审批完成</button>
                  <button onClick={() => handleReturn()} disabled={!opinion.trim()} className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">退回审核</button>
                </div>
              </div>
            </div>
          )}

          {!canCorrect && !canReview && !canApprove && (
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <p className="text-sm text-gray-400">当前角色无操作权限</p>
              <p className="text-xs text-gray-300 mt-1">订单状态：{ORDER_STATUS_LABELS[order.status] || order.status}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
