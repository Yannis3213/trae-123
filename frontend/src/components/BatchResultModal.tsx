import { X, Check, XCircle, CreditCard, MapPin, AlertTriangle, User } from 'lucide-react';
import type { BatchResult } from '@/types';

interface BatchResultWithEvidence extends BatchResult {
  paymentStatus?: string | null;
  admissionStatus?: string | null;
  exceptionReason?: string | null;
  responsibleNode?: string | null;
  paymentVerification?: string | null;
  admissionConfirmation?: string | null;
}

export default function BatchResultModal({
  results,
  onClose,
}: {
  results: BatchResultWithEvidence[];
  onClose: () => void;
}) {
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  const getPaymentStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    const className = status === '已核销' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
    return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${className}`}>{status}</span>;
  };

  const getAdmissionStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    const className = status === '已确认' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
    return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${className}`}>{status}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">批量处理结果</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-3 flex gap-4 text-sm">
          <span className="text-green-600 font-medium">成功: {successCount}</span>
          <span className="text-red-600 font-medium">失败: {failCount}</span>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-primary font-medium">{r.orderNo}</span>
                    {r.success ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <Check size={14} /> 成功
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                        <XCircle size={14} /> 失败
                      </span>
                    )}
                  </div>
                </div>
                {r.reason && (
                  <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700 font-medium mb-1">处理原因</p>
                    <p className="text-sm text-gray-600">{r.reason}</p>
                  </div>
                )}
                {(r.paymentStatus || r.admissionStatus || r.exceptionReason || r.responsibleNode || r.paymentVerification || r.admissionConfirmation) && (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs text-gray-500 font-medium">证据信息</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {r.paymentStatus && (
                        <div className="flex items-center gap-1.5">
                          <CreditCard size={11} className="text-gray-400" />
                          <span className="text-gray-500">支付状态：</span>
                          {getPaymentStatusBadge(r.paymentStatus)}
                        </div>
                      )}
                      {r.admissionStatus && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={11} className="text-gray-400" />
                          <span className="text-gray-500">入场状态：</span>
                          {getAdmissionStatusBadge(r.admissionStatus)}
                        </div>
                      )}
                      {r.exceptionReason && (
                        <div className="col-span-2 flex items-start gap-1.5 bg-red-50 p-2 rounded">
                          <AlertTriangle size={11} className="text-red-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-red-600 font-medium">异常原因：</span>
                            <span className="text-red-700">{r.exceptionReason}</span>
                          </div>
                        </div>
                      )}
                      {r.responsibleNode && (
                        <div className="flex items-center gap-1.5">
                          <User size={11} className="text-gray-400" />
                          <span className="text-gray-500">责任节点：</span>
                          <span className="text-gray-700">{r.responsibleNode}</span>
                        </div>
                      )}
                      {r.paymentVerification && (
                        <div className="col-span-2">
                          <span className="text-gray-500">支付核销凭证：</span>
                          <span className="text-gray-700">{r.paymentVerification}</span>
                        </div>
                      )}
                      {r.admissionConfirmation && (
                        <div className="col-span-2">
                          <span className="text-gray-500">入场确认信息：</span>
                          <span className="text-gray-700">{r.admissionConfirmation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="px-6 py-3 border-t">
          <button
            onClick={onClose}
            className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
