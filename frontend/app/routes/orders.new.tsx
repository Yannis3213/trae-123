import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

export const Route = createFileRoute("/orders/new")({
  component: NewOrderPage,
});

function NewOrderPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [candidateName, setCandidateName] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
    if (!authLoading && user && user.role !== "registrar") {
      alert("只有入职办理登记员可以发起入职办理单");
      navigate({ to: "/orders" });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!candidateName || !position || !department) {
      setError("候选人姓名、岗位、部门不能为空");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = { candidate_name: candidateName, position, department };
      if (dueDate) data.due_date = dueDate;
      const result = await api.createOrder(data);
      navigate({ to: "/orders/$id", params: { id: result.order_id } });
    } catch (e) {
      setError(`${e.message}${e.detail ? "：" + e.detail : ""}`);
    } finally {
      setLoading(false);
    }
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
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate({ to: "/orders" })}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            ← 返回列表
          </button>
          <h1 className="text-xl font-bold text-gray-800">发起入职办理单</h1>
          <p className="text-sm text-gray-500 mt-1">入职办理登记员：{user.name}</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              候选人姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="请输入候选人姓名"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              岗位 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="如：高级工程师"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              部门 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="如：研发部"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              截止日期（留空默认为 15 天后）
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate({ to: "/orders" })}
              className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? "创建中..." : "创建入职单"}
            </button>
          </div>
        </form>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
          <p className="font-medium mb-1">提示</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>创建后进入「待派发」状态，可在详情页上传入职资料附件</li>
            <li>资料齐全后可点击「提交」进入合同签署节点</li>
            <li>全部流程：入职资料 → 合同签署 → 账号开通</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
