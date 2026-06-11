'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter } from 'lucide-react';
import { useStore } from '@/store';
import { CATEGORIES, STATUS_LABELS } from '@/types';
import type { LedgerItem, Status } from '@/types';
import StatusBadge from '@/components/StatusBadge';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部状态' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

export default function LedgerPage() {
  const router = useRouter();
  const { ledgerItems, ledgerTotal, loading, fetchLedger } = useStore();
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [enterpriseName, setEnterpriseName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const load = useCallback(() => {
    const params: Record<string, string> = { page: String(page), page_size: String(pageSize) };
    if (category) params.category = category;
    if (status) params.status = status;
    if (enterpriseName) params.enterprise_name = enterpriseName;
    if (keyword) params.keyword = keyword;
    fetchLedger(params);
  }, [category, status, enterpriseName, keyword, page, fetchLedger]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(ledgerTotal / pageSize);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">报修单台账</h2>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary">
            <option value="">全部分类</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            value={enterpriseName}
            onChange={(e) => setEnterpriseName(e.target.value)}
            placeholder="企业名称"
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary w-40"
          />
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
              placeholder="搜索工单号/标题"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary"
            />
            <button onClick={() => { setPage(1); load(); }} className="px-3 py-2 bg-primary text-white rounded-md text-sm hover:opacity-90"><Search className="w-4 h-4" /></button>
          </div>
        </div>
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
                <td className="px-3 py-3 text-gray-700">{item.category}</td>
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
