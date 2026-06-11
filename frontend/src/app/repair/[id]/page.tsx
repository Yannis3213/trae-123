'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, AlertTriangle, FileText, Paperclip, AlertCircle } from 'lucide-react';
import { useStore } from '@/store';
import { STATUS_LABELS } from '@/types';
import type { RepairOrder } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import Timeline from '@/components/Timeline';
import ReturnForm from '@/components/ReturnForm';
import ResubmitForm from '@/components/ResubmitForm';
import AttachmentUpload from '@/components/AttachmentUpload';

export default function RepairDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { currentUser, currentOrder, loading, fetchOrderDetail, submitOrder, processOrder, verifyOrder, reviewOrder, archiveOrder, returnOrder, resubmitOrder } = useStore();
  const [showReturn, setShowReturn] = useState(false);

  useEffect(() => { if (id) fetchOrderDetail(id); }, [id, fetchOrderDetail]);

  const order = currentOrder as RepairOrder | null;
  if (!order) return <div className="text-center py-20 text-gray-400">加载中...</div>;

  const role = currentUser?.role;
  const status = order.status;
  const version = order.version;

  const canProcess = role === 'engineering_supervisor' && status === 'pending_process';
  const canSubmit = role === 'enterprise_service' && status === 'pending_submit';
  const canSubmitVerify = role === 'engineering_supervisor' && status === 'processing';
  const canReview = role === 'park_manager' && status === 'pending_review';
  const canArchive = role === 'park_manager' && status === 'pending_archive';
  const canResubmit = role === 'enterprise_service' && status === 'returned';
  const canReturn = !['archived', 'pending_submit', 'returned'].includes(status);

  const handleSubmit = async () => { await submitOrder(id, version); };
  const handleProcess = async () => { await processOrder(id, version); };
  const handleVerify = async () => { await verifyOrder(id, version); };
  const handleReview = async () => { await reviewOrder(id, version); };
  const handleArchive = async () => { await archiveOrder(id, version); };
  const handleReturn = async (returnReason: string, returnOpinion: string) => { await returnOrder(id, version, returnReason, returnOpinion); setShowReturn(false); };
  const handleResubmit = async (correctionReason: string) => { await resubmitOrder(id, version, correctionReason); };

  const infoItems = [
    { label: '工单号', value: order.order_no },
    { label: '标题', value: order.title },
    { label: '企业名称', value: order.enterprise_name },
    { label: '联系人', value: order.contact_person },
    { label: '联系电话', value: order.contact_phone },
    { label: '分类', value: order.category },
    { label: '紧急程度', value: order.urgency === 'urgent' ? '紧急' : '普通' },
    { label: '截止日期', value: order.deadline?.slice(0, 10) },
    { label: '创建人', value: order.created_by },
    { label: '当前处理人', value: order.current_handler_name },
    { label: '创建时间', value: order.created_at ? new Date(order.created_at).toLocaleString('zh-CN') : '' },
    { label: '版本号', value: String(order.version) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-5 h-5 text-gray-500" /></button>
        <h2 className="text-lg font-semibold text-gray-900">报修单详情</h2>
      </div>

      <div className="card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <span className="text-sm text-gray-500">{STATUS_LABELS[status]}</span>
        </div>
        <div className="flex items-center gap-2">
          {canSubmit && <button onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-1"><CheckCircle className="w-4 h-4" /> 提交</button>}
          {canProcess && <button onClick={handleProcess} disabled={loading} className="btn-primary flex items-center gap-1"><CheckCircle className="w-4 h-4" /> 受理处理</button>}
          {canSubmitVerify && <button onClick={handleVerify} disabled={loading} className="btn-primary flex items-center gap-1"><CheckCircle className="w-4 h-4" /> 提交核验</button>}
          {canReview && <button onClick={handleReview} disabled={loading} className="btn-primary flex items-center gap-1"><CheckCircle className="w-4 h-4" /> 复核通过</button>}
          {canArchive && <button onClick={handleArchive} disabled={loading} className="btn-primary flex items-center gap-1"><CheckCircle className="w-4 h-4" /> 归档</button>}
          {canReturn && !showReturn && <button onClick={() => setShowReturn(true)} className="btn-danger flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> 退回</button>}
        </div>
      </div>

      {canResubmit && <ResubmitForm onSubmit={handleResubmit} loading={loading} />}
      {showReturn && <ReturnForm onSubmit={handleReturn} loading={loading} />}

      <div className="card p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> 基本信息</h3>
        {order.description && <div className="mb-4 p-3 bg-gray-50 rounded-md text-sm text-gray-700">{order.description}</div>}
        <div className="grid grid-cols-3 gap-x-6 gap-y-3">
          {infoItems.map((item) => (
            <div key={item.label} className="flex items-start gap-2">
              <span className="text-sm text-gray-400 flex-shrink-0 w-20">{item.label}</span>
              <span className="text-sm text-gray-800">{item.value || '-'}</span>
            </div>
          ))}
        </div>
        {order.return_reason && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="text-sm font-medium text-red-700">退回原因: {order.return_reason}</div>
            {order.return_opinion && <div className="text-sm text-red-600 mt-1">退回意见: {order.return_opinion}</div>}
          </div>
        )}
        {order.correction_reason && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-sm font-medium text-blue-700">纠正原因: {order.correction_reason}</div>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2"><Paperclip className="w-5 h-5 text-primary" /> 附件</h3>
        <AttachmentUpload repairId={id} attachments={order.attachments ?? []} />
      </div>

      <div className="card p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-primary" /> 处理记录</h3>
        <Timeline records={order.processing_records ?? []} />
      </div>

      {order.exception_reasons && order.exception_reasons.length > 0 && (
        <div className="card p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-500" /> 异常原因</h3>
          <div className="space-y-2">
            {order.exception_reasons.map((er) => (
              <div key={er.id} className="p-3 border-2 border-red-200 rounded-md bg-red-50">
                <div className="text-sm font-medium text-red-700">[{er.exception_type}] {er.reason}</div>
                {er.detail && <div className="text-sm text-red-600 mt-1">{er.detail}</div>}
                <div className="text-xs text-red-500 mt-1">{new Date(er.created_at).toLocaleString('zh-CN')}{er.resolved ? ' (已解决)' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {order.audit_notes && order.audit_notes.length > 0 && (
        <div className="card p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> 审核备注</h3>
          <div className="space-y-2">
            {order.audit_notes.map((note) => (
              <div key={note.id} className="p-3 bg-gray-50 rounded-md">
                <div className="text-sm text-gray-700">{note.content}</div>
                <div className="text-xs text-gray-400 mt-1">[{note.note_type}] {note.created_by} - {new Date(note.created_at).toLocaleString('zh-CN')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
