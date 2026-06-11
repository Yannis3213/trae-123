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

  useEffect(() => {
    const user = getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const result = await api.getOverdueQueue();
      setQueue(result || []);
      if (result && result.length > 0) {
        setExpandedHandler(result[0].handler);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "加载失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchPush = async () => {
    if (selectedOverdueIds.length === 0) {
      showToast("请先选择要推进的逾期单据", "error");
      return;
    }
    setPushing(true);
    try {
      const result = await api.batchOverduePush({
        order_ids: selectedOverdueIds,
        reason: "批量逾期推进",
      });
      const successCount = result.results.filter(r => r.success).length;
      const failCount = result.results.filter(r => !r.success).length;
      if (failCount === 0) {
        showToast(`逾期批量推进成功，共处理 ${successCount} 条`, "success");
      } else {
        showToast(`批量推进完成：成功 ${successCount} 条，失败 ${failCount} 条`, "info");
      }
      setSelectedOverdueIds([]);
      loadQueue();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "批量推进失败", "error");
    } finally {
      setPushing(false);
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
        <button
          onClick={handleBatchPush}
          disabled={pushing || totalOverdue === 0}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          {pushing ? "推进中..." : "逾期批量推进"}
        </button>
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
                              checked={item.orders.filter(o => o.is_overdue).every(o => selectedOverdueIds.includes(o.id))}
                              onChange={(e) => {
                                const overdueOrders = item.orders.filter(o => o.is_overdue);
                                const checked = (e.target as HTMLInputElement).checked;
                                if (checked) {
                                  const newIds = [...selectedOverdueIds];
                                  overdueOrders.forEach(o => {
                                    if (!newIds.includes(o.id)) newIds.push(o.id);
                                  });
                                  setSelectedOverdueIds(newIds);
                                } else {
                                  setSelectedOverdueIds(selectedOverdueIds.filter(id => !overdueOrders.some(o => o.id === id)));
                                }
                              }}
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
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
                                  disabled={!order.is_overdue}
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
