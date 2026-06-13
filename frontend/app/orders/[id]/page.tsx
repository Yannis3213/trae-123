'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { OrderDetail, statusLabels, statusColors, evidenceTypeLabels } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import ProcessActionPanel from '@/components/ProcessActionPanel';
import EvidenceUploadPanel from '@/components/EvidenceUploadPanel';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'audit'>('overview');

  const orderId = params.id as string;

  const loadOrder = async () => {
    setLoading(true);
    try {
      const data = await api.getOrderDetail(orderId);
      setOrder(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadOrder();
    }
  }, [orderId, user]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">加载中...</div>;
  }

  if (!order) {
    return <div className="p-8 text-center text-gray-500">处理单不存在</div>;
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateOnly = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const getUrgencyInfo = () => {
    if (order.status === 'closed') return { label: '已完成', color: 'text-gray-500 bg-gray-100' };
    if (order.is_overdue) return { label: '已逾期', color: 'text-red-700 bg-red-100' };
    if (order.is_near_due) return { label: '临期预警', color: 'text-amber-700 bg-amber-100' };
    return { label: '正常', color: 'text-green-700 bg-green-100' };
  };

  const urgency = getUrgencyInfo();

  const hasEvidence = (type: string) => {
    return order.attachments.some(a => a.evidence_type === type);
  };

  return (
    <div className="space-y-6">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm">
          ← 返回列表
        </Link>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${urgency.color}`}>
            {urgency.label}
          </span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[order.status]}`}>
            {statusLabels[order.status]}
          </span>
        </div>
      </div>

      <div className="flex gap-6">
        {/* 左侧：主要信息 */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* 基本信息卡片 */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{order.product_name}</h2>
                <p className="text-sm text-gray-500 font-mono mt-1">{order.order_no}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">数量</div>
                <div className="text-xl font-bold text-gray-800">{order.quantity} <span className="text-sm font-normal">盒</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">门店：</span>
                <span className="text-gray-800">{order.store_name}</span>
              </div>
              <div>
                <span className="text-gray-500">批次号：</span>
                <span className="text-gray-800 font-mono">{order.batch_no}</span>
              </div>
              <div>
                <span className="text-gray-500">有效期至：</span>
                <span className="text-gray-800">{formatDateOnly(order.expiry_date)}</span>
              </div>
              <div>
                <span className="text-gray-500">处理截止：</span>
                <span className={order.is_overdue ? 'text-red-600 font-medium' : order.is_near_due ? 'text-amber-600 font-medium' : 'text-gray-800'}>
                  {formatDateOnly(order.due_date)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">创建人：</span>
                <span className="text-gray-800">{order.created_by}</span>
              </div>
              <div>
                <span className="text-gray-500">当前处理人：</span>
                <span className="text-gray-800">{order.current_handler || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">创建时间：</span>
                <span className="text-gray-800">{formatDate(order.created_at)}</span>
              </div>
              <div>
                <span className="text-gray-500">更新时间：</span>
                <span className="text-gray-800">{formatDate(order.updated_at)}</span>
              </div>
            </div>

            {order.closed_at && (
              <div className="mt-4 pt-4 border-t border-gray-100 text-sm">
                <span className="text-gray-500">关闭时间：</span>
                <span className="text-gray-800">{formatDate(order.closed_at)}</span>
              </div>
            )}
          </div>

          {/* 标签页 */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 px-4">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === 'overview'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  证据材料
                </button>
                <button
                  onClick={() => setActiveTab('records')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === 'records'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  处理记录
                </button>
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === 'audit'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  审计备注
                </button>
              </div>
            </div>

            <div className="p-4">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {(['inspection', 'transfer', 'removal'] as const).map(type => (
                      <div
                        key={type}
                        className={`p-4 rounded-lg border-2 ${
                          hasEvidence(type)
                            ? 'border-green-200 bg-green-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            {evidenceTypeLabels[type]}
                          </span>
                          {hasEvidence(type) ? (
                            <span className="text-green-600 text-xs font-medium">✓ 已上传</span>
                          ) : (
                            <span className="text-red-500 text-xs font-medium">✗ 缺失</span>
                          )}
                        </div>
                        {hasEvidence(type) ? (
                          <div className="text-xs text-gray-600">
                            {order.attachments.filter(a => a.evidence_type === type).map(a => (
                              <div key={a.id} className="truncate">📎 {a.file_name}</div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">暂无上传记录</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 异常原因 */}
                  {order.exception_reasons.filter(e => !e.resolved).length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-red-700 mb-2">⚠️ 异常原因</h4>
                      <div className="space-y-2">
                        {order.exception_reasons.filter(e => !e.resolved).map(e => (
                          <div key={e.id} className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                            <div className="text-red-800">{e.reason}</div>
                            <div className="text-xs text-red-600 mt-1">
                              报告人：{e.reported_by} · {formatDate(e.created_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <EvidenceUploadPanel orderId={order.id} onUploaded={loadOrder} />
                </div>
              )}

              {activeTab === 'records' && (
                <div className="space-y-1">
                  {order.processing_records.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">暂无处理记录</div>
                  ) : (
                    <ol className="relative border-l-2 border-gray-200 ml-3">
                      {order.processing_records.map((record, idx) => (
                        <li key={record.id} className="mb-4 ml-6">
                          <span className="absolute -left-[9px] flex items-center justify-center w-4 h-4 bg-blue-600 rounded-full border-2 border-white">
                          </span>
                          <div className="flex items-baseline gap-2">
                            <h4 className="text-sm font-medium text-gray-800">{record.action}</h4>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[record.to_status]}`}>
                              {statusLabels[record.to_status]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {record.operator_role === 'shop_clerk' ? '门店店员' :
                             record.operator_role === 'pharmacist' ? '执业药师' : '区域经理'}
                            {' '}{record.operator}
                            {' · '}{formatDate(record.created_at)}
                          </p>
                          {record.remark && (
                            <p className="text-sm text-gray-600 mt-1 p-2 bg-gray-50 rounded">
                              {record.remark}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {activeTab === 'audit' && (
                <AuditNotesTab order={order} onAdded={loadOrder} />
              )}
            </div>
          </div>
        </div>

        {/* 右侧：操作面板 */}
        <div className="w-80 shrink-0">
          <ProcessActionPanel order={order} onProcessed={loadOrder} />
        </div>
      </div>
    </div>
  );
}

function AuditNotesTab({ order, onAdded }: { order: OrderDetail; onAdded: () => void }) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      await api.addAuditNote(order.id, content);
      setContent('');
      onAdded();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="添加审计备注..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          添加
        </button>
      </form>

      <div className="space-y-3">
        {order.audit_notes.length === 0 ? (
          <div className="text-center text-gray-500 py-8">暂无审计备注</div>
        ) : (
          order.audit_notes.map(note => (
            <div key={note.id} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{note.author}</span>
                <span className="text-xs text-gray-500">{formatDate(note.created_at)}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{note.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
