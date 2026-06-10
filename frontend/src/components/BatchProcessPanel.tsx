'use client';

import { useState } from 'react';
import { BorrowRecord, BorrowStatus, STATUS_DISPLAY, BatchProcessResponse, Role, ROLE_DISPLAY, NEXT_HANDLER_BY_STATUS, ROLE_OPERATORS } from '@/types';
import { api } from '@/lib/api';
import { useRole } from '@/context/RoleContext';

interface Props {
  records: BorrowRecord[];
  selectedIds: Set<string>;
  onClear: () => void;
  onDone: () => void;
}

const STATUS_TRANSITIONS: Record<Role, { from: BorrowStatus; to: BorrowStatus; label: string }[]> = {
  registration_clerk: [{ from: 'returned_for_correction', to: 'pending_assignment', label: '补正后重分派' }],
  circulation_librarian: [
    { from: 'pending_assignment', to: 'transferred', label: '分派给采编馆员' },
    { from: 'pending_assignment', to: 'returned_for_correction', label: '退回补正' },
    { from: 'pending_assignment', to: 'overdue', label: '标记逾期' },
  ],
  cataloging_librarian: [
    { from: 'transferred', to: 'revisited', label: '推进到已回访' },
    { from: 'transferred', to: 'returned_for_correction', label: '退回补正' },
  ],
  audit_supervisor: [
    { from: 'revisited', to: 'reviewed_archived', label: '审核通过归档' },
    { from: 'revisited', to: 'returned_for_correction', label: '退回补正' },
  ],
  library_director: [
    { from: 'pending_assignment', to: 'transferred', label: '分派' },
    { from: 'transferred', to: 'revisited', label: '回访' },
    { from: 'revisited', to: 'reviewed_archived', label: '归档' },
    { from: 'pending_assignment', to: 'overdue', label: '标记逾期' },
  ],
};

const ALL_EVIDENCE = ['借阅凭证', '身份证明', '催还记录', '回访记录', '处理结果确认', '补正材料清单', '补正确认'];

export default function BatchProcessPanel({ records, selectedIds, onClear, onDone }: Props) {
  const { currentRole, currentOperator } = useRole();
  const [open, setOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<BorrowStatus | ''>('');
  const [action, setAction] = useState('批量处理');
  const [remark, setRemark] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchProcessResponse | null>(null);
  const [error, setError] = useState('');

  const availableTransitions = STATUS_TRANSITIONS[currentRole] || [];

  const selectedRecords = records.filter((r) => selectedIds.has(r.id));
  const applicableTargets = availableTransitions
    .filter((t: { from: BorrowStatus; to: BorrowStatus; label: string }) => selectedRecords.some((r) => r.status === t.from))
    .map((t) => t.to);
  const uniqueTargets = [...new Set(applicableTargets)];

  const handleSubmit = async () => {
    if (!targetStatus) return setError('请选择目标状态');
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const versions: Record<string, number> = {};
      selectedRecords.forEach((r) => {
        versions[r.id] = r.version;
      });

      const data = await api.batchProcess({
        record_ids: [...selectedIds],
        action,
        target_status: targetStatus,
        operator: currentOperator,
        operator_role: currentRole,
        remark: remark || undefined,
        evidence,
        versions,
      }) as BatchProcessResponse;

      setResult(data);
      if (data.success_count > 0) {
        setTimeout(onDone, 300);
      }
    } catch (e: any) {
      setError(e.message || '批量处理失败');
    } finally {
      setLoading(false);
    }
  };

  if (selectedIds.size === 0) return null;

  return (
    <div className="card p-3 mb-4 flex items-center justify-between">
      <div className="text-sm">
        已选 <span className="font-bold text-library-800">{selectedIds.size}</span> 条记录
        {' '}可批量操作：
        {uniqueTargets.map((t) => (
          <span key={t} className="ml-2 badge bg-library-100 text-library-700 border-library-200">
            → {STATUS_DISPLAY[t]}
          </span>
        ))}
        {uniqueTargets.length === 0 && (
          <span className="ml-2 text-orange-600 text-xs">当前选择中无可批量推进的记录</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-secondary" onClick={onClear}>取消选择</button>
        <button
          className="btn-primary"
          onClick={() => {
            if (uniqueTargets.length > 0) setTargetStatus(uniqueTargets[0]);
            setOpen(true);
          }}
          disabled={uniqueTargets.length === 0}
        >
          批量办理
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-lg shadow-xl">
            <div className="px-4 py-3 border-b border-library-200 flex justify-between items-center">
              <h3 className="font-semibold">批量办理（{selectedIds.size} 条）</h3>
              <button onClick={() => setOpen(false)} className="text-library-500 hover:text-library-800">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label">操作说明</label>
                <input className="input" value={action} onChange={(e) => setAction(e.target.value)} />
              </div>
              <div>
                <label className="label">目标状态</label>
                <select
                  className="select"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as BorrowStatus)}
                >
                  <option value="">请选择</option>
                  {uniqueTargets.map((t) => (
                    <option key={t} value={t}>{STATUS_DISPLAY[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">备注</label>
                <textarea
                  className="input"
                  rows={2}
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="可选"
                />
              </div>
              {targetStatus && NEXT_HANDLER_BY_STATUS[targetStatus as BorrowStatus] && (
                <div className="text-xs bg-library-50 p-3 rounded border border-library-200">
                  <span className="text-library-600">下一处理人：</span>
                  <span className="font-medium text-library-800 ml-1">
                    {NEXT_HANDLER_BY_STATUS[targetStatus as BorrowStatus]!.name}
                  </span>
                  <span className="text-library-500 ml-1">
                    （{ROLE_DISPLAY[NEXT_HANDLER_BY_STATUS[targetStatus as BorrowStatus]!.role]}）
                  </span>
                  {targetStatus === 'pending_assignment' && (
                    <span className="block text-library-500 mt-1">
                      补正材料齐全后，所有选中记录将交回流通馆员重新分派
                    </span>
                  )}
                </div>
              )}
              <div>
                <label className="label">证据材料（多选）</label>
                <div className="grid grid-cols-3 gap-2">
                  {ALL_EVIDENCE.map((e) => (
                    <label key={e} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={evidence.includes(e)}
                        onChange={(ev) => {
                          setEvidence(
                            ev.target.checked ? [...evidence, e] : evidence.filter((x) => x !== e)
                          );
                        }}
                        className="rounded"
                      />
                      {e}
                    </label>
                  ))}
                </div>
              </div>
              {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
              {result && (
                <div className="space-y-2">
                  <div className="text-sm p-2 rounded bg-library-50">
                    <span className="font-medium">成功</span> {result.success_count} / {result.total}，
                    <span className="text-red-600 ml-2">失败 {result.failure_count}</span>
                  </div>
                  <div className="scroll-area max-h-48 border border-library-200 rounded">
                    {result.results.map((r) => (
                      <div
                        key={r.record_id}
                        className={`px-3 py-2 text-xs border-b border-library-100 ${
                          r.success ? 'bg-green-50' : 'bg-red-50'
                        }`}
                      >
                        <div className="flex justify-between">
                          <span className="font-mono truncate">{r.record_id.slice(0, 8)}...</span>
                          <span className={r.success ? 'text-green-700' : 'text-red-700'}>
                            {r.success ? '成功' : '失败'}
                          </span>
                        </div>
                        <div className="text-library-600">{r.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-library-200 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setOpen(false)}>
                {result ? '关闭' : '取消'}
              </button>
              {!result && (
                <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
                  {loading ? '处理中...' : '确认批量办理'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
