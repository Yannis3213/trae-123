import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [node, setNode] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [meta, setMeta] = useState(null);
  const [showBatch, setShowBatch] = useState(false);
  const [batchAction, setBatchAction] = useState("");
  const [batchRemark, setBatchRemark] = useState("");
  const [batchResult, setBatchResult] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, authLoading, navigate]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (node) params.node = node;
      if (search) params.search = search;
      const data = await api.listOrders(params);
      setOrders(data.orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadMeta = async () => {
    try {
      const data = await api.getMeta();
      setMeta(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user) {
      loadMeta();
      loadOrders();
    }
  }, [user, status, node, search]);

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selected.length === orders.length) {
      setSelected([]);
    } else {
      setSelected(orders.map((o) => o.id));
    }
  };

  const handleBatch = async () => {
    if (!batchAction) return;
    setBatchLoading(true);
    setBatchResult(null);
    try {
      const result = await api.batchProcess(selected, batchAction, batchRemark);
      setBatchResult(result);
      await loadOrders();
      setSelected([]);
    } catch (e) {
      setBatchResult({ error: e.message, detail: e.detail });
    } finally {
      setBatchLoading(false);
    }
  };

  const roleNames = {
    registrar: "入职办理登记员",
    auditor: "入职办理审核主管",
    reviewer: "企业人事共享中心复核负责人",
  };

  const statusNames = {
    pending: "待派发",
    processing: "处理中",
    returned: "退回补正",
    completed: "已完成",
    closed: "已关闭",
  };

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    returned: "bg-orange-100 text-orange-800",
    completed: "bg-green-100 text-green-800",
    closed: "bg-gray-100 text-gray-800",
  };

  const nodeNames = {
    docs: "入职资料",
    contract: "合同签署",
    account: "账号开通",
  };

  const warningColors = {
    normal: "bg-green-100 text-green-700",
    near: "bg-yellow-100 text-yellow-700",
    overdue: "bg-red-100 text-red-700",
  };

  const warningNames = {
    normal: "正常",
    near: "临期",
    overdue: "逾期",
  };

  const getAvailableActions = () => {
    if (!user) return [];
    const actions = [];
    if (user.role === "registrar") {
      actions.push({ id: "submit", name: "提交" });
    }
    if (user.role === "auditor") {
      actions.push(
        { id: "claim", name: "认领" },
        { id: "approve", name: "通过" },
        { id: "return", name: "退回" }
      );
    }
    if (user.role === "reviewer") {
      actions.push(
        { id: "claim", name: "认领" },
        { id: "approve", name: "通过" },
        { id: "return", name: "退回" },
        { id: "close", name: "关闭" }
      );
    }
    return actions;
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-800">入职办理单</h1>
            <p className="text-sm text-gray-500">{roleNames[user.role]} - {user.name}</p>
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={() => setShowBatch(!showBatch)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition"
            >
              批量处理
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {showBatch && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            <h3 className="font-medium text-gray-800 mb-3">批量处理（已选 {selected.length} 条）</h3>
            <div className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="block text-sm text-gray-600 mb-1">操作</label>
                <select
                  value={batchAction}
                  onChange={(e) => setBatchAction(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">请选择操作</option>
                  {getAvailableActions().map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-64">
                <label className="block text-sm text-gray-600 mb-1">备注</label>
                <input
                  type="text"
                  value={batchRemark}
                  onChange={(e) => setBatchRemark(e.target.value)}
                  placeholder="填写批量处理备注"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <button
                onClick={handleBatch}
                disabled={!batchAction || selected.length === 0 || batchLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {batchLoading ? "处理中..." : "批量执行"}
              </button>
            </div>

            {batchResult && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                {batchResult.error ? (
                  <div className="text-red-600">
                    <p className="font-medium">{batchResult.error}</p>
                    {batchResult.detail && <p className="text-sm mt-1">{batchResult.detail}</p>}
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-gray-700">
                      共 {batchResult.total} 条，成功 {batchResult.success_count} 条，失败 {batchResult.fail_count} 条
                    </p>
                    <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                      {batchResult.results.map((r) => {
                        const order = orders.find((o) => o.id === r.order_id);
                        return (
                          <div
                            key={r.order_id}
                            className={`text-sm px-3 py-2 rounded flex justify-between ${
                              r.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                            }`}
                          >
                            <span>{order?.title || r.order_id}</span>
                            <span>{r.reason}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="block text-sm text-gray-600 mb-1">状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-32"
              >
                <option value="">全部状态</option>
                {meta?.statuses?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">节点</label>
              <select
                value={node}
                onChange={(e) => setNode(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-32"
              >
                <option value="">全部节点</option>
                {meta?.nodes?.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-48">
              <label className="block text-sm text-gray-600 mb-1">搜索</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索标题或候选人"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setStatus(""); setNode(""); setSearch(""); }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                重置筛选
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {showBatch && (
                    <th className="p-3 text-left w-12">
                      <input
                        type="checkbox"
                        checked={selected.length === orders.length && orders.length > 0}
                        onChange={selectAll}
                        className="rounded"
                      />
                    </th>
                  )}
                  <th className="p-3 text-left text-gray-600 font-medium">入职单</th>
                  <th className="p-3 text-left text-gray-600 font-medium">候选人</th>
                  <th className="p-3 text-left text-gray-600 font-medium">部门</th>
                  <th className="p-3 text-left text-gray-600 font-medium">当前节点</th>
                  <th className="p-3 text-left text-gray-600 font-medium">状态</th>
                  <th className="p-3 text-left text-gray-600 font-medium">预警</th>
                  <th className="p-3 text-left text-gray-600 font-medium">处理人</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={showBatch ? 8 : 7} className="p-8 text-center text-gray-500">
                      加载中...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={showBatch ? 8 : 7} className="p-8 text-center text-gray-500">
                      暂无入职办理单
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate({ to: "/orders/$id", params: { id: order.id } })}
                    >
                      {showBatch && (
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.includes(order.id)}
                            onChange={() => toggleSelect(order.id)}
                            className="rounded"
                          />
                        </td>
                      )}
                      <td className="p-3">
                        <div className="font-medium text-gray-800">{order.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          创建于 {new Date(order.created_at).toLocaleDateString("zh-CN")}
                        </div>
                      </td>
                      <td className="p-3 text-gray-700">{order.candidate_name}</td>
                      <td className="p-3 text-gray-700">{order.department}</td>
                      <td className="p-3">
                        <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">
                          {nodeNames[order.current_node] || order.current_node}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${statusColors[order.status] || "bg-gray-100 text-gray-700"}`}>
                          {statusNames[order.status] || order.status}
                        </span>
                        {order.is_exception && (
                          <span className="ml-2 text-xs text-red-600">异常</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${warningColors[order.warning_level]}`}>
                          {warningNames[order.warning_level]}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(order.due_date).toLocaleDateString("zh-CN")}
                        </div>
                      </td>
                      <td className="p-3 text-gray-700">
                        {order.handler_name || "待认领"}
                        <div className="text-xs text-gray-500">
                          {roleNames[order.current_role]}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          共 {orders.length} 条记录
        </div>
      </main>
    </div>
  );
}
