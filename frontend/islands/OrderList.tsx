import { useState, useEffect } from "preact/hooks";
import { api, LiveSelectionOrder } from "../utils/api.ts";
import { formatDate, showToast, getStatusLabel, getStatusColor, getUser, getRoleLabel } from "../utils/helpers.ts";

export default function OrderList() {
  const [orders, setOrders] = useState<LiveSelectionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [keyword, setKeyword] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchAction, setBatchAction] = useState<"audit_pass" | "review">("audit_pass");
  const [batchOpinion, setBatchOpinion] = useState("");
  const [batchResult, setBatchResult] = useState<{ results: { order_id: number; success: boolean; message: string }[] } | null>(null);
  const [user, setUser] = useState<{ username: string; role: string; name: string } | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    if (!currentUser) {
      window.location.href = "/login";
      return;
    }
    loadOrders();
  }, [status, page]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const result = await api.getOrders({
        status: status || undefined,
        keyword: keyword || undefined,
        page,
        pageSize,
      });
      setOrders(result.list || []);
      setTotal(result.total || 0);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "加载失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setKeyword(searchKeyword);
    setPage(1);
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSelectAll = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) {
      setSelectedIds(orders.map((o) => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: number, e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    }
  };

  const handleStatusFilter = (s: string) => {
    setStatus(s);
    setPage(1);
  };

  const canBatchProcess = (order: LiveSelectionOrder, action: "audit_pass" | "review"): boolean => {
    if (!user) return false;
    if (order.current_handler !== user.username) return false;
    
    if (action === "audit_pass") {
      return order.status === "pending_audit" && user.role === "auditor";
    }
    if (action === "review") {
      return order.status === "audit_passed" && user.role === "reviewer";
    }
    return false;
  };

  const getBatchProcessableCount = (action: "audit_pass" | "review"): number => {
    return selectedIds.filter(id => {
      const order = orders.find(o => o.id === id);
      return order && canBatchProcess(order, action);
    }).length;
  };

  const openBatchModal = (action: "audit_pass" | "review") => {
    if (selectedIds.length === 0) {
      showToast("请先选择要处理的选品单", "error");
      return;
    }
    const processableCount = getBatchProcessableCount(action);
    if (processableCount === 0) {
      const statusRequired = action === "audit_pass" ? "待审核" : "审核通过";
      showToast(`没有可处理的单据，请选择状态为「${statusRequired}」且处理人为自己的单据`, "error");
      return;
    }
    setBatchAction(action);
    setBatchResult(null);
    setShowBatchModal(true);
  };

  const handleBatchProcess = async () => {
    try {
      const processableOrders = selectedIds
        .map(id => orders.find(o => o.id === id))
        .filter((o): o is LiveSelectionOrder => o !== undefined && canBatchProcess(o, batchAction));
      
      if (processableOrders.length === 0) {
        showToast("没有可处理的单据", "error");
        return;
      }

      const result = await api.batchProcess({
        action: batchAction,
        order_ids: processableOrders.map(o => o.id),
        opinion: batchOpinion || undefined,
      });
      setBatchResult(result);
      const successCount = result.results.filter((r) => r.success).length;
      const failedCount = result.results.filter((r) => !r.success).length;
      showToast(
        `批量处理完成：成功 ${successCount} 条，失败 ${failedCount} 条`,
        failedCount === 0 ? "success" : "info"
      );
      if (successCount > 0) {
        loadOrders();
        setSelectedIds([]);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "批量处理失败", "error");
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const statusOptions = [
    { value: "", label: "全部" },
    { value: "draft", label: "草稿" },
    { value: "pending_audit", label: "待审核" },
    { value: "audit_passed", label: "审核通过" },
    { value: "synced", label: "已同步" },
    { value: "returned", label: "退回补正" },
  ];

  const canBatchAudit = user?.role === "auditor";
  const canBatchReview = user?.role === "reviewer";
  const canCreate = user?.role === "registrar";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatusFilter(opt.value)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  status === opt.value
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索选品单号、商品名称..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword((e.target as HTMLInputElement).value)}
                onKeyPress={handleKeyPress}
                className="w-64 px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              搜索
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">选品单列表</h2>
            <span className="text-sm text-gray-500">共 {total} 条</span>
            {selectedIds.length > 0 && (
              <span className="text-sm text-primary-600 font-medium">
                已选 {selectedIds.length} 项
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {canCreate && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                新建选品单
              </button>
            )}
            {canBatchAudit && (
              <button
                onClick={() => openBatchModal("audit_pass")}
                disabled={getBatchProcessableCount("audit_pass") === 0}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                批量审核 ({getBatchProcessableCount("audit_pass")})
              </button>
            )}
            {canBatchReview && (
              <button
                onClick={() => openBatchModal("review")}
                disabled={getBatchProcessableCount("review") === 0}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                批量归档 ({getBatchProcessableCount("review")})
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && selectedIds.length === orders.length}
                    onChange={handleSelectAll}
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
                  品类
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  价格
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  库存
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  当前处理人
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  截止时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    暂无数据
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={(e) => handleSelect(order.id, e)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-primary-600">
                        {order.order_no}
                      </span>
                      {order.is_overdue && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          逾期
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{order.product_name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">{order.product_category}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 font-medium">¥{order.price?.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">{order.stock}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.current_handler || "-"}</div>
                      {order.current_role && (
                        <div className="text-xs text-gray-500">{getRoleLabel(order.current_role)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${order.is_overdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                        {formatDate(order.deadline)}
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              第 {page} 页 / 共 {totalPages} 页
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-md text-sm font-medium ${
                      page === pageNum
                        ? "bg-primary-600 text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateOrderModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadOrders();
          }}
        />
      )}

      {showBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {batchAction === "audit_pass" ? "批量审核" : "批量归档"}
              </h3>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {!batchResult ? (
                <>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">待处理单据</h4>
                    <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                      {selectedIds
                        .map(id => orders.find(o => o.id === id))
                        .filter((o): o is LiveSelectionOrder => o !== undefined && canBatchProcess(o, batchAction))
                        .map(order => (
                          <div key={order.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-primary-600">{order.order_no}</span>
                              <span className="text-sm text-gray-900">{order.product_name}</span>
                            </div>
                            <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                              v{order.version}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {selectedIds.filter(id => {
                    const order = orders.find(o => o.id === id);
                    return order && !canBatchProcess(order, batchAction);
                  }).length > 0 && (
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="text-sm text-yellow-800">
                        <span className="font-medium">注意：</span>
                        有 {selectedIds.filter(id => {
                          const order = orders.find(o => o.id === id);
                          return order && !canBatchProcess(order, batchAction);
                        }).length} 条单据因状态不匹配或处理人不匹配，将被跳过
                      </div>
                    </div>
                  )}

                  {batchAction === "audit_pass" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        审核意见
                      </label>
                      <textarea
                        value={batchOpinion}
                        onChange={(e) => setBatchOpinion((e.target as HTMLTextAreaElement).value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="请输入审核意见（可选）"
                      />
                    </div>
                  )}
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setShowBatchModal(false)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleBatchProcess}
                      className={`px-4 py-2 text-white rounded-lg ${
                        batchAction === "audit_pass"
                          ? "bg-yellow-500 hover:bg-yellow-600"
                          : "bg-green-500 hover:bg-green-600"
                      }`}
                    >
                      确认{batchAction === "audit_pass" ? "审核" : "归档"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {batchResult.results.filter((r) => r.success).length}
                      </div>
                      <div className="text-xs text-gray-500">成功</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {batchResult.results.filter((r) => !r.success).length}
                      </div>
                      <div className="text-xs text-gray-500">失败</div>
                    </div>
                  </div>
                  {batchResult.results.filter((r) => !r.success).length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {batchResult.results.filter((r) => !r.success).map((item, index) => (
                        <div key={index} className="p-3 bg-red-50 rounded-lg text-sm">
                          <div className="font-medium text-red-800">选品单 ID: {item.order_id}</div>
                          <div className="text-red-600 text-xs mt-1">失败原因: {item.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setShowBatchModal(false);
                        setBatchResult(null);
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

function CreateOrderModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    product_name: "",
    product_category: "",
    price: "",
    stock: "",
    deadline: "",
    submission_evidence: "",
    sample_evidence: "",
    registration_evidence: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createOrder({
        ...formData,
        price: Number(formData.price),
        stock: Number(formData.stock),
      });
      showToast("创建成功", "success");
      onSuccess();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "创建失败", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ["美妆护肤", "食品饮料", "服装鞋包", "数码家电", "家居日用", "母婴用品", "其他"];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">新建选品单</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                商品名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: (e.target as HTMLInputElement).value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="请输入商品名称"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                商品品类 <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.product_category}
                onChange={(e) => setFormData({ ...formData, product_category: (e.target as HTMLSelectElement).value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">请选择品类</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                价格（元） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: (e.target as HTMLInputElement).value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="请输入价格"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                库存数量 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: (e.target as HTMLInputElement).value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="请输入库存数量"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                截止时间 <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: (e.target as HTMLInputElement).value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">证据材料</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  选品提报证据
                </label>
                <input
                  type="text"
                  value={formData.submission_evidence}
                  onChange={(e) => setFormData({ ...formData, submission_evidence: (e.target as HTMLInputElement).value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="请输入提报证据链接或说明"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  样品确认证据
                </label>
                <input
                  type="text"
                  value={formData.sample_evidence}
                  onChange={(e) => setFormData({ ...formData, sample_evidence: (e.target as HTMLInputElement).value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="请输入样品确认证据链接或说明"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  登记证据
                </label>
                <input
                  type="text"
                  value={formData.registration_evidence}
                  onChange={(e) => setFormData({ ...formData, registration_evidence: (e.target as HTMLInputElement).value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="请输入登记证据链接或说明"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? "创建中..." : "创建选品单"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
