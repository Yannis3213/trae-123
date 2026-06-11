'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, Play, Eye } from 'lucide-react';
import { useStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import WarningCard from '@/components/WarningCard';
import FilterBar from '@/components/FilterBar';
import DataTable from '@/components/DataTable';
import BatchResultModal from '@/components/BatchResultModal';
import type { RepairOrder, BatchResult } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const { currentUser, repairOrders, ordersTotal, warnings, loading, fetchOrders, fetchWarnings, batchAdvance, batchReturn } = useStore();

  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [deadlineGroup, setDeadlineGroup] = useState('');
  const [enterpriseName, setEnterpriseName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchResult, setBatchResult] = useState<BatchResult[] | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnOpinion, setReturnOpinion] = useState('');
  const pageSize = 10;

  const load = useCallback(() => {
    const params: Record<string, string> = { page: String(page), page_size: String(pageSize) };
    if (status) params.status = status;
    if (category) params.category = category;
    if (deadlineGroup) params.deadline_group = deadlineGroup;
    if (enterpriseName) params.enterprise_name = enterpriseName;
    if (keyword) params.keyword = keyword;
    fetchOrders(params);
  }, [status, category, deadlineGroup, enterpriseName, keyword, page, fetchOrders]);

  useEffect(() => { load(); fetchWarnings(); }, [load, fetchWarnings]);

  const getDeadlineColor = (deadline: string) => {
    const diff = (new Date(deadline).getTime() - Date.now()) / 86400000;
    if (diff < 0) return 'text-red-600 font-semibold animate-blink';
    if (diff <= 3) return 'text-yellow-600 font-semibold';
    return 'text-green-600';
  };

  const canAdvance = (order: RepairOrder) => {
    if (!currentUser) return false;
    const { role } = currentUser;
    const s = order.status;
    if (role === 'engineering_supervisor' && (s === 'pending_process' || s === 'processing')) return true;
    if (role === 'park_manager' && (s === 'pending_review' || s === 'pending_archive')) return true;
    return false;
  };

  const canReturn = (order: RepairOrder) => {
    if (!currentUser) return false;
    const s = order.status;
    return !['archived', 'pending_submit'].includes(s);
  };

  const handleBatchAdvance = async () => {
    if (!currentUser || selectedIds.length === 0) return;
    const items = selectedIds.map(id => { const order = repairOrders.find(o => o.id === id); return { id, version: order?.version ?? 1 }; });
    const result = await batchAdvance(items);
    if (result) { setBatchResult(result); setSelectedIds([]); load(); }
  };

  const handleBatchReturn = async () => {
    if (!currentUser || selectedIds.length === 0 || !returnReason || !returnOpinion) return;
    const items = selectedIds.map(id => { const order = repairOrders.find(o => o.id === id); return { id, version: order?.version ?? 1 }; });
    const result = await batchReturn(items, returnReason, returnOpinion);
    if (result) { setBatchResult(result); setSelectedIds([]); setShowReturnModal(false); setReturnReason(''); setReturnOpinion(''); load(); }
  };

  const columns = [
    { key: 'order_no', title: '工单号', width: '140px' },
    { key: 'title', title: '标题', render: (row: RepairOrder) => <span className="truncate max-w-[200px] block">{row.title}</span> },
    { key: 'enterprise_name', title: '企业名称', width: '140px' },
    { key: 'status', title: '状态', width: '110px', render: (row: RepairOrder) => <StatusBadge status={row.status} /> },
    { key: 'current_handler_name', title: '当前处理人', width: '120px' },
    { key: 'attachment_count', title: '附件', width: '70px', render: (row: RepairOrder) => {
      const count = row.attachment_count ?? row.attachments?.length ?? 0;
      return count > 0 ? <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{count}</span> : <span className="text-gray-400 text-sm">0</span>;
    }},
    { key: 'processing_record_count', title: '记录', width: '70px', render: (row: RepairOrder) => {
      const count = row.processing_record_count ?? row.processing_records?.length ?? 0;
      return count > 0 ? <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{count}</span> : <span className="text-gray-400 text-sm">0</span>;
    }},
    { key: 'deadline', title: '截止日期', width: '120px', render: (row: RepairOrder) => (
      <span className={`text-sm ${getDeadlineColor(row.deadline)}`}>{row.deadline?.slice(0, 10)}</span>
    )},
    { key: 'actions', title: '操作', width: '140px', render: (row: RepairOrder) => (
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); router.push(`/repair/${row.id}`); }} className="p-1 text-gray-400 hover:text-primary" title="查看"><Eye className="w-4 h-4" /></button>
        {canAdvance(row) && <button onClick={(e) => { e.stopPropagation(); }} className="p-1 text-gray-400 hover:text-blue-500" title="推进"><Play className="w-4 h-4" /></button>}
        {canReturn(row) && <button onClick={(e) => { e.stopPropagation(); }} className="p-1 text-gray-400 hover:text-red-500" title="退回"><RotateCcw className="w-4 h-4" /></button>}
      </div>
    )},
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <WarningCard type="normal" count={warnings.normal.length} orders={warnings.normal} onClick={() => setDeadlineGroup('normal')} active={deadlineGroup === 'normal'} />
        <WarningCard type="approaching" count={warnings.approaching.length} orders={warnings.approaching} onClick={() => setDeadlineGroup('approaching')} active={deadlineGroup === 'approaching'} />
        <WarningCard type="overdue" count={warnings.overdue.length} orders={warnings.overdue} onClick={() => setDeadlineGroup('overdue')} active={deadlineGroup === 'overdue'} />
      </div>

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

      {selectedIds.length > 0 && (
        <div className="card p-3 flex items-center gap-4">
          <span className="text-sm text-gray-600">已选择 <strong>{selectedIds.length}</strong> 项</span>
          <button onClick={handleBatchAdvance} disabled={loading} className="btn-primary flex items-center gap-1">
            <Play className="w-4 h-4" /> 批量推进
          </button>
          <button onClick={() => setShowReturnModal(true)} disabled={loading} className="btn-danger flex items-center gap-1">
            <RotateCcw className="w-4 h-4" /> 批量退回
          </button>
          <button onClick={() => setSelectedIds([])} className="btn-outline">取消选择</button>
        </div>
      )}

      <div className="card">
        <DataTable<RepairOrder>
          columns={columns}
          data={repairOrders}
          rowKey="id"
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onRowClick={(row) => router.push(`/repair/${row.id}`)}
          page={page}
          pageSize={pageSize}
          total={ordersTotal}
          onPageChange={setPage}
        />
      </div>

      {batchResult && <BatchResultModal result={batchResult} onClose={() => setBatchResult(null)} />}

      {showReturnModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold">批量退回</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">退回原因 <span className="text-red-500">*</span></label>
              <input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">退回意见 <span className="text-red-500">*</span></label>
              <textarea value={returnOpinion} onChange={(e) => setReturnOpinion(e.target.value)} rows={3} className="input-field" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReturnModal(false)} className="btn-outline">取消</button>
              <button onClick={handleBatchReturn} disabled={loading || !returnReason || !returnOpinion} className="btn-danger">确认退回</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
