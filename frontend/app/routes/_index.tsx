import { useState, useEffect } from "react";
import { getStatistics, type DashboardStats } from "~/utils/api";
import { STATUS_LABELS, STATUS_COLORS } from "~/utils/status";
import type { RequestStatus } from "~/utils/status";

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStatistics()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600">加载统计数据失败: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-sm text-red-500 underline"
        >
          重试
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const statusEntries: { status: RequestStatus; count: number; label: string; color: string }[] = [
    { status: "draft", count: stats.draft, label: STATUS_LABELS.draft, color: STATUS_COLORS.draft },
    { status: "pending_submit", count: stats.pending_submit, label: STATUS_LABELS.pending_submit, color: STATUS_COLORS.pending_submit },
    { status: "submitted", count: stats.submitted, label: STATUS_LABELS.submitted, color: STATUS_COLORS.submitted },
    { status: "under_review", count: stats.under_review, label: STATUS_LABELS.under_review, color: STATUS_COLORS.under_review },
    { status: "returned", count: stats.returned, label: STATUS_LABELS.returned, color: STATUS_COLORS.returned },
    { status: "resubmitted", count: stats.resubmitted, label: STATUS_LABELS.resubmitted, color: STATUS_COLORS.resubmitted },
    { status: "reviewed", count: stats.reviewed, label: STATUS_LABELS.reviewed, color: STATUS_COLORS.reviewed },
    { status: "archived", count: stats.archived, label: STATUS_LABELS.archived, color: STATUS_COLORS.archived },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">统计概览</h1>
        <p className="mt-1 text-sm text-gray-500">创意需求单系统运行状况一览</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">需求单总数</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{stats.total}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">逾期</dt>
                  <dd className="text-3xl font-semibold text-red-600">{stats.overdue}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">临期</dt>
                  <dd className="text-3xl font-semibold text-yellow-600">{stats.approaching}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">已归档</dt>
                  <dd className="text-3xl font-semibold text-green-600">{stats.archived}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">状态分布</h2>
        <div className="space-y-3">
          {statusEntries.map(({ status, count, label, color }) => (
            <div key={status} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
                  {label}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-1 ml-4">
                <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all"
                    style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 w-8 text-right">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
