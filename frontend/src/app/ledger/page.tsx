'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store';
import type { LedgerItem, Status } from '@/types';
import { CATEGORIES } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import FilterBar from '@/components/FilterBar';

export default function LedgerPage() {
  const router = useRouter();
  const { ledgerItems, ledgerTotal, loading, fetchLedger } = useStore();
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [deadlineGroup, setDeadlineGroup] = useState('');
  const [enterpriseName, setEnterpriseName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const load = useCallback(() => {
    const params: Record<string, string> = { page: String(page), page_size: String(pageSize) };
    if (category) params.category = category;
    if (status) params.status = status;
    if (deadlineGroup) params.deadline_group = deadlineGroup;
    if (enterpriseName) params.enterprise_name = enterpriseName;
    if (keyword) params.keyword = keyword;
    fetchLedger(params);
  }, [category, status, deadlineGroup, enterpriseName, keyword, page, fetchLedger]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(ledgerTotal / pageSize);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">报修单台账</h2>

      <div className="card p-4">
        <FilterBar
          status={status} category={category} deadlineGroup={deadlineGroup} enterpriseName={enterpriseName} keyword={keyword}
          onStatusChange={(v) => { setStatus(v); setPage(1); }}
          onCategoryChange={(v) => { setCategory(v); setPage(1); }}
          onDeadlineGroupChange={(v) => { setDeadlineGroup(v); setPage(1); }}
          onEnterpriseNameChange={(v) => { setEnterpriseName(v); setPage(1); }}
          onKeywordChange={setKeyword}
          onSearch={() => { setPage(1); load(); }}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-3 py-3 text-left font-medium text-gray-600">工单号</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">标题</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">企业名称</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">分类</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">状态</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">紧急程度</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">截止日期</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">当前处理人</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">调度状态</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">确认状态</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">附件</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">记录</th>
            </tr>
          </thead>
          <tbody>
            {ledgerItems.length === 0 && (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-gray-400">暂无数据</td></tr>
            )}
            {ledgerItems.map((item) => (
              <tr
                key={item.id}
                onClick={() => router.push(`/repair/${item.id}`)}
                className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-3 py-3 text-gray-700">{item.order_no}</td>
                <td className="px-3 py-3 text-gray-700 max-w-[200px] truncate">{item.title}</td>
                <td className="px-3 py-3 text-gray-700">{item.enterprise_name}</td>
                <td className="px-3 py-3 text-gray-700">{item.category_label || CATEGORIES[item.category] || item.category}</td>
                <td className="px-3 py-3"><StatusBadge status={item.status as Status} /></td>
                <td className="px-3 py-3 text-gray-700">{item.urgency === 'urgent' ? '紧急' : '普通'}</td>
                <td className="px-3 py-3 text-gray-700">{item.deadline?.slice(0, 10)}</td>
                <td className="px-3 py-3 text-gray-700">{item.current_handler_name}</td>
                <td className="px-3 py-3 text-gray-700">{item.dispatch_status || '-'}</td>
                <td className="px-3 py-3 text-gray-700">{item.confirmation_status || '-'}</td>
                <td className="px-3 py-3 text-gray-700">{item.attachment_count ?? item.attachments?.length ?? 0}</td>
                <td className="px-3 py-3 text-gray-700">{item.processing_record_count ?? item.processing_records?.length ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-3 border-t">
            <span className="text-sm text-gray-500">共 {ledgerTotal} 条</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-30">上一页</button>
              <span className="text-sm text-gray-600">{page} / {totalPages}</span>
              <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-30">下一页</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
