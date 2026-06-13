'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { NearExpiryOrder, OrderStatus, statusLabels, statusColors, EvidenceType, evidenceTypeLabels, Stats } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import CreateOrderModal from '@/components/CreateOrderModal';
import BatchProcessModal from '@/components/BatchProcessModal';

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<NearExpiryOrder[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [onlyMy, setOnlyMy] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchAction, setBatchAction] = useState('');

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [ordersData, statsData] = await Promise.all([
        api.listOrders({ status: statusFilter || undefined, keyword: keyword || undefined, only_my: onlyMy }),
        api.getStats(),
      ]);
      setOrders(ordersData);
      setStats(statsData);
    } catch (err: any) {
      console.error('加载失败:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      loadData();
    }
  }, [authLoading, user, statusFilter, keyword, onlyMy]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(orders.map(o => o.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelect = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    }
  };

  const getUrgencyClass = (dueDate: string, status: OrderStatus) => {
    if (status === 'closed') return '';
    const due = new Date(dueDate).getTime();
    const now = Date.now();
    const diffDays = (due - now) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) return 'bg-red-50 border-red-200';
    if (diffDays < 3) return 'bg-amber-50 border-amber-200';
    return '';
  };

  const getUrgencyBadge = (dueDate: string, status: OrderStatus) => {
    if (status === 'closed') return null;
    const due = new Date(dueDate).getTime();
    const now = Date.now();
    const diffDays = (due - now) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) {
      const overdueDays = Math.abs(Math.floor(diffDays));
      return <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded">逾期{overdueDays}天</span>;
    }
    if (diffDays < 3) {
      return <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded">临期</span>;
    }
    return <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded">正常</span>;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const canCreate = user?.role === 'shop_clerk';
  const canBatchProcess = user?.role === 'pharmacist' || user?.role === 'area_manager';

  const handleBatchAction = (action: string) => {
    setBatchAction(action);
    setShowBatchModal(true);
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">全部处理单</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg border border-amber-200 p-4 bg-amber-50">
            <div className="text-sm text-amber-700">待派发/待处理</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{stats.pending_dispatch}</div>
          </div>
          <div className="bg-white rounded-lg border border-blue-200 p-4 bg-blue-50">
            <div className="text-sm text-blue-700">处理中</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">{stats.processing}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">已关闭</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">{stats.closed}</div>
          </div>
        </div>
      )}

      {/* 到期预警 */}
      {stats && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">📊 到期预警队列</h3>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-sm text-gray-600">正常: <span className="font-medium text-gray-800">{stats.normal}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="text-sm text-gray-600">临期(3天内): <span className="font-medium text-amber-600">{stats.near_due}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-sm text-gray-600">逾期: <span className="font-medium text-red-600">{stats.overdue}</span></span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-600">退回补正: <span className="font-medium text-red-600">{stats.returned}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">我的待办: <span className="font-medium text-blue-600">{stats.my_pending}</span></span>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* 左侧：处理单队列 */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-lg border border-gray-200">
            {/* 工具栏 */}
            <div className="p-4 border-b border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-800">近效期处理单队列</h3>
                <div className="flex gap-2">
                  {canCreate && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      + 新建处理单
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">状态:</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="">全部</option>
                    <option value="pending_dispatch">待派发</option>
                    <option value="processing">处理中</option>
                    <option value="returned">已退回</option>
                    <option value="closed">已关闭</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={onlyMy}
                      onChange={(e) => setOnlyMy(e.target.checked)}
                      className="mr-1"
                    />
                    只看我的
                  </label>
                </div>

                <div className="flex-1 max-w-xs">
                  <input
                    type="text"
                    placeholder="搜索单号/药品/门店..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>

              {canBatchProcess && selectedOrders.length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded text-sm">
                  <span className="text-blue-700">已选择 {selectedOrders.length} 项</span>
                  <div className="flex gap-2 ml-2">
                    {user?.role === 'pharmacist' && (
                      <>
                        <button
                          onClick={() => handleBatchAction('process')}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          批量处理
                        </button>
                        <button
                          onClick={() => handleBatchAction('submit_review')}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          批量提交复核
                        </button>
                      </>
                    )}
                    {user?.role === 'area_manager' && (
                      <>
                        <button
                          onClick={() => handleBatchAction('review_approve')}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          批量复核通过
                        </button>
                        <button
                          onClick={() => handleBatchAction('review_reject')}
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                        >
                          批量退回
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 列表 */}
            {loading ? (
              <div className="p-8 text-center text-gray-500">加载中...</div>
            ) : orders.length === 0 ? (
              <div className="p-8 text-center text-gray-500">暂无处理单</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2 text-left w-10">
                        <input
                          type="checkbox"
                          checked={selectedOrders.length === orders.length && orders.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">单号</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">药品信息</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">门店</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">有效期</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">状态</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">到期预警</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${getUrgencyClass(order.due_date, order.status)}`}
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(order.id)}
                            onChange={(e) => handleSelect(order.id, e.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-mono text-blue-600">{order.order_no}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-gray-800">{order.product_name}</div>
                          <div className="text-xs text-gray-500">批次: {order.batch_no} · {order.quantity}盒</div>
                        </td>
                        <td className="px-3 py-3 text-gray-600">{order.store_name}</td>
                        <td className="px-3 py-3 text-gray-600">{formatDate(order.expiry_date)}</td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[order.status]}`}>
                            {statusLabels[order.status]}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {getUrgencyBadge(order.due_date, order.status)}
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/orders/${order.id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            详情
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：证据摘要 */}
        <div className="w-80 shrink-0 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">📄 证据摘要</h3>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">近效期巡检</span>
                  <EvidenceBadge type="inspection" />
                </div>
                <p className="text-xs text-gray-500 mt-1">门店店员提交的巡检记录</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">调拨申请</span>
                  <EvidenceBadge type="transfer" />
                </div>
                <p className="text-xs text-gray-500 mt-1">执业药师发起的调拨单据</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">下架确认</span>
                  <EvidenceBadge type="removal" />
                </div>
                <p className="text-xs text-gray-500 mt-1">下架处理确认凭证</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">📋 角色职责</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-blue-600">👤</span>
                <div>
                  <span className="font-medium text-gray-700">门店店员</span>
                  <p className="text-gray-500">创建处理单、补正材料、提交巡检记录</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">💊</span>
                <div>
                  <span className="font-medium text-gray-700">执业药师</span>
                  <p className="text-gray-500">处理近效期药品、调拨、下架、提交复核</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-600">📊</span>
                <div>
                  <span className="font-medium text-gray-700">区域经理</span>
                  <p className="text-gray-500">复核处理单、通过或退回补正</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateOrderModal onClose={() => setShowCreateModal(false)} onSuccess={loadData} />
      )}

      {showBatchModal && (
        <BatchProcessModal
          orderIds={selectedOrders}
          action={batchAction}
          onClose={() => {
            setShowBatchModal(false);
            setSelectedOrders([]);
          }}
          onSuccess={() => {
            setShowBatchModal(false);
            setSelectedOrders([]);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function EvidenceBadge({ type }: { type: EvidenceType }) {
  const colors: Record<EvidenceType, string> = {
    inspection: 'bg-green-100 text-green-700',
    transfer: 'bg-blue-100 text-blue-700',
    removal: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${colors[type]}`}>
      {evidenceTypeLabels[type]}
    </span>
  );
}
