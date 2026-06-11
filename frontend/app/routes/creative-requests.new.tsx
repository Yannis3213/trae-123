import { useState } from "react";
import { useNavigate, useOutletContext } from "@remix-run/react";
import { createRequest, submitRequest } from "~/utils/api";
import type { UserRole } from "~/utils/status";

interface OutletContext {
  userId: string;
  role: UserRole;
}

export default function NewCreativeRequest() {
  const { role } = useOutletContext<OutletContext>();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [brand, setBrand] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [briefStatus, setBriefStatus] = useState("pending");
  const [scheduleStatus, setScheduleStatus] = useState("pending");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (role !== "creative_registrar") {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
        <svg className="w-12 h-12 text-yellow-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="text-yellow-700 font-medium">只有创意需求登记员可以创建需求单</p>
        <button
          onClick={() => navigate("/creative-requests")}
          className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          返回列表
        </button>
      </div>
    );
  }

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      setError("请填写标题");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createRequest({
        title,
        client_name: clientName,
        brand,
        campaign_name: campaignName,
        description,
        deadline: deadline || null,
        brief_status: briefStatus,
        schedule_status: scheduleStatus,
      });
      navigate("/creative-requests");
    } catch (err) {
      setError("保存失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("请填写标题");
      return;
    }
    if (!clientName.trim()) {
      setError("请填写客户名称");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const req = await createRequest({
        title,
        client_name: clientName,
        brand,
        campaign_name: campaignName,
        description,
        deadline: deadline || null,
        brief_status: briefStatus,
        schedule_status: scheduleStatus,
      });
      await submitRequest(req.id, { version: req.version });
      navigate("/creative-requests");
    } catch (err) {
      setError("提交失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/creative-requests")}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">新建创意需求单</h1>
          <p className="mt-1 text-sm text-gray-500">填写需求信息后可保存草稿或直接提交</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">基本信息</h2>
        </div>
        <div className="px-6 py-6 space-y-5">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="请输入需求单标题"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-1">
                客户名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="请输入客户名称"
              />
            </div>
            <div>
              <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">品牌</label>
              <input
                type="text"
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="请输入品牌"
              />
            </div>
          </div>

          <div>
            <label htmlFor="campaignName" className="block text-sm font-medium text-gray-700 mb-1">活动名称</label>
            <input
              type="text"
              id="campaignName"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="请输入活动名称"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">需求描述</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="请输入需求描述"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1">截止日期</label>
              <input
                type="date"
                id="deadline"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="briefStatus" className="block text-sm font-medium text-gray-700 mb-1">Brief状态</label>
              <select
                id="briefStatus"
                value={briefStatus}
                onChange={(e) => setBriefStatus(e.target.value)}
                className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="pending">待处理</option>
                <option value="received">已接收</option>
                <option value="missing">缺失</option>
              </select>
            </div>
            <div>
              <label htmlFor="scheduleStatus" className="block text-sm font-medium text-gray-700 mb-1">排期状态</label>
              <select
                id="scheduleStatus"
                value={scheduleStatus}
                onChange={(e) => setScheduleStatus(e.target.value)}
                className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="pending">待处理</option>
                <option value="scheduled">已排期</option>
                <option value="missing">缺失</option>
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3 rounded-b-lg">
          <button
            type="button"
            onClick={() => navigate("/creative-requests")}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={submitting}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {submitting ? "保存中..." : "保存草稿"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {submitting ? "提交中..." : "提交"}
          </button>
        </div>
      </div>
    </div>
  );
}
