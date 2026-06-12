import { createSignal, createEffect, For, Show } from 'solid-js';
import { useParams } from '@solidjs/router';
import { useAuth, RoleSwitcher } from '../components/AuthProvider';
import { apiFetch, STATUS_LABELS, PRIORITY_LABELS, TYPE_LABELS, WARNING_LABELS, ROLE_LABELS, type Plan, type Attachment, type ProcessRecord } from '../utils/api';

export default function PlanDetail() {
  const params = useParams();
  const { user } = useAuth();
  const [plan, setPlan] = createSignal<Plan | null>(null);
  const [error, setError] = createSignal('');
  const [returnReason, setReturnReason] = createSignal('');
  const [rejectReason, setRejectReason] = createSignal('');
  const [auditNote, setAuditNote] = createSignal('');
  const [showReturnModal, setShowReturnModal] = createSignal(false);
  const [showRejectModal, setShowRejectModal] = createSignal(false);

  const loadPlan = async () => {
    try {
      const res = await apiFetch<Plan>(`/plans/${params.id}`);
      setPlan(res.data);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  createEffect(() => {
    if (params.id) loadPlan();
  });

  const handleSign = async () => {
    if (!plan()) return;
    try {
      await apiFetch(`/plans/${plan()!.id}/sign`, {
        method: 'POST',
        body: JSON.stringify({ version: plan()!.version }),
      });
      loadPlan();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReviewApprove = async () => {
    if (!plan()) return;
    try {
      await apiFetch(`/plans/${plan()!.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ result: 'approve', version: plan()!.version, auditNote: auditNote() }),
      });
      setAuditNote('');
      loadPlan();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReturn = async () => {
    if (!plan() || !returnReason()) {
      alert('请填写退回原因');
      return;
    }
    try {
      await apiFetch(`/plans/${plan()!.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ result: 'return', returnReason: returnReason(), version: plan()!.version, auditNote: auditNote() }),
      });
      setReturnReason('');
      setAuditNote('');
      setShowReturnModal(false);
      loadPlan();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCorrect = async () => {
    if (!plan()) return;
    try {
      await apiFetch(`/plans/${plan()!.id}/correct`, {
        method: 'POST',
        body: JSON.stringify({ version: plan()!.version, auditNote: auditNote() }),
      });
      setAuditNote('');
      loadPlan();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleVerifyApprove = async () => {
    if (!plan()) return;
    try {
      await apiFetch(`/plans/${plan()!.id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ result: 'approve', version: plan()!.version, auditNote: auditNote() }),
      });
      setAuditNote('');
      loadPlan();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReject = async () => {
    if (!plan() || !rejectReason()) {
      alert('请填写异常回传原因');
      return;
    }
    try {
      await apiFetch(`/plans/${plan()!.id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ result: 'reject', rejectReason: rejectReason(), version: plan()!.version, auditNote: auditNote() }),
      });
      setRejectReason('');
      setAuditNote('');
      setShowRejectModal(false);
      loadPlan();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUploadAttachment = async (att: Attachment) => {
    try {
      await apiFetch(`/plans/${plan()!.id}/attachments`, {
        method: 'POST',
        body: JSON.stringify({ fileName: att.fileName, fileType: att.fileType, fileSize: Math.floor(Math.random() * 500 + 100) * 1024 }),
      });
      loadPlan();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div class="min-h-screen bg-[var(--color-surface)]">
      <RoleSwitcher />
      <div class="p-4 max-w-5xl mx-auto">
        <Show when={error()} fallback={
          <Show when={plan()} fallback={
            <div class="text-center py-12 text-gray-400">加载中...</div>
          }>
            {(() => {
              const p = plan()!;
              return (
                <>
                  <div class="flex items-center gap-3 mb-4">
                    <a href="/" class="text-sm text-gray-500 hover:text-[var(--color-accent)] no-underline">← 返回列表</a>
                    <span class="text-gray-300">|</span>
                    <h2 class="text-lg font-bold text-[var(--color-primary)]">{p.planNo}</h2>
                    <span class={`status-badge status-${p.status}`}>{STATUS_LABELS[p.status]}</span>
                    <Show when={p.exceptionTag}>
                      <span class="tag tag-exception">{p.exceptionTag}</span>
                    </Show>
                  </div>

                  <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="card">
                      <h3 class="text-sm font-semibold text-[var(--color-primary)] mb-3 pb-2 border-b">基本信息</h3>
                      <div class="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span class="text-gray-500">标题：</span>
                          <span class="font-medium">{p.title}</span>
                        </div>
                        <div>
                          <span class="text-gray-500">类型：</span>
                          <span>{TYPE_LABELS[p.type]}</span>
                        </div>
                        <div>
                          <span class="text-gray-500">优先级：</span>
                          <span class={`tag tag-${p.priority}`}>{PRIORITY_LABELS[p.priority]}</span>
                        </div>
                        <div>
                          <span class="text-gray-500">截止时间：</span>
                          <span class={`warning-${p.dueWarning}`}>{p.dueDate}</span>
                          <span class={`text-xs ml-1 warning-${p.dueWarning}`}>({WARNING_LABELS[p.dueWarning]})</span>
                        </div>
                        <div>
                          <span class="text-gray-500">责任人：</span>
                          <span>{p.responsiblePerson}</span>
                        </div>
                        <div>
                          <span class="text-gray-500">当前处理人：</span>
                          <span>{p.currentHandler || '-'}</span>
                        </div>
                        <div>
                          <span class="text-gray-500">版本号：</span>
                          <span class="font-mono text-xs">v{p.version}</span>
                        </div>
                        <div>
                          <span class="text-gray-500">创建时间：</span>
                          <span class="text-xs">{new Date(p.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div class="card">
                      <h3 class="text-sm font-semibold text-[var(--color-primary)] mb-3 pb-2 border-b">处理信息</h3>
                      <div class="space-y-2 text-sm">
                        <Show when={p.reviewResult}>
                          <div><span class="text-gray-500">审核结果：</span><span class="text-green-600">{p.reviewResult}</span></div>
                        </Show>
                        <Show when={p.verifyResult}>
                          <div><span class="text-gray-500">复核结果：</span><span class="text-green-600">{p.verifyResult}</span></div>
                        </Show>
                        <Show when={p.returnReason}>
                          <div><span class="text-gray-500">退回原因：</span><span class="text-red-600">{p.returnReason}</span></div>
                        </Show>
                      </div>
                    </div>
                  </div>

                  <div class="card mb-4">
                    <h3 class="text-sm font-semibold text-[var(--color-primary)] mb-3 pb-2 border-b">附件</h3>
                    <div class="space-y-2">
                      <For each={p.attachments || []}>
                        {(att) => (
                          <div class="flex items-center gap-3 p-2 rounded bg-gray-50">
                            <span class={`text-sm ${att.required && !att.uploadedAt ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                              {att.required && !att.uploadedAt ? '⚠️' : '📎'} {att.fileName}
                            </span>
                            <span class="text-xs text-gray-400">.{att.fileType}</span>
                            <Show when={att.uploadedAt}>
                              <span class="text-xs text-green-600">已上传</span>
                            </Show>
                            <Show when={!att.uploadedAt && att.required}>
                              <span class="text-xs text-red-500 font-medium">（必填，未上传）</span>
                              <button class="btn btn-sm btn-accent text-xs ml-auto" onClick={() => handleUploadAttachment(att)}>模拟上传</button>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>

                  <div class="card mb-4">
                    <h3 class="text-sm font-semibold text-[var(--color-primary)] mb-3 pb-2 border-b">操作</h3>
                    <div class="space-y-3">
                      <div class="flex items-center gap-2">
                        <span class="text-sm text-gray-500">审计备注：</span>
                        <input
                          class="flex-1 border rounded px-3 py-1.5 text-sm"
                          placeholder="可选填审计备注"
                          value={auditNote()}
                          onInput={(e) => setAuditNote(e.target.value)}
                        />
                      </div>

                      <div class="flex flex-wrap gap-2">
                        <Show when={p.status === 'pending_sign' && user()?.role === 'reviewer'}>
                          <button class="btn btn-primary" onClick={handleSign}>签收</button>
                        </Show>
                        <Show when={p.status === 'reviewing' && user()?.role === 'reviewer'}>
                          <button class="btn btn-accent" onClick={handleReviewApprove}>审核通过</button>
                          <button class="btn btn-danger" onClick={() => setShowReturnModal(true)}>退回补正</button>
                        </Show>
                        <Show when={(p.status === 'returned' || p.status === 'rejected') && user()?.role === 'registrar'}>
                          <button class="btn btn-accent" onClick={handleCorrect}>补正提交</button>
                        </Show>
                        <Show when={p.status === 'pending_verify' && user()?.role === 'director'}>
                          <button class="btn btn-accent" onClick={handleVerifyApprove}>复核归档</button>
                          <button class="btn btn-danger" onClick={() => setShowRejectModal(true)}>异常回传</button>
                        </Show>
                        <Show when={p.status === 'pending_sign' && user()?.role !== 'reviewer'}>
                          <span class="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded">等待审核主管签收</span>
                        </Show>
                        <Show when={p.status === 'reviewing' && user()?.role !== 'reviewer'}>
                          <span class="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded">审核主管正在办理</span>
                        </Show>
                        <Show when={p.status === 'pending_verify' && user()?.role !== 'director'}>
                          <span class="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded">等待复核负责人复核</span>
                        </Show>
                        <Show when={p.status === 'archived'}>
                          <span class="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded">已归档</span>
                        </Show>
                      </div>
                    </div>
                  </div>

                  <div class="card">
                    <h3 class="text-sm font-semibold text-[var(--color-primary)] mb-3 pb-2 border-b">审计轨迹</h3>
                    <div class="space-y-0">
                      <For each={(p.processRecords || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}>
                        {(record) => (
                          <div class="flex gap-3 py-2 border-b border-gray-100 last:border-0">
                            <div class="w-2 h-2 rounded-full bg-[var(--color-accent)] mt-2 shrink-0"></div>
                            <div class="flex-1">
                              <div class="flex items-center gap-2">
                                <span class="text-sm font-medium">{record.action}</span>
                                <span class="text-xs text-gray-400">
                                  {ROLE_LABELS[record.operatorRole as any] || record.operatorRole} · {record.operator}
                                </span>
                                <span class="text-xs text-gray-400 ml-auto">
                                  {new Date(record.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <Show when={record.fromStatus || record.toStatus}>
                                <div class="text-xs text-gray-500 mt-0.5">
                                  {record.fromStatus ? STATUS_LABELS[record.fromStatus as any] || record.fromStatus : '—'} → {STATUS_LABELS[record.toStatus as any] || record.toStatus}
                                </div>
                              </Show>
                              <Show when={record.result}>
                                <div class="text-xs text-gray-600">结果：{record.result}</div>
                              </Show>
                              <Show when={record.returnReason}>
                                <div class="text-xs text-red-600">退回原因：{record.returnReason}</div>
                              </Show>
                              <Show when={record.exceptionReason}>
                                <div class="text-xs text-red-600">异常原因：{record.exceptionReason}</div>
                              </Show>
                              <Show when={record.auditNote}>
                                <div class="text-xs text-gray-500">审计备注：{record.auditNote}</div>
                              </Show>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </>
              );
            })()}
          </Show>
        }>
          {(err) => <div class="text-center py-12 text-red-500">{err()}</div>}
        </Show>

        <Show when={showReturnModal()}>
          <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowReturnModal(false)}>
            <div class="bg-white rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h3 class="text-lg font-bold text-[var(--color-primary)] mb-4">退回补正</h3>
              <div>
                <label class="block text-xs text-gray-500 mb-1">退回原因（必填）</label>
                <textarea
                  class="w-full border rounded px-3 py-2 text-sm h-24"
                  value={returnReason()}
                  onInput={(e) => setReturnReason(e.target.value)}
                  placeholder="请填写退回原因"
                />
              </div>
              <div class="flex gap-2 mt-4">
                <button class="btn btn-danger flex-1" onClick={handleReturn}>确认退回</button>
                <button class="btn btn-outline flex-1" onClick={() => setShowReturnModal(false)}>取消</button>
              </div>
            </div>
          </div>
        </Show>

        <Show when={showRejectModal()}>
          <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRejectModal(false)}>
            <div class="bg-white rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h3 class="text-lg font-bold text-[var(--color-primary)] mb-4">异常回传</h3>
              <div>
                <label class="block text-xs text-gray-500 mb-1">异常原因（必填）</label>
                <textarea
                  class="w-full border rounded px-3 py-2 text-sm h-24"
                  value={rejectReason()}
                  onInput={(e) => setRejectReason(e.target.value)}
                  placeholder="请填写异常回传原因"
                />
              </div>
              <div class="flex gap-2 mt-4">
                <button class="btn btn-danger flex-1" onClick={handleReject}>确认回传</button>
                <button class="btn btn-outline flex-1" onClick={() => setShowRejectModal(false)}>取消</button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
