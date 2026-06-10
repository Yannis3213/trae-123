'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BorrowRecord, ProcessRecord, AuditNote, BorrowStatus, Role,
  STATUS_DISPLAY, STATUS_COLOR, OVERDUE_COLOR, OVERDUE_DISPLAY, ROLE_DISPLAY,
  NEXT_HANDLER_BY_STATUS, ROLE_OPERATORS,
} from '@/types';
import { api } from '@/lib/api';
import { useRole } from '@/context/RoleContext';

const ALLOWED_TRANSITIONS: Record<Role, { from: BorrowStatus; to: BorrowStatus; label: string }[]> = {
  registration_clerk: [{ from: 'returned_for_correction', to: 'pending_assignment', label: '补正后重分派' }],
  circulation_librarian: [
    { from: 'pending_assignment', to: 'transferred', label: '分派给采编馆员' },
    { from: 'pending_assignment', to: 'returned_for_correction', label: '退回借阅登记员补正' },
    { from: 'pending_assignment', to: 'overdue', label: '标记逾期' },
  ],
  cataloging_librarian: [
    { from: 'transferred', to: 'revisited', label: '推进到已回访（催还/确认）' },
    { from: 'transferred', to: 'returned_for_correction', label: '退回补正' },
  ],
  audit_supervisor: [
    { from: 'revisited', to: 'reviewed_archived', label: '审核通过，复核归档' },
    { from: 'revisited', to: 'returned_for_correction', label: '退回补正' },
  ],
  library_director: [
    { from: 'pending_assignment', to: 'transferred', label: '分派' },
    { from: 'transferred', to: 'revisited', label: '回访' },
    { from: 'revisited', to: 'reviewed_archived', label: '归档' },
    { from: 'returned_for_correction', to: 'pending_assignment', label: '补正重分派' },
    { from: 'pending_assignment', to: 'overdue', label: '标记逾期' },
    { from: 'overdue', to: 'transferred', label: '逾期后转办' },
  ],
};

const EVIDENCE_BY_TRANSITION: Partial<Record<string, string[]>> = {
  'pending_assignment|transferred': ['借阅凭证', '身份证明'],
  'transferred|revisited': ['借阅凭证', '身份证明', '催还记录'],
  'revisited|reviewed_archived': ['借阅凭证', '身份证明', '回访记录', '处理结果确认'],
  'returned_for_correction|pending_assignment': ['补正材料清单', '补正确认'],
};

export default function RecordDetailClient() {
  const params = useParams();
  const router = useRouter();
  const { currentRole, currentOperator } = useRole();
  const [record, setRecord] = useState<BorrowRecord | null>(null);
  const [history, setHistory] = useState<ProcessRecord[]>([]);
  const [notes, setNotes] = useState<AuditNote[]>([]);
  const [tab, setTab] = useState<'process' | 'audit'>('process');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [targetStatus, setTargetStatus] = useState<BorrowStatus | ''>('');
  const [action, setAction] = useState('');
  const [remark, setRemark] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [correctionItems, setCorrectionItems] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState('');

  const id = typeof params?.id === 'string' ? params.id : '';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [r, h, n] = await Promise.all([
        api.getBorrowRecord(id) as Promise<BorrowRecord>,
        api.getProcessHistory(id) as Promise<ProcessRecord[]>,
        api.getAuditNotes(id) as Promise<AuditNote[]>,
      ]);
      setRecord(r);
      setHistory(h);
      setNotes(n);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const allowed = (ALLOWED_TRANSITIONS[currentRole] || []).filter(
    (t: { from: BorrowStatus; to: BorrowStatus; label: string }) => record && t.from === record.status
  );

  const requiredEvidence = targetStatus && record
    ? EVIDENCE_BY_TRANSITION[`${record.status}|${targetStatus}`] || ['借阅凭证']
    : [];

  const handleProcess = async () => {
    if (!record || !targetStatus) return;
    setProcessing(true);
    setProcessError('');
    try {
      const payload: any = {
        action: action || `${STATUS_DISPLAY[record.status]}→${STATUS_DISPLAY[targetStatus]}`,
        target_status: targetStatus,
        operator: currentOperator,
        operator_role: currentRole,
        remark: remark || undefined,
        evidence,
        version: record.version,
      };
      if (targetStatus === 'returned_for_correction' && correctionItems.trim()) {
        payload.correction_items = correctionItems.split(/[,，、\n]+/).map((s: string) => s.trim()).filter(Boolean);
      }
      await api.processBorrowRecord(id, payload);
      setTargetStatus('');
      setAction('');
      setRemark('');
      setEvidence([]);
      setCorrectionItems('');
      await load();
    } catch (e: any) {
      setProcessError(e.message || '办理失败');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="card p-8 text-center text-library-500">加载中...</div>;
  }
  if (error || !record) {
    return (
      <div className="card p-8 text-center">
        <div className="text-red-600 mb-4">{error || '记录不存在'}</div>
        <Link href="/" className="btn-secondary">返回列表</Link>
      </div>
    );
  }

  const allEvidenceOptions = Array.from(new Set([...requiredEvidence, ...evidence, '借阅凭证', '身份证明', '催还记录', '回访记录', '处理结果确认', '补正材料清单', '补正确认']));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-library-500 hover:text-library-800">← 返回列表</Link>
          <h1 className="text-xl font-bold">借阅记录详情</h1>
          <span className={`badge ${STATUS_COLOR[record.status]}`}>{STATUS_DISPLAY[record.status]}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/readers`} className="btn-secondary">查看读者档案 →</Link>
          <Link href="/overdue" className="btn-secondary">逾期处理 →</Link>
          <Link href="/create" className="btn-secondary">新建借阅登记 →</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4">
            <div className="text-sm font-medium text-library-600 mb-3">基础信息</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <div>
                <div className="text-library-500 text-xs">读者姓名</div>
                <div className="font-medium">{record.reader_name}</div>
              </div>
              <div>
                <div className="text-library-500 text-xs">读者证号</div>
                <div className="font-medium">{record.reader_card_number}</div>
              </div>
              <div>
                <div className="text-library-500 text-xs">图书名称</div>
                <div className="font-medium">{record.book_title}</div>
              </div>
              <div>
                <div className="text-library-500 text-xs">ISBN</div>
                <div className="font-medium">{record.book_isbn}</div>
              </div>
              <div>
                <div className="text-library-500 text-xs">借阅日期</div>
                <div>{record.borrow_date}</div>
              </div>
              <div>
                <div className="text-library-500 text-xs">到期日期</div>
                <div className="flex items-center gap-2">
                  {record.due_date}
                  <span className={`badge ${OVERDUE_COLOR[record.overdue_level]}`}>
                    {OVERDUE_DISPLAY[record.overdue_level]}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-library-500 text-xs">当前处理人</div>
                <div>
                  {record.current_handler || '-'}
                  {record.current_handler_role && (
                    <span className="text-xs text-library-500 ml-1">({ROLE_DISPLAY[record.current_handler_role]})</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-library-500 text-xs">创建人</div>
                <div>{record.created_by} <span className="text-xs text-library-500">({ROLE_DISPLAY[record.created_by_role]})</span></div>
              </div>
              <div>
                <div className="text-library-500 text-xs">版本号</div>
                <div className="font-mono">v{record.version}</div>
              </div>
            </div>
            <div className="divider" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-library-500 text-xs mb-1">节点超时</div>
                {record.node_timeout ? (
                  <div className="text-red-600 font-medium">
                    ⚠ 已超时，责任人：{record.timeout_responsible || '-'}
                  </div>
                ) : (
                  <div className="text-green-600">正常</div>
                )}
              </div>
              <div>
                <div className="text-library-500 text-xs mb-1">缺失材料</div>
                {record.missing_materials.length > 0 ? (
                  <div className="text-orange-600">
                    {record.missing_materials.join('、')}
                  </div>
                ) : (
                  <div className="text-green-600">齐全</div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="px-4 border-b border-library-200 flex">
              <div className={tab === 'process' ? 'tab-active' : 'tab'} onClick={() => setTab('process')}>
                办理历史 ({history.length})
              </div>
              <div className={tab === 'audit' ? 'tab-active' : 'tab'} onClick={() => setTab('audit')}>
                审计备注/异常追溯 ({notes.length})
              </div>
            </div>
            <div className="p-4 scroll-area" style={{ maxHeight: 360 }}>
              {tab === 'process' && (
                <div className="space-y-3">
                  {history.length === 0 && <div className="text-library-500 text-sm">暂无办理记录</div>}
                  {history.map((h: ProcessRecord) => (
                    <div key={h.id} className="border-l-2 border-library-200 pl-3 py-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`badge ${STATUS_COLOR[h.from_status]} text-[10px]`}>{STATUS_DISPLAY[h.from_status]}</span>
                        <span className="text-library-400">→</span>
                        <span className={`badge ${STATUS_COLOR[h.to_status]} text-[10px]`}>{STATUS_DISPLAY[h.to_status]}</span>
                        <span className="font-medium ml-1">{h.action}</span>
                      </div>
                      <div className="text-xs text-library-500 mt-1">
                        {h.operator} ({ROLE_DISPLAY[h.operator_role]}) · {h.created_at.replace('T', ' ').slice(0, 19)}
                      </div>
                      {h.remark && <div className="text-xs text-library-600 mt-1">备注：{h.remark}</div>}
                      <div className="text-xs text-library-500 mt-1">
                        需证据：{h.evidence_required.join('、') || '-'}；已提供：{h.evidence_provided.join('、') || '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {tab === 'audit' && (
                <div className="space-y-3">
                  {notes.length === 0 && <div className="text-library-500 text-sm">暂无审计记录</div>}
                  {notes.map((n: AuditNote) => (
                    <div
                      key={n.id}
                      className={`pl-3 py-1 border-l-2 ${
                        n.exception_type ? 'border-red-300 bg-red-50/40 -ml-3 ml-0 pl-6 -mr-3 pr-3 py-2 rounded-r' : 'border-library-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`badge ${STATUS_COLOR[n.status_snapshot]} text-[10px]`}>
                          {STATUS_DISPLAY[n.status_snapshot]}
                        </span>
                        {n.exception_type && (
                          <span className="badge bg-red-100 text-red-700 border-red-300 text-[10px]">
                            ⚠ {n.exception_type}
                          </span>
                        )}
                        <span className="text-xs text-library-500">
                          {n.operator} ({ROLE_DISPLAY[n.operator_role]}) · {n.created_at.replace('T', ' ').slice(0, 19)}
                        </span>
                      </div>
                      <div className="text-sm text-library-700 mt-1">{n.note}</div>
                      {n.exception_detail && (
                        <div className="text-xs text-red-600 mt-1 font-mono">{n.exception_detail}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <div className="text-sm font-medium text-library-600 mb-3">
              办理操作（当前角色：{ROLE_DISPLAY[currentRole]}）
            </div>
            {allowed.length === 0 ? (
              <div className="text-sm text-library-500 bg-library-50 p-3 rounded">
                当前角色对 <strong>{STATUS_DISPLAY[record.status]}</strong> 状态的记录无可执行操作。
                {record.node_timeout && <div className="text-red-600 mt-2">⚠ 该记录已节点超时，仅馆长可推进。</div>}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">选择操作</label>
                  <select
                    className="select"
                    value={targetStatus}
                    onChange={(e) => {
                      const v = e.target.value as BorrowStatus;
                      setTargetStatus(v);
                      const req = EVIDENCE_BY_TRANSITION[`${record!.status}|${v}`] || [];
                      setEvidence(req);
                      const found = allowed.find((t) => t.to === v);
                      if (found) setAction(found.label);
                    }}
                  >
                    <option value="">请选择...</option>
                    {allowed.map((t) => (
                      <option key={t.to} value={t.to}>
                        {t.label}（→ {STATUS_DISPLAY[t.to]}）
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">操作说明</label>
                  <input className="input" value={action} onChange={(e) => setAction(e.target.value)} />
                </div>
                <div>
                  <label className="label">备注</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="可选，填写办理说明"
                  />
                </div>
                {targetStatus === 'returned_for_correction' && (
                  <div>
                    <label className="label">需补正材料（用顿号、逗号或换行分隔）</label>
                    <textarea
                      className="input"
                      rows={2}
                      value={correctionItems}
                      onChange={(e) => setCorrectionItems(e.target.value)}
                      placeholder="例如：借阅凭证、身份证明"
                    />
                  </div>
                )}
                {targetStatus && NEXT_HANDLER_BY_STATUS[targetStatus] && (
                  <div className="text-xs bg-library-50 p-3 rounded border border-library-200">
                    <span className="text-library-600">下一处理人：</span>
                    <span className="font-medium text-library-800 ml-1">
                      {NEXT_HANDLER_BY_STATUS[targetStatus]!.name}
                    </span>
                    <span className="text-library-500 ml-1">
                      （{ROLE_DISPLAY[NEXT_HANDLER_BY_STATUS[targetStatus]!.role]}）
                    </span>
                    {targetStatus === 'pending_assignment' && (
                      <span className="block text-library-500 mt-1">
                        补正材料齐全后，将交回流通馆员重新分派
                      </span>
                    )}
                  </div>
                )}
                <div>
                  <label className="label">
                    证据材料
                    {requiredEvidence.length > 0 && (
                      <span className="text-red-500 text-xs ml-1">（必需：{requiredEvidence.join('、')}）</span>
                    )}
                  </label>
                  <div className="space-y-1">
                    {allEvidenceOptions.map((e) => {
                      const required = requiredEvidence.includes(e);
                      const checked = evidence.includes(e);
                      return (
                        <label key={e} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(ev) => {
                              setEvidence(
                                ev.target.checked ? [...evidence, e] : evidence.filter((x) => x !== e)
                              );
                            }}
                            className="rounded"
                          />
                          {e}
                          {required && <span className="text-red-500 text-xs">*</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
                {processError && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                    ✗ {processError}
                    <div className="text-xs mt-1">该异常已写入审计备注，可在左侧"审计备注"中追溯。</div>
                  </div>
                )}
                <button
                  className="btn-primary w-full justify-center"
                  onClick={handleProcess}
                  disabled={!targetStatus || processing}
                >
                  {processing ? '提交中...' : '确认办理'}
                </button>
                <button
                  className="btn-secondary w-full justify-center"
                  onClick={() => router.push('/')}
                >
                  返回列表继续办理
                </button>
              </div>
            )}
          </div>

          <div className="card p-4">
            <div className="text-sm font-medium text-library-600 mb-2">责任追溯链</div>
            <ul className="text-xs space-y-1.5">
              <li className="flex justify-between">
                <span>发起/补正</span>
                <span className="font-medium">借阅登记员</span>
              </li>
              <li className="flex justify-between">
                <span>初始队列（待分派）</span>
                <span className="font-medium">流通馆员</span>
              </li>
              <li className="flex justify-between">
                <span>中段处理（已转办）</span>
                <span className="font-medium">采编馆员</span>
              </li>
              <li className="flex justify-between">
                <span>办理（已回访）</span>
                <span className="font-medium">借阅审核主管</span>
              </li>
              <li className="flex justify-between">
                <span>最终意见/归档</span>
                <span className="font-medium">馆长</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
