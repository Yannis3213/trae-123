import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";

export const Route = createFileRoute("/orders/$id")({
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [records, setRecords] = useState([]);
  const [auditNotes, setAuditNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [remark, setRemark] = useState("");
  const [processing, setProcessing] = useState(false);
  const [auditNote, setAuditNote] = useState("");
  const [auditStatusLabel, setAuditStatusLabel] = useState("处理中");
  const [showAuditForm, setShowAuditForm] = useState(false);

  const loadDetail = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getOrder(id);
      setOrder(data.order);
      setAttachments(data.attachments || []);
      setRecords(data.records || []);
      setAuditNotes(data.audit_notes || []);
    } catch (e) {
      setError(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDetail();
    }
  }, [user, id]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, authLoading, navigate]);

  const handleAction = async () => {
    if (!action || !order) return;
    setProcessing(true);
    setError("");
    try {
      await api.processOrder(order.id, action, remark, order.version);
      await loadDetail();
      setAction("");
      setRemark("");
    } catch (e) {
      setError(`${e.message}：${e.detail || ""}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleAddAuditNote = async () => {
    if (!auditNote.trim()) return;
    try {
      await api.addAuditNote(id, auditStatusLabel, auditNote);
      setAuditNote("");
      setShowAuditForm(false);
      await loadDetail();
    } catch (e) {
      setError(e.message);
    }
  };

  const nodes = [
    { id: "docs", name: "入职资料" },
    { id: "contract", name: "合同签署" },
    { id: "account", name: "账号开通" },
  ];

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

  const actionLabels = {
    submit: "提交",
    claim: "认领",
    approve: "通过",
    return: "退回",
    close: "关闭",
  };

  const getAvailableActions = () => {
    if (!user || !order) return [];
    if (order.current_role !== user.role) return [];
    if (order.status === "completed" || order.status === "closed") return [];

    const actions = [];
    if (user.role === "registrar") {
      if (order.status === "returned" || order.status === "pending") {
        actions.push({ id: "submit", name: "提交" });
      }
    }
    if (user.role === "auditor" || user.role === "reviewer") {
      if (!order.handler_id) {
        actions.push({ id: "claim", name: "认领" });
      } else if (order.handler_id === user.id) {
        actions.push({ id: "approve", name: "通过" });
        actions.push({ id: "return", name: "退回" });
        if (user.role === "reviewer") {
          actions.push({ id: "close", name: "关闭" });
        }
      }
    }
    return actions;
  };

  const getNodeAttachments = (nodeId) => {
    return attachments.filter((a) => a.node === nodeId);
  };

  const isNodeCompleted = (nodeId) => {
    if (!order) return false;
    const nodeOrder = ["docs", "contract", "account"];
    const currentIdx = nodeOrder.indexOf(order.current_node);
    const nodeIdx = nodeOrder.indexOf(nodeId);
    if (order.status === "completed") return true;
    return nodeIdx < currentIdx;
  };

  const isNodeCurrent = (nodeId) => {
    return order?.current_node === nodeId;
  };

  const getRequiredAttachments = (nodeId) => {
    const req = {
      docs: ["id_card", "diploma", "resignation_cert"],
      contract: ["offer", "contract"],
      account: ["system_access", "email_account"],
    };
    const names = {
      id_card: "身份证",
      diploma: "学历证书",
      resignation_cert: "离职证明",
      offer: "Offer Letter",
      contract: "劳动合同",
      system_access: "系统权限开通单",
      email_account: "邮箱账号开通单",
    };
    return req[nodeId]?.map((t) => ({ type: t, name: names[t] })) || [];
  };

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "单据不存在"}</p>
          <button
            onClick={() => navigate({ to: "/orders" })}
            className="text-blue-600 hover:underline"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex justify-between items-start">
            <div>
              <button
                onClick={() => navigate({ to: "/orders" })}
                className="text-sm text-gray-500 hover:text-gray-700 mb-2"
              >
                ← 返回列表
              </button>
              <h1 className="text-xl font-bold text-gray-800">{order.title}</h1>
              <div className="flex gap-3 mt-2 items-center">
                <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${statusColors[order.status]}`}>
                  {statusNames[order.status]}
                </span>
                <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${warningColors[order.warning_level]}`}>
                  {warningNames[order.warning_level]}
                </span>
                {order.is_exception && (
                  <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                    异常
                  </span>
                )}
              </div>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>版本：v{order.version}</p>
              <p>截止：{new Date(order.due_date).toLocaleDateString("zh-CN")}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h2 className="font-medium text-gray-800 mb-3">基本信息</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">候选人：</span>
              <span className="text-gray-800">{order.candidate_name}</span>
            </div>
            <div>
              <span className="text-gray-500">岗位：</span>
              <span className="text-gray-800">{order.position}</span>
            </div>
            <div>
              <span className="text-gray-500">部门：</span>
              <span className="text-gray-800">{order.department}</span>
            </div>
            <div>
              <span className="text-gray-500">登记人：</span>
              <span className="text-gray-800">{order.registrar_name}</span>
            </div>
            <div>
              <span className="text-gray-500">当前处理角色：</span>
              <span className="text-gray-800">{roleNames[order.current_role]}</span>
            </div>
            <div>
              <span className="text-gray-500">当前处理人：</span>
              <span className="text-gray-800">{order.handler_name || "待认领"}</span>
            </div>
          </div>
          {order.exception_reason && (
            <div className="mt-3 p-3 bg-red-50 rounded border border-red-100 text-sm text-red-700">
              <span className="font-medium">异常原因：</span>{order.exception_reason}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h2 className="font-medium text-gray-800 mb-4">办理流程</h2>
          <div className="flex items-start">
            {nodes.map((node, idx) => (
              <div key={node.id} className="flex-1 relative">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium z-10 ${
                      isNodeCompleted(node.id)
                        ? "bg-green-500 text-white"
                        : isNodeCurrent(node.id)
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="mt-2 text-sm font-medium text-gray-800">{node.name}</div>
                  {isNodeCurrent(node.id) && (
                    <div className="text-xs text-blue-600 mt-1">当前节点</div>
                  )}
                </div>
                {idx < nodes.length - 1 && (
                  <div
                    className={`absolute top-5 left-1/2 w-full h-0.5 ${
                      isNodeCompleted(nodes[idx + 1]?.id) || isNodeCompleted(node.id) && idx < nodes.length - 2
                        ? "bg-green-300"
                        : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {nodes.map((node) => (
            <div
              key={node.id}
              className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${
                isNodeCurrent(node.id) ? "ring-2 ring-blue-500" : ""
              }`}
            >
              <div className={`px-5 py-3 border-b border-gray-100 flex justify-between items-center ${
                isNodeCompleted(node.id)
                  ? "bg-green-50"
                  : isNodeCurrent(node.id)
                  ? "bg-blue-50"
                  : "bg-gray-50"
              }`}>
                <h3 className="font-medium text-gray-800">{node.name}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    isNodeCompleted(node.id)
                      ? "bg-green-100 text-green-700"
                      : isNodeCurrent(node.id)
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {isNodeCompleted(node.id) ? "已完成" : isNodeCurrent(node.id) ? "进行中" : "待处理"}
                </span>
              </div>
              <div className="p-5">
                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-2">必填附件：</p>
                  <div className="flex flex-wrap gap-2">
                    {getRequiredAttachments(node.id).map((req) => {
                      const has = getNodeAttachments(node.id).some((a) => a.type === req.type);
                      return (
                        <span
                          key={req.type}
                          className={`text-xs px-2 py-1 rounded ${
                            has
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {has ? "✓ " : "✗ "}
                          {req.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
                {getNodeAttachments(node.id).length > 0 ? (
                  <div className="space-y-1">
                    {getNodeAttachments(node.id).map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 text-sm text-gray-700 p-2 bg-gray-50 rounded"
                      >
                        <span className="text-blue-500">📄</span>
                        <span>{att.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">暂无附件</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {getAvailableActions().length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-5">
            <h3 className="font-medium text-gray-800 mb-3">办理操作</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">操作类型</label>
                <div className="flex gap-2">
                  {getAvailableActions().map((act) => (
                    <button
                      key={act.id}
                      onClick={() => setAction(act.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        action === act.id
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {act.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">备注</label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={3}
                  placeholder="请输入办理备注..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAction}
                  disabled={!action || processing}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {processing ? "处理中..." : "提交处理"}
                </button>
              </div>
            </div>
          </div>
        )}

        {order.current_role !== user?.role && order.status !== "completed" && order.status !== "closed" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            <span className="font-medium">提示：</span>
            当前节点应由 {roleNames[order.current_role]} 处理，您的角色是 {roleNames[user?.role]}，仅可查看。
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-800">审计备注</h3>
            <button
              onClick={() => setShowAuditForm(!showAuditForm)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {showAuditForm ? "取消" : "+ 添加备注"}
            </button>
          </div>

          {showAuditForm && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">状态标签</label>
                <select
                  value={auditStatusLabel}
                  onChange={(e) => setAuditStatusLabel(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  <option value="待派发">待派发</option>
                  <option value="处理中">处理中</option>
                  <option value="已关闭">已关闭</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">备注内容</label>
                <textarea
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                  rows={3}
                  placeholder="输入审计备注内容..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAddAuditNote}
                  disabled={!auditNote.trim()}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                >
                  提交
                </button>
              </div>
            </div>
          )}

          {auditNotes.length > 0 ? (
            <div className="space-y-3">
              {auditNotes.map((note) => (
                <div key={note.id} className="border-l-4 border-blue-400 pl-3 py-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-700">{note.created_by_name}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                      {note.status_label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(note.created_at).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{note.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">暂无审计备注</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h3 className="font-medium text-gray-800 mb-4">处理记录</h3>
          {records.length > 0 ? (
            <div className="space-y-4">
              {records.map((rec, idx) => (
                <div key={rec.id} className="relative pl-6 pb-4">
                  {idx < records.length - 1 && (
                    <div className="absolute left-2 top-2 bottom-0 w-0.5 bg-gray-200" />
                  )}
                  <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-blue-500" />
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-700">{rec.operator_name}</span>
                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                      {roleNames[rec.operator_role]}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                      {actionLabels[rec.action] || rec.action}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(rec.created_at).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {rec.from_status && rec.to_status && (
                      <span className="text-gray-500">
                        状态：{statusNames[rec.from_status]} → {statusNames[rec.to_status]}
                      </span>
                    )}
                    {rec.from_node && rec.to_node && rec.from_node !== rec.to_node && (
                      <span className="text-gray-500 ml-3">
                        节点：{nodes.find(n => n.id === rec.from_node)?.name || rec.from_node} → {nodes.find(n => n.id === rec.to_node)?.name || rec.to_node}
                      </span>
                    )}
                  </div>
                  {rec.remark && (
                    <p className="text-sm text-gray-600 mt-1 bg-gray-50 p-2 rounded">
                      备注：{rec.remark}
                    </p>
                  )}
                  {rec.exception_type && (
                    <p className="text-sm text-red-600 mt-1">
                      异常类型：{rec.exception_type}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">暂无处理记录</p>
          )}
        </div>
      </main>
    </div>
  );
}
