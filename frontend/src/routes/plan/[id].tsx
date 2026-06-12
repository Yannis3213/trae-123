import { createSignal, createEffect, For, Show, createMemo } from 'solid-js';
import { useParams } from '@solidjs/router';
import { useAuth, RoleSwitcher } from '../../components/AuthProvider';
import { apiFetch, STATUS_LABELS, PRIORITY_LABELS, TYPE_LABELS, WARNING_LABELS, ROLE_LABELS, type Plan, type Attachment, type ProcessRecord, type Role } from '../../utils/api';

const STATUS_FLOW: { status: string; label: string }[] = [
  { status: 'pending_sign', label: '待签收' },
  { status: 'reviewing', label: '审核中' },
  { status: 'pending_verify', label: '待复核' },
  { status: 'archived', label: '签收完成' },
];

const ACTION_COLORS: Record<string, string> = {
  '签收': 'bg-blue-500',
  '审核通过': 'bg-green-500',
  '退回补正': 'bg-yellow-500',
  '补正提交': 'bg-orange-500',
  '复核归档': 'bg-green-600',
  '异常回传': 'bg-red-500',
  '创建': 'bg-gray-500',
  '发起传播计划单': 'bg-gray-500',
  '批量签收拦截': 'bg-red-400',
  '批量复核拦截': 'bg-red-400',
  '批量复核拦截-逾期': 'bg-yellow-600',
  '批量签收拦截-逾期': 'bg-yellow-600',
};

const OPERATION_INSTRUCTIONS: Record<string, { title: string; actions: string[]; results: string[]; pitfalls: string[] }> = {
  registrar: {
    title: '传播计划登记员操作须知',
    actions: [
      '当计划状态为"退回补正"或"异常回传"时，您可以进行补正操作',
      '补正前请仔细阅读退回原因或异常原因',
      '补正后请检查所有必填材料是否齐全',
    ],
    results: [
      '补正提交后，计划将重新进入"待签收"状态',
      '审核主管将重新签收并审核您的补正内容',
    ],
    pitfalls: [
      '注意版本冲突：如果在您补正期间有其他人修改了计划，提交可能会失败',
      '材料不全可能导致审核再次被退回，请确保所有必填附件均已上传',
      '请务必填写补正说明，让审核人员了解您做了哪些修改',
    ],
  },
  reviewer: {
    title: '传播计划审核主管操作须知',
    actions: [
      '在"待签收"状态下，您可以签收该计划',
      '签收后进入"审核中"状态，您可以审核通过或退回补正',
      '退回补正时请填写详细的退回原因',
    ],
    results: [
      '签收后计划进入"审核中"状态',
      '审核通过后计划进入"待复核"状态',
      '退回补正后计划进入"退回补正"状态，登记员需要补正',
    ],
    pitfalls: [
      '退回时请务必填写清晰的退回原因，便于登记员理解和修改',
      '注意版本号：操作前请确认您看到的是最新版本',
      '审计备注会记录在案，请谨慎填写',
    ],
  },
  director: {
    title: '公关传播团队复核负责人操作须知',
    actions: [
      '在"待复核"状态下，您可以进行复核',
      '复核通过后计划将归档完成',
      '如发现问题，您可以异常回传',
    ],
    results: [
      '复核归档后计划进入"签收完成"状态，流程结束',
      '异常回传后计划进入"异常回传"状态，登记员需要补正',
    ],
    pitfalls: [
      '异常回传会给登记员带来较大困扰，请确保问题确实存在',
      '请详细填写异常原因，便于登记员准确定位问题',
      '复核是最后一道关卡，请仔细检查所有内容',
    ],
  },
};

export default function PlanDetail() {
  const params = useParams();
  const { user } = useAuth();
  const [plan, setPlan] = createSignal<Plan | null>(null);
  const [error, setError] = createSignal('');
  const [returnReason, setReturnReason] = createSignal('');
  const [rejectReason, setRejectReason] = createSignal('');
  const [auditNote, setAuditNote] = createSignal('');
  const [correctNote, setCorrectNote] = createSignal('');
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

  const currentFlowIndex = createMemo(() => {
    const p = plan();
    if (!p) return -1;
    if (p.status === 'returned' || p.status === 'rejected') return 0;
    return STATUS_FLOW.findIndex(s => s.status === p.status);
  });

  const isStageCompleted = (index: number) => {
    const p = plan();
    if (!p) return false;
    const idx = currentFlowIndex();
    if (p.status === 'archived') return true;
    if (p.status === 'returned' || p.status === 'rejected') return index < 1;
    return index < idx;
  };

  const isStageCurrent = (index: number) => {
    const p = plan();
    if (!p) return false;
    const idx = currentFlowIndex();
    if (p.status === 'returned' || p.status === 'rejected') return index === 0;
    return index === idx;
  };

  const materialStats = createMemo(() => {
    const p = plan();
    if (!p || !p.attachments) return { total: 0, required: 0, uploaded: 0, percentage: 0 };
    const required = p.attachments.filter(a => a.required);
    const uploaded = required.filter(a => a.uploadedAt);
    return {
      total: p.attachments.length,
      required: required.length,
      uploaded: uploaded.length,
      percentage: required.length > 0 ? Math.round((uploaded.length / required.length) * 100) : 100,
    };
  });

  const isCurrentHandler = createMemo(() => {
    const p = plan();
    const u = user();
    if (!p || !u) return false;
    return p.currentHandler === u.name;
  });

  const sortedRecords = createMemo(() => {
    const p = plan();
    if (!p || !p.processRecords) return [] as ProcessRecord[];
    return [...p.processRecords].sort((a: ProcessRecord, b: ProcessRecord) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  const getActionColor = (action: string) => {
    return ACTION_COLORS[action] || 'bg-gray-400';
  };

  const isCorrectionAction = (record: ProcessRecord) => {
    return record.action === '退回补正' || record.action === '补正提交';
  };

  const isExceptionAction = (record: ProcessRecord) => {
    return record.action === '异常回传' || !!record.exceptionReason;
  };

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
        body: JSON.stringify({ version: plan()!.version, auditNote: correctNote() || auditNote() }),
      });
      setAuditNote('');
      setCorrectNote('');
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

  const instructions = createMemo(() => {
    const u = user();
    if (!u) return null;
    return OPERATION_INSTRUCTIONS[u.role as Role] || null;
  });

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

                  <Show when={isCurrentHandler() && p.status !== 'archived'}>
                    <div class="mb-4 p-4 rounded-lg bg-gradient-to-r from-[#c9a84c]/20 to-[#dfc477]/20 border border-[#c9a84c]/40">
                      <div class="flex items-center gap-3">
                        <span class="text-2xl">👋</span>
                        <div>
                          <div class="font-bold text-[var(--color-primary)]">轮到您办理</div>
                          <div class="text-sm text-gray-600">
                            您是当前处理人，请及时处理该计划
                            <Show when={p.dueWarning !== 'normal'}>
                              <span class={`ml-2 font-medium warning-${p.dueWarning}`}>
                                ({WARNING_LABELS[p.dueWarning]})
                              </span>
                            </Show>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Show>

                  <div class="card mb-4">
                    <h3 class="text-sm font-semibold text-[var(--color-primary)] mb-4 pb-2 border-b">办理状态流程</h3>
                    <div class="flex items-center justify-between px-4 py-2">
                      <For each={STATUS_FLOW}>
                        {(stage, index) => (
                          <div class="flex items-center flex-1">
                            <div class="flex flex-col items-center">
                              <div
                                class={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                                  isStageCurrent(index())
                                    ? 'bg-[var(--color-accent)] text-[var(--color-primary)] ring-4 ring-[var(--color-accent)]/20 scale-110'
                                    : isStageCompleted(index())
                                    ? 'bg-[var(--color-accent)] text-white'
                                    : 'bg-gray-200 text-gray-500'
                                }`}
                              >
                                <Show when={isStageCompleted(index())} fallback={index() + 1}>
                                  ✓
                                </Show>
                              </div>
                              <span
                                class={`text-xs mt-2 font-medium ${
                                  isStageCurrent(index())
                                    ? 'text-[var(--color-accent)]'
                                    : isStageCompleted(index())
                                    ? 'text-gray-700'
                                    : 'text-gray-400'
                                }`}
                              >
                                {stage.label}
                              </span>
                            </div>
                            <Show when={index() < STATUS_FLOW.length - 1}>
                              <div
                                class={`flex-1 h-0.5 mx-2 mb-4 ${
                                  isStageCompleted(index() + 1)
                                    ? 'bg-[var(--color-accent)]'
                                    : 'bg-gray-200'
                                }`}
                              />
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                    <Show when={p.status === 'returned' || p.status === 'rejected'}>
                      <div class="mt-3 pt-3 border-t border-dashed border-gray-200">
                        <div class="flex items-center gap-2 text-sm">
                          <span class="tag tag-returned">
                            {p.status === 'returned' ? '退回补正中' : '异常回传中'}
                          </span>
                          <span class="text-gray-500">
                            {p.status === 'returned'
                              ? '计划已被退回，等待登记员补正后重新进入流程'
                              : '计划异常回传，等待登记员补正后重新进入流程'}
                          </span>
                        </div>
                      </div>
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
                          <span class="text-gray-500">版本号：</span>
                          <span class="font-mono text-xs">v{p.version}</span>
                        </div>
                        <div class="col-span-2">
                          <span class="text-gray-500">创建时间：</span>
                          <span class="text-xs">{new Date(p.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div class="card">
                      <h3 class="text-sm font-semibold text-[var(--color-primary)] mb-3 pb-2 border-b">处理信息</h3>
                      <div class="space-y-3 text-sm">
                        <div class="flex items-center gap-2">
                          <span class="text-gray-500">当前处理人：</span>
                          <div class="flex items-center gap-2">
                            <span class={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded ${
                              isCurrentHandler()
                                ? 'bg-[var(--color-accent)]/20 text-[var(--color-primary)] font-medium'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"></span>
                              {p.currentHandler || '-'}
                            </span>
                            <Show when={p.currentHandlerRole}>
                              <span class="tag tag-normal">
                                {ROLE_LABELS[p.currentHandlerRole]}
                              </span>
                            </Show>
                          </div>
                        </div>
                        <Show when={p.reviewResult}>
                          <div><span class="text-gray-500">审核结果：</span><span class="text-green-600">{p.reviewResult}</span></div>
                        </Show>
                        <Show when={p.verifyResult}>
                          <div><span class="text-gray-500">复核结果：</span><span class="text-green-600">{p.verifyResult}</span></div>
                        </Show>
                        <Show when={p.returnReason}>
                          <div class="p-2 bg-yellow-50 rounded border border-yellow-200">
                            <div class="text-yellow-700 font-medium text-xs mb-1">退回原因</div>
                            <div class="text-yellow-800">{p.returnReason}</div>
                          </div>
                        </Show>
                      </div>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="card bg-gradient-to-br from-[#c9a84c]/10 to-white border-[var(--color-accent)]/30">
                      <h3 class="text-sm font-semibold text-[var(--color-primary)] mb-3 pb-2 border-b border-[var(--color-accent)]/20 flex items-center gap-2">
                        <span class="text-lg">⚙️</span> 操作区
                      </h3>
                      <div class="space-y-3">
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-medium text-[var(--color-primary)]">当前操作：</span>
                          <span class="text-sm text-gray-600">
                            <Show when={p.status === 'pending_sign' && user()?.role === 'reviewer'}>
                              您可以签收此计划
                            </Show>
                            <Show when={p.status === 'reviewing' && user()?.role === 'reviewer'}>
                              您可以审核通过或退回补正
                            </Show>
                            <Show when={(p.status === 'returned' || p.status === 'rejected') && user()?.role === 'registrar'}>
                              您可以补正后重新提交
                            </Show>
                            <Show when={p.status === 'pending_verify' && user()?.role === 'director'}>
                              您可以复核归档或异常回传
                            </Show>
                            <Show when={
                              (p.status === 'pending_sign' && user()?.role !== 'reviewer') ||
                              (p.status === 'reviewing' && user()?.role !== 'reviewer') ||
                              (p.status === 'pending_verify' && user()?.role !== 'director') ||
                              p.status === 'archived'
                            }>
                              <Show when={p.status === 'archived'}>
                                计划已归档，流程结束
                              </Show>
                              <Show when={p.status !== 'archived'}>
                                等待其他角色处理
                              </Show>
                            </Show>
                          </span>
                        </div>

                        <Show when={(p.status === 'returned' || p.status === 'rejected') && user()?.role === 'registrar'}>
                          <div>
                            <label class="block text-sm font-medium text-[var(--color-primary)] mb-1.5">
                              补正说明
                              <span class="text-red-500 ml-0.5">*</span>
                            </label>
                            <textarea
                              class="w-full border border-[var(--color-accent)]/30 rounded px-3 py-2 text-sm h-20 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                              value={correctNote()}
                              onInput={(e) => setCorrectNote(e.target.value)}
                              placeholder="请详细说明本次补正的内容，便于审核人员快速了解修改情况..."
                            />
                          </div>
                        </Show>

                        <div class="flex items-center gap-2">
                          <span class="text-sm text-gray-500">审计备注：</span>
                          <input
                            class="flex-1 border rounded px-3 py-1.5 text-sm"
                            placeholder="可选填审计备注"
                            value={auditNote()}
                            onInput={(e) => setAuditNote(e.target.value)}
                          />
                        </div>

                        <div class="flex flex-wrap gap-2 pt-1">
                          <Show when={p.status === 'pending_sign' && user()?.role === 'reviewer'}>
                            <button
                              class="btn btn-primary px-5 py-2.5 text-base"
                              onClick={handleSign}
                              title="签收此计划，开始审核工作"
                            >
                              📩 签收
                            </button>
                          </Show>
                          <Show when={p.status === 'reviewing' && user()?.role === 'reviewer'}>
                            <button
                              class="btn btn-accent px-5 py-2.5 text-base font-medium"
                              onClick={handleReviewApprove}
                              title="审核通过，计划将进入待复核状态"
                            >
                              ✅ 审核通过
                            </button>
                            <button
                              class="btn btn-danger px-5 py-2.5 text-base"
                              onClick={() => setShowReturnModal(true)}
                              title="退回补正，要求登记员修改后重新提交"
                            >
                              ↩️ 退回补正
                            </button>
                          </Show>
                          <Show when={(p.status === 'returned' || p.status === 'rejected') && user()?.role === 'registrar'}>
                            <button
                              class="btn btn-accent px-5 py-2.5 text-base font-medium"
                              onClick={handleCorrect}
                              title="补正完成后提交，计划将重新进入待签收状态"
                            >
                              📤 补正提交
                            </button>
                          </Show>
                          <Show when={p.status === 'pending_verify' && user()?.role === 'director'}>
                            <button
                              class="btn btn-accent px-5 py-2.5 text-base font-medium"
                              onClick={handleVerifyApprove}
                              title="复核通过并归档，流程结束"
                            >
                              📁 复核归档
                            </button>
                            <button
                              class="btn btn-danger px-5 py-2.5 text-base"
                              onClick={() => setShowRejectModal(true)}
                              title="异常回传，要求登记员重新处理"
                            >
                              ❌ 异常回传
                            </button>
                          </Show>
                          <Show when={p.status === 'pending_sign' && user()?.role !== 'reviewer'}>
                            <span class="text-xs text-gray-400 bg-gray-100 px-3 py-2 rounded">等待审核主管签收</span>
                          </Show>
                          <Show when={p.status === 'reviewing' && user()?.role !== 'reviewer'}>
                            <span class="text-xs text-gray-400 bg-gray-100 px-3 py-2 rounded">审核主管正在办理</span>
                          </Show>
                          <Show when={p.status === 'pending_verify' && user()?.role !== 'director'}>
                            <span class="text-xs text-gray-400 bg-gray-100 px-3 py-2 rounded">等待复核负责人复核</span>
                          </Show>
                          <Show when={p.status === 'archived'}>
                            <span class="text-xs text-green-600 bg-green-50 px-3 py-2 rounded">✅ 已归档</span>
                          </Show>
                        </div>
                      </div>
                    </div>

                    <div class="card">
                      <h3 class="text-sm font-semibold text-[var(--color-primary)] mb-3 pb-2 border-b flex items-center gap-2">
                        <span class="text-lg">📋</span> 材料检查
                      </h3>
                      <div class="space-y-3">
                        <div>
                          <div class="flex items-center justify-between text-sm mb-1.5">
                            <span class="text-gray-600">必填材料完成度</span>
                            <span class={`font-bold ${
                              materialStats().percentage === 100
                                ? 'text-green-600'
                                : materialStats().percentage >= 60
                                ? 'text-yellow-600'
                                : 'text-red-500'
                            }`}>
                              {materialStats().percentage}%
                            </span>
                          </div>
                          <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              class={`h-full rounded-full transition-all ${
                                materialStats().percentage === 100
                                  ? 'bg-green-500'
                                  : materialStats().percentage >= 60
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={`width: ${materialStats().percentage}%`}
                            />
                          </div>
                          <div class="text-xs text-gray-400 mt-1">
                            {materialStats().uploaded} / {materialStats().required} 项必填材料已上传
                          </div>
                        </div>

                        <div class="space-y-1.5 max-h-40 overflow-y-auto">
                          <For each={p.attachments || []}>
                            {(att) => (
                              <div class={`flex items-center gap-2 p-2 rounded text-sm ${
                                att.required && !att.uploadedAt
                                  ? 'bg-red-50'
                                  : att.uploadedAt
                                  ? 'bg-green-50'
                                  : 'bg-gray-50'
                              }`}>
                                <span class={`text-base ${
                                  att.required && !att.uploadedAt
                                    ? 'text-red-500'
                                    : att.uploadedAt
                                    ? 'text-green-500'
                                    : 'text-gray-400'
                                }`}>
                                  {att.required && !att.uploadedAt ? '⚠️' : att.uploadedAt ? '✅' : '📎'}
                                </span>
                                <div class="flex-1 min-w-0">
                                  <div class={`truncate ${
                                    att.required && !att.uploadedAt ? 'text-red-700 font-medium' : 'text-gray-700'
                                  }`}>
                                    {att.fileName}
                                  </div>
                                  <div class="text-xs text-gray-400">
                                    .{att.fileType}
                                    <span class="ml-2">
                                      {att.required ? '必填' : '选填'}
                                    </span>
                                  </div>
                                </div>
                                <Show when={!att.uploadedAt && att.required}>
                                  <button
                                    class="btn btn-sm btn-accent text-xs"
                                    onClick={() => handleUploadAttachment(att)}
                                  >
                                    上传
                                  </button>
                                </Show>
                                <Show when={att.uploadedAt}>
                                  <span class="text-xs text-green-600">已上传</span>
                                </Show>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="card mb-4 bg-blue-50/50 border-blue-200">
                    <h3 class="text-sm font-semibold text-[var(--color-primary)] mb-3 pb-2 border-b border-blue-200 flex items-center gap-2">
                      <span class="text-lg">💡</span> 操作须知
                    </h3>
                    <Show when={instructions()}>
                      {(() => {
                        const inst = instructions()!;
                        return (
                          <div class="space-y-3 text-sm">
                            <div>
                              <div class="font-medium text-[var(--color-primary)] mb-1">您的角色：{ROLE_LABELS[user()!.role]}</div>
                            </div>
                            <div>
                              <div class="font-medium text-gray-700 mb-1">📌 您可以执行的操作：</div>
                              <ul class="list-disc list-inside text-gray-600 space-y-0.5 ml-1">
                                <For each={inst.actions}>
                                  {(action) => <li>{action}</li>}
                                </For>
                              </ul>
                            </div>
                            <div>
                              <div class="font-medium text-gray-700 mb-1">🔄 操作后的结果：</div>
                              <ul class="list-disc list-inside text-gray-600 space-y-0.5 ml-1">
                                <For each={inst.results}>
                                  {(result) => <li>{result}</li>}
                                </For>
                              </ul>
                            </div>
                            <div class="bg-yellow-50 p-3 rounded border border-yellow-200">
                              <div class="font-medium text-yellow-700 mb-1">⚠️ 常见注意事项：</div>
                              <ul class="list-disc list-inside text-yellow-700 space-y-0.5 ml-1 text-sm">
                                <For each={inst.pitfalls}>
                                  {(pitfall) => <li>{pitfall}</li>}
                                </For>
                              </ul>
                            </div>
                          </div>
                        );
                      })()}
                    </Show>
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

                  <div class="card">
                    <h3 class="text-sm font-semibold text-[var(--color-primary)] mb-3 pb-2 border-b">审计轨迹</h3>
                    <div class="relative pl-6">
                      <div class="absolute left-2 top-1 bottom-1 w-0.5 bg-gray-200"></div>
                      <For each={sortedRecords()}>
                        {(record) => {
                          const interceptTag = (() => {
                            const reason = record.exceptionReason || '';
                            if (record.action.includes('拦截')) {
                              if (reason.includes('越权')) return { label: '越权拦截', cls: 'bg-red-100 text-red-700 border border-red-200' };
                              if (reason.includes('版本冲突')) return { label: '版本冲突', cls: 'bg-orange-100 text-orange-700 border border-orange-200' };
                              if (reason.includes('逾期')) return { label: '逾期拦截', cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200' };
                              if (reason.includes('状态冲突')) return { label: '状态冲突', cls: 'bg-purple-100 text-purple-700 border border-purple-200' };
                              if (reason.includes('处理人不匹配')) return { label: '处理人不匹配', cls: 'bg-red-100 text-red-700 border border-red-200' };
                              if (reason.includes('资料缺失')) return { label: '资料缺失', cls: 'bg-amber-100 text-amber-700 border border-amber-200' };
                              return { label: '拦截', cls: 'bg-red-100 text-red-700 border border-red-200' };
                            }
                            return null;
                          })();
                          return (
                          <div class={`relative pb-4 last:pb-0 ${
                            isCorrectionAction(record) ? 'bg-yellow-50/50 -mx-2 px-2 py-2 rounded' : ''
                          } ${
                            isExceptionAction(record) ? 'bg-red-50/50 -mx-2 px-2 py-2 rounded' : ''
                          } ${
                            interceptTag ? 'bg-orange-50/50 -mx-2 px-2 py-2 rounded' : ''
                          }`}>
                            <div class={`absolute -left-[22px] top-1 w-4 h-4 rounded-full ${getActionColor(record.action)} ring-4 ring-white`}></div>
                            <div class="flex-1">
                              <div class="flex items-center gap-2 flex-wrap">
                                <span class="text-sm font-medium">{record.action}</span>
                                <Show when={isCorrectionAction(record)}>
                                  <span class="tag tag-returned text-xs">补正动作</span>
                                </Show>
                                <Show when={isExceptionAction(record)}>
                                  <span class="tag tag-rejected text-xs">异常</span>
                                </Show>
                                <Show when={interceptTag}>
                                  <span class={`text-[10px] px-1.5 py-0.5 rounded font-medium ${interceptTag!.cls}`}>{interceptTag!.label}</span>
                                </Show>
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
                                <div class="text-xs text-yellow-700 bg-yellow-100/50 px-2 py-1 rounded mt-1">
                                  📝 退回原因：{record.returnReason}
                                </div>
                              </Show>
                              <Show when={record.exceptionReason}>
                                <div class="text-xs text-red-600 bg-red-100/50 px-2 py-1 rounded mt-1 font-medium">
                                  ❌ 异常原因：{record.exceptionReason}
                                </div>
                              </Show>
                              <Show when={record.auditNote}>
                                <div class="text-xs text-gray-500">审计备注：{record.auditNote}</div>
                              </Show>
                            </div>
                          </div>
                          );
                        }}
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
