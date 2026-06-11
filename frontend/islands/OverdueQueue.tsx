import { useState, useEffect } from "preact/hooks";
import {
  api,
  OverdueQueueItem,
  LiveSelectionOrder,
} from "../utils/api.ts";
import {
  formatDate,
  showToast,
  getStatusLabel,
  getStatusColor,
  getUser,
  getRoleLabel,
} from "../utils/helpers.ts";

export default function OverdueQueue() {
  const [queue, setQueue] = useState<OverdueQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedHandler, setExpandedHandler] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [selectedOverdueIds, setSelectedOverdueIds] = useState<number[]>([]);
  const [user, setUser] = useState<{ username: string; role: string; name: string } | null>(null);
  const [showPushModal, setShowPushModal] = useState(false);
  const [pushReason, setPushReason] = useState("");
  const [batchResults, setBatchResults] = useState<{ order_id: number; success: boolean; message: string }[] | null>(null);
  const [processing, setProcessing] = useState(false);
  const [allOrders, setAllOrders] = useState<LiveSelectionOrder[]>([]);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      window.location.href = "/login";
      return;
    }
    setUser(currentUser);
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const result = await api.getOverdueQueue();
      setQueue(result || []);
      const orders: LiveSelectionOrder[] = [];
      (result || []).forEach(group => {
        group.orders.forEach(order => orders.push(order));
      });
      setAllOrders(orders);
      if (result && result.length > 0) {
        setExpandedHandler(result[0].handler);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "加载失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const canPushOrder = (order: LiveSelectionOrder): boolean => {
    if (!user || user.role !== "auditor") return false;
    if (order.status !== "pending_audit") return false;
    if (!order.is_overdue) return false;
    if (order.current_handler !== user.username) return false;
    return true;
  };

  const getPushableSelectedCount = (): number => {
    return selectedOverdueIds.filter(id => {
      const order = allOrders.find(o => o.id === id);
      return order && canPushOrder(order);
    }).length;
  };

  const openPushModal = () => {
    const pushableCount = getPushableSelectedCount();
    if (pushableCount === 0) {
      showToast("没有可推进的单据，请选择状态为待审核、已逾期且处理人为自己的单据", "error");
      return;
    }
    setPushReason("");
    setBatchResults(null);
    setShowPushModal(true);
  };

  const handleBatchPush = async () => {
    if (selectedOverdueIds.length === 0) {
      showToast("请选择要推进的单据", "error");
      return;
    }
    if (!pushReason.trim()) {
      showToast("请填写处理原因/审计备注", "error");
      return;
    }
    
    const pushableOrders = selectedOverdueIds
      .map(id => allOrders.find(o => o.id === id))
      .filter((o): o is LiveSelectionOrder => o !== undefined && canPushOrder(o));
    
    if (pushableOrders.length === 0) {
      showToast("没有可推进的单据", "error");
      return;
    }

    setProcessing(true);
    try {
      const resp = await api.batchOverduePush({
        items: pushableOrders.map(order => ({
          order_id: order.id,
          version: order.version,
          reason: pushReason,
        })),
      });
      
      setBatchResults(resp.results);
      const successCount = resp.results.filter(r => r.success).length;
      const failCount = resp.results.filter(r => !r.success).length;
      showToast(`批量推进完成：成功${successCount}条，失败${failCount}条`, successCount > 0 && failCount === 0 ? "success" : "info");
      
      setSelectedOverdueIds([]);
      loadQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "批量推进失败", "error");
    } finally {
      setProcessing(false);
    }
  };

  const getOrderLevel = (order: LiveSelectionOrder): "normal" | "approaching" | "overdue" => {
    if (order.is_overdue) return "overdue";
    const deadline = new Date(order.deadline).getTime();
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    if (deadline - now < oneDay) return "approaching";
    return "normal";
  };

  const totalNormal = queue.reduce((sum, item) => sum + item.normal_count, 0);
  const totalWarning = queue.reduce((sum, item) => sum + item.warning_count, 0);
  const totalOverdue = queue.reduce((sum, item) => sum + item.overdue_count, 0);
  const totalAll = totalNormal + totalWarning + totalOverdue;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">到期预警队列</h1>
          <p className="text-sm text-gray-500 mt-1">按责任人分组展示待处理选品单的到期情况</p>
        </div>
        {user?.role === "auditor" && (
          <button
            onClick={openPushModal}
            disabled={pushing || getPushableSelectedCount() === 0}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            {pushing ? "推进中..." : `逾期批量推进 (${getPushableSelectedCount()})`}
          </button>
        )}
        {user?.role !== "auditor" && (
          <div className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded">
            仅审核员可执行批量推进操作
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="全部待处理"
          value={totalAll}
          color="blue"
          icon="list"
        />
        <StatCard
          label="正常"
          value={totalNormal}
          color="green"
          icon="check"
        />
        <StatCard
          label="临期（24小时内）"
          value={totalWarning}
          color="yellow"
          icon="warning"
        />
        <StatCard
          label="已逾期"
          value={totalOverdue}
          color="red"
          icon="alert"
        />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <svg className="animate-spin h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            加载中...
          </div>
        </div>
      ) : queue.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          暂无到期预警数据
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => (
            <div
              key={item.handler}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <div
                className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedHandler(
                  expandedHandler === item.handler ? null : item.handler
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-700 font-medium">
                      {item.handler.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{item.handler}</div>
                    <div className="text-sm text-gray-500">{getRoleLabel(item.role)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">{item.normal_count}</div>
                      <div className="text-xs text-gray-500">正常</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-yellow-600">{item.warning_count}</div>
                      <div className="text-xs text-gray-500">临期</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">{item.overdue_count}</div>
                      <div className="text-xs text-gray-500">逾期</div>
                    </div>
                  </div>
                  <svg
                    className={`h-5 w-5 text-gray-400 transition-transform ${
                      expandedHandler === item.handler ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {expandedHandler === item.handler && (
                <div className="border-t border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={user?.role === "auditor" && item.orders.filter(o => canPushOrder(o)).length > 0 && 
                                item.orders.filter(o => canPushOrder(o)).every(o => selectedOverdueIds.includes(o.id))}
                              onChange={(e) => {
                                const pushableOrders = item.orders.filter(o => canPushOrder(o));
                                const checked = (e.target as HTMLInputElement).checked;
                                if (checked) {
                                  const newIds = [...selectedOverdueIds];
                                  pushableOrders.forEach(o => {
                                    if (!newIds.includes(o.id)) newIds.push(o.id);
                                  });
                                  setSelectedOverdueIds(newIds);
                                } else {
                                  setSelectedOverdueIds(selectedOverdueIds.filter(id => !pushableOrders.some(o => o.id === id)));
                                }
                              }}
                              disabled={user?.role !== "auditor" || item.orders.filter(o => canPushOrder(o)).length === 0}
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50"
                            />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            选品单号
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            商品名称
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            状态
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            当前处理人
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            版本
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            截止时间
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            预警等级
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {item.orders.map((order) => {
                          const level = getOrderLevel(order);
                          const levelConfig = {
                            normal: { label: "正常", class: "bg-green-100 text-green-800", rowClass: "" },
                            approaching: { label: "临期", class: "bg-yellow-100 text-yellow-800", rowClass: "bg-yellow-50" },
                            overdue: { label: "逾期", class: "bg-red-100 text-red-800", rowClass: "bg-red-50" },
                          };
                          const config = levelConfig[level];
                          const canSelect = canPushOrder(order);

                          return (
                            <tr key={order.id} className={`hover:bg-gray-50 ${config.rowClass}`}>
                              <td className="px-6 py-4">
                                <input
                                  type="checkbox"
                                  checked={selectedOverdueIds.includes(order.id)}
                                  onChange={(e) => {
                                    const checked = (e.target as HTMLInputElement).checked;
                                    if (checked) {
                                      setSelectedOverdueIds([...selectedOverdueIds, order.id]);
                                    } else {
                                      setSelectedOverdueIds(selectedOverdueIds.filter(id => id !== order.id));
                                    }
                                  }}
                                  disabled={!canSelect}
                                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm font-medium text-primary-600">
                                  {order.order_no}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-900">{order.product_name}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                                  {getStatusLabel(order.status)}
                                </span>
                                {order.is_overdue && (
                                  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                                    已逾期
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-900">{order.current_handler || "-"}</span>
                                {order.current_role && (
                                  <div className="text-xs text-gray-500">{getRoleLabel(order.current_role)}</div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                  v{order.version}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`text-sm ${level === "overdue" ? "text-red-600 font-medium" : level === "approaching" ? "text-yellow-600" : "text-gray-500"}`}>
                                  {formatDate(order.deadline)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.class}`}>
                                  {config.label}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <a
                                  href={`/orders/${order.id}`}
                                  className="text-primary-600 hover:text-primary-900 font-medium"
                                >
                                  查看详情
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showPushModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">
                批量逾期推进
                {!batchResults && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({getPushableSelectedCount()} 条单据)
                  </span>
                )}
              </h3>
              <button
                onClick={() => {
                  setShowPushModal(false);
                  setBatchResults(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {!batchResults ? (
                <>
                  {(() => {
                    const pushableCount = getPushableSelectedCount();
                    const skippedCount = selectedOverdueIds.length - pushableCount;
                    return (
                      <div className={`p-3 rounded-lg border ${skippedCount > 0 ? "bg-yellow-50 border-yellow-200" : "bg-blue-50 border-blue-200"}`}>
                        <div className={`text-sm ${skippedCount > 0 ? "text-yellow-800" : "text-blue-800"}`}>
                          <span className="font-medium">可处理 {pushableCount} 条</span>
                          {skippedCount > 0 && (
                            <span>，将跳过 {skippedCount} 条（不满足条件：待审核、已逾期、处理人为自己）</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">📋 单据列表（含版本号）</h4>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                      {(() => {
                        const pushable = selectedOverdueIds
                          .map(id => allOrders.find(o => o.id === id))
                          .filter((o): o is LiveSelectionOrder => o !== undefined && canPushOrder(o));
                        return pushable.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 text-sm">无可推进单据</div>
                        ) : (
                          pushable.map((order, idx) => (
                            <div key={order.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-400 w-6">#{idx + 1}</span>
                                <span className="text-sm font-medium text-primary-600">{order.order_no}</span>
                                <span className="text-sm text-gray-900">{order.product_name}</span>
                              </div>
                              <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                v{order.version}
                              </span>
                            </div>
                          ))
                        );
                      })()}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      💬 统一处理意见 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={pushReason}
                      onChange={(e) => setPushReason((e.target as HTMLTextAreaElement).value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="请填写批量推进的处理意见..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      📝 审计备注（原因说明，将作为 audit_remark）
                    </label>
                    <textarea
                      value={pushReason}
                      onChange={(e) => setPushReason((e.target as HTMLTextAreaElement).value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-gray-50"
                      placeholder="与处理意见一致，将自动作为审计备注提交"
                      disabled
                    />
                    <p className="text-xs text-gray-500 mt-1">💡 审计备注自动同步上述处理意见，确保合规追溯</p>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowPushModal(false);
                        setBatchResults(null);
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleBatchPush}
                      disabled={processing || !pushReason.trim()}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {processing ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          推进中...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                          </svg>
                          确认批量推进
                          <span className="bg-white/20 px-2 py-0.5 rounded text-xs">
                            {getPushableSelectedCount()}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg border ${
                    batchResults.every(r => r.success) 
                      ? "bg-green-50 border-green-200" 
                      : batchResults.every(r => !r.success)
                        ? "bg-red-50 border-red-200"
                        : "bg-yellow-50 border-yellow-200"
                  }`}>
                    <div className={`text-sm font-medium ${
                      batchResults.every(r => r.success) 
                        ? "text-green-700" 
                        : batchResults.every(r => !r.success)
                          ? "text-red-700"
                          : "text-yellow-700"
                    }`}>
                      ✅ 处理结果：共 {batchResults.length} 条，
                      成功 {batchResults.filter(r => r.success).length} 条，
                      失败 {batchResults.filter(r => !r.success).length} 条
                    </div>
                  </div>

                  <div className="max-h-64 overflow-auto space-y-2">
                    {batchResults.map(result => {
                      const order = allOrders.find(o => o.id === result.order_id);
                      return (
                        <div key={result.order_id} className={`p-3 rounded-lg ${
                          result.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                        }`}>
                          <div className="flex items-start gap-2 text-sm">
                            <span className={result.success ? "text-green-600 mt-0.5" : "text-red-600 mt-0.5"}>
                              {result.success ? "✅" : "❌"}
                            </span>
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-primary-600">{order?.order_no || `#${result.order_id}`}</span>
                                <span className="text-gray-700">{order?.product_name || "-"}</span>
                                {order && (
                                  <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                    v{order.version}
                                  </span>
                                )}
                              </div>
                              <div className={`mt-1 text-xs ${result.success ? "text-green-700" : "text-red-700"}`}>
                                {result.success 
                                  ? "逾期推进成功"
                                  : `失败原因：${result.message}`
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setShowPushModal(false);
                        setBatchResults(null);
                      }}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      确定
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: "blue" | "green" | "yellow" | "red";
  icon: "list" | "check" | "warning" | "alert";
}) {
  const colorMap = {
    blue: { bg: "bg-blue-50", text: "text-blue-600", iconBg: "bg-blue-100" },
    green: { bg: "bg-green-50", text: "text-green-600", iconBg: "bg-green-100" },
    yellow: { bg: "bg-yellow-50", text: "text-yellow-600", iconBg: "bg-yellow-100" },
    red: { bg: "bg-red-50", text: "text-red-600", iconBg: "bg-red-100" },
  };

  const icons = {
    list: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    ),
    check: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    warning: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    ),
    alert: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  };

  const config = colorMap[color];

  return (
    <div className={`${config.bg} rounded-xl p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <div className={`text-3xl font-bold ${config.text}`}>{value}</div>
          <div className="text-sm text-gray-600 mt-1">{label}</div>
        </div>
        <div className={`h-12 w-12 ${config.iconBg} rounded-lg flex items-center justify-center`}>
          <svg className={`h-6 w-6 ${config.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {icons[icon]}
          </svg>
        </div>
      </div>
    </div>
  );
}
