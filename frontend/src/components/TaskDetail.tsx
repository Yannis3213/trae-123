import { createSignal, Show, For, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { api, STATUS_LABELS, STATUS_BADGE_CLASS, OVERDUE_LABELS, ROLE_LABELS, FIELD_RECORD_TYPE_LABELS, getCurrentUser, getErrorMessage } from '../lib/api';

export default function TaskDetail(props: { id: string }) {
  const navigate = useNavigate();
  const [task, setTask] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(true);
  const [actionError, setActionError] = createSignal('');
  const [actionSuccess, setActionSuccess] = createSignal('');

  const [showAssignModal, setShowAssignModal] = createSignal(false);
  const [showReturnModal, setShowReturnModal] = createSignal(false);
  const [showProcessModal, setShowProcessModal] = createSignal(false);
  const [showTransferModal, setShowTransferModal] = createSignal(false);
  const [showFollowUpModal, setShowFollowUpModal] = createSignal(false);

  const [users, setUsers] = createSignal<any[]>([]);
  const [selectedAssignee, setSelectedAssignee] = createSignal('');
  const [returnReason, setReturnReason] = createSignal('');
  const [processEvidence, setProcessEvidence] = createSignal('');
  const [transferTarget, setTransferTarget] = createSignal('');
  const [transferRemarks, setTransferRemarks] = createSignal('');
  const [followUpResult, setFollowUpResult] = createSignal('');

  const user = () => getCurrentUser();

  const loadTask = async () => {
    setLoading(true);
    try {
      const data: any = await api.tasks.detail(props.id);
      setTask(data);
    } catch (err) {
      console.error('加载任务详情失败', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data: any = await api.auth.users();
      setUsers(data);
    } catch (err) {
      console.error('加载用户列表失败', err);
    }
  };

  onMount(async () => {
    await Promise.all([loadTask(), loadUsers()]);
  });

  const clearMessages = () => {
    setActionError('');
    setActionSuccess('');
  };

  const doAction = async (fn: () => Promise<any>, modalSetter?: (v: boolean) => void) => {
    clearMessages();
    try {
      await fn();
      if (modalSetter) modalSetter(false);
      setActionSuccess('操作成功');
      await loadTask();
    } catch (err: any) {
      setActionError(getErrorMessage(err));
    }
  };

  const assignTask = () => doAction(async () => {
    if (!selectedAssignee()) throw { message: '请选择分派人' };
    await api.tasks.assign(task().id, { assigneeId: selectedAssignee(), version: task().version });
  }, setShowAssignModal);

  const processTask = () => doAction(async () => {
    if (!processEvidence()) throw { message: '开始处理需要提供处理依据' };
    await api.tasks.process(task().id, { action: 'process', evidence: processEvidence(), version: task().version });
  }, setShowProcessModal);

  const completeProcessing = () => doAction(async () => {
    if (!processEvidence()) throw { message: '完成处理需要提交处理结果' };
    await api.tasks.process(task().id, { action: 'complete_processing', evidence: processEvidence(), version: task().version });
  }, setShowProcessModal);

  const transferTask = () => doAction(async () => {
    if (!transferTarget()) throw { message: '请选择转办目标人' };
    await api.tasks.transfer(task().id, { targetAssigneeId: transferTarget(), remarks: transferRemarks(), version: task().version });
  }, setShowTransferModal);

  const followUpTask = () => doAction(async () => {
    if (!followUpResult()) throw { message: '请填写回访结果' };
    await api.tasks.followUp(task().id, { result: followUpResult(), version: task().version });
  }, setShowFollowUpModal);

  const archiveTask = () => doAction(async () => {
    await api.tasks.archive(task().id, { version: task().version });
  });

  const returnTask = () => doAction(async () => {
    if (!returnReason()) throw { message: '退回补正必须填写退回原因' };
    await api.tasks.returnForCorrection(task().id, { reason: returnReason(), version: task().version });
  }, setShowReturnModal);

  const isDirector = () => user()?.role === 'cooperative_director';
  const isTechnician = () => user()?.role === 'agricultural_technician';
  const isFieldManager = () => user()?.role === 'field_manager';
  const isAssignee = () => task()?.assigneeId === user()?.id;
  const currentUserRole = () => user()?.role || '';

  const ACTION_RULES: Record<string, {
    allowedFrom: string[];
    allowedRoles: string[];
    requireAssignee?: boolean;
  }> = {
    assign: {
      allowedFrom: ['pending_assign', 'returned_for_correction', 'assigned'],
      allowedRoles: ['cooperative_director'],
    },
    process: {
      allowedFrom: ['assigned'],
      allowedRoles: ['cooperative_director', 'agricultural_technician', 'field_manager'],
      requireAssignee: true,
    },
    complete_processing: {
      allowedFrom: ['processing'],
      allowedRoles: ['cooperative_director', 'agricultural_technician', 'field_manager'],
      requireAssignee: true,
    },
    transfer: {
      allowedFrom: ['assigned', 'processing', 'transferred'],
      allowedRoles: ['cooperative_director', 'agricultural_technician', 'field_manager'],
      requireAssignee: true,
    },
    follow_up: {
      allowedFrom: ['transferred'],
      allowedRoles: ['cooperative_director', 'agricultural_technician'],
    },
    archive: {
      allowedFrom: ['followed_up'],
      allowedRoles: ['cooperative_director'],
    },
    return_for_correction: {
      allowedFrom: ['pending_assign', 'assigned', 'processing', 'transferred', 'followed_up'],
      allowedRoles: ['cooperative_director', 'agricultural_technician'],
    },
  };

  const canDoAction = (action: string) => {
    const t = task();
    const u = user();
    if (!t || !u) return false;

    const rule = ACTION_RULES[action];
    if (!rule) return false;

    if (!rule.allowedFrom.includes(t.status)) return false;
    if (!rule.allowedRoles.includes(u.role)) return false;

    if (rule.requireAssignee) {
      if (t.assigneeId !== u.id && u.role !== 'cooperative_director') return false;
    }

    if (u.role === 'field_manager' && t.assigneeRole !== 'field_manager' && action !== 'transfer') {
      return false;
    }

    return true;
  };

  const canAssign = () => canDoAction('assign');
  const canProcess = () => canDoAction('process');
  const canCompleteProcessing = () => canDoAction('complete_processing');
  const canTransfer = () => canDoAction('transfer');
  const canFollowUp = () => canDoAction('follow_up');
  const canArchive = () => canDoAction('archive');
  const canReturn = () => canDoAction('return_for_correction');

  return (
    <div class="p-6">
      <Show when={!loading()} fallback={<div class="text-center text-gray-400 py-8">加载中...</div>}>
        <Show when={task()} fallback={<div class="text-center text-gray-400 py-8">任务不存在</div>}>
          <div class="flex items-center gap-4 mb-6">
            <button class="btn-secondary btn-sm" onClick={() => navigate('/')}>← 返回</button>
            <div class="flex-1">
              <div class="flex items-center gap-3">
                <h2 class="text-xl font-bold text-gray-900">{task().taskNo}</h2>
                <span class={`badge ${STATUS_BADGE_CLASS[task().status]}`}>{task().statusLabel}</span>
                <Show when={task().overdueStatus && task().overdueStatus !== 'normal'}>
                  <span class={`badge ${task().overdueStatus === 'overdue' ? 'bg-danger-100 text-danger-700' : 'bg-warning-100 text-warning-700'}`}>
                    {OVERDUE_LABELS[task().overdueStatus]}
                  </span>
                </Show>
              </div>
              <h3 class="text-lg text-gray-700 mt-1">{task().title}</h3>
            </div>
          </div>

          <Show when={actionError()}>
            <div class="mb-4 p-3 bg-danger-50 text-danger-600 text-sm rounded-lg">{actionError()}</div>
          </Show>
          <Show when={actionSuccess()}>
            <div class="mb-4 p-3 bg-primary-50 text-primary-600 text-sm rounded-lg">{actionSuccess()}</div>
          </Show>

          <div class="grid grid-cols-3 gap-6">
            <div class="col-span-2 space-y-6">
              <div class="card p-5">
                <h4 class="font-medium text-gray-900 mb-3">任务信息</h4>
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div><span class="text-gray-500">任务编号：</span>{task().taskNo}</div>
                  <div><span class="text-gray-500">状态：</span>{task().statusLabel}</div>
                  <div><span class="text-gray-500">创建人：</span>{task().creatorName}</div>
                  <div><span class="text-gray-500">当前处理人：</span>{task().assigneeName || '-'}</div>
                  <div><span class="text-gray-500">种植计划：</span>{task().planName || '-'}</div>
                  <div><span class="text-gray-500">计划年月：</span>{task().planYear || '-'}年{task().planMonth || '-'}月</div>
                  <div><span class="text-gray-500">截止日期：</span>{task().deadline || '-'}</div>
                  <div><span class="text-gray-500">版本号：</span>v{task().version}</div>
                </div>
                <Show when={task().description}>
                  <div class="mt-3 text-sm">
                    <span class="text-gray-500">描述：</span>
                    <p class="mt-1 text-gray-700 bg-gray-50 p-3 rounded-lg">{task().description}</p>
                  </div>
                </Show>
                <Show when={task().exceptionReason}>
                  <div class="mt-3 text-sm">
                    <span class="text-danger-500 font-medium">异常/退回原因：</span>
                    <p class="mt-1 text-danger-600 bg-danger-50 p-3 rounded-lg">{task().exceptionReason}</p>
                  </div>
                </Show>
              </div>

              <div class="card p-5">
                <h4 class="font-medium text-gray-900 mb-3">农资领用</h4>
                <Show when={task().materials?.length} fallback={<p class="text-sm text-gray-400">暂无农资领用记录</p>}>
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b border-gray-100">
                        <th class="py-2 text-left text-gray-500 font-medium">物资名称</th>
                        <th class="py-2 text-left text-gray-500 font-medium">数量</th>
                        <th class="py-2 text-left text-gray-500 font-medium">状态</th>
                        <th class="py-2 text-left text-gray-500 font-medium">申请人</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={task().materials}>
                        {(m: any) => (
                          <tr class="border-b border-gray-50">
                            <td class="py-2">{m.material_name}</td>
                            <td class="py-2">{m.quantity} {m.unit}</td>
                            <td class="py-2">
                              <span class={`badge ${m.requisition_status === 'approved' ? 'bg-green-100 text-green-700' : m.requisition_status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                {m.requisition_status === 'approved' ? '已审批' : m.requisition_status === 'pending' ? '待审批' : '已驳回'}
                              </span>
                            </td>
                            <td class="py-2 text-gray-500">{m.applicant_id === user()?.id ? '我' : m.applicant_id}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </Show>
              </div>

              <div class="card p-5">
                <h4 class="font-medium text-gray-900 mb-3">田间记录</h4>
                <Show when={task().fieldRecords?.length} fallback={<p class="text-sm text-gray-400">暂无田间记录</p>}>
                  <div class="space-y-3">
                    <For each={task().fieldRecords}>
                      {(fr: any) => (
                        <div class="border border-gray-100 rounded-lg p-3">
                          <div class="flex items-center gap-2 mb-1">
                            <span class="badge bg-primary-100 text-primary-700">{FIELD_RECORD_TYPE_LABELS[fr.record_type] || fr.record_type}</span>
                            <span class="text-xs text-gray-400">{fr.record_date}</span>
                            <Show when={fr.weather}><span class="text-xs text-gray-400">天气: {fr.weather}</span></Show>
                          </div>
                          <p class="text-sm text-gray-700">{fr.content}</p>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              <div class="card p-5">
                <h4 class="font-medium text-gray-900 mb-3">审计轨迹</h4>
                <Show when={task().auditLogs?.length} fallback={<p class="text-sm text-gray-400">暂无审计记录</p>}>
                  <div class="space-y-2">
                    <For each={task().auditLogs}>
                      {(log: any) => (
                        <div class="flex items-start gap-3 text-sm border-l-2 border-primary-200 pl-3 py-1">
                          <div class="flex-1">
                            <div class="flex items-center gap-2">
                              <span class="font-medium text-gray-700">{log.operator_name || log.operator_id}</span>
                              <span class="text-gray-400">{log.action}</span>
                              <span class="text-xs text-gray-400">{log.created_at}</span>
                            </div>
                            <div class="text-gray-500 text-xs">
                              {STATUS_LABELS[log.before_status] || '-'} → {STATUS_LABELS[log.after_status] || '-'}
                            </div>
                            <Show when={log.fail_reason}>
                              <div class="text-danger-500 text-xs mt-0.5">失败原因: {log.fail_reason}</div>
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              <div class="card p-5">
                <h4 class="font-medium text-gray-900 mb-3">处理记录</h4>
                <Show when={task().processingRecords?.length} fallback={<p class="text-sm text-gray-400">暂无处理记录</p>}>
                  <div class="space-y-2">
                    <For each={task().processingRecords}>
                      {(pr: any) => (
                        <div class="flex items-center gap-3 text-sm p-2 rounded-lg bg-gray-50">
                          <span class={pr.result === 'success' ? 'text-primary-600' : 'text-danger-600'}>
                            {pr.result === 'success' ? '✅' : '❌'}
                          </span>
                          <span class="font-medium">{pr.processor_name || pr.processor_id}</span>
                          <span class="text-gray-500">{pr.action}</span>
                          <Show when={pr.evidence}><span class="text-gray-400 text-xs">证据: {pr.evidence}</span></Show>
                          <Show when={pr.fail_reason}><span class="text-danger-500 text-xs">失败: {pr.fail_reason}</span></Show>
                          <span class="text-gray-400 text-xs ml-auto">{pr.created_at}</span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>

            <div class="space-y-6">
              <div class="card p-5">
                <h4 class="font-medium text-gray-900 mb-3">操作</h4>
                <div class="space-y-2">
                  <Show when={canAssign()}>
                    <button class="btn-primary w-full" onClick={() => { clearMessages(); setShowAssignModal(true); }}>分派任务</button>
                  </Show>
                  <Show when={canProcess()}>
                    <button class="btn-primary w-full" onClick={() => { clearMessages(); setProcessEvidence(''); setShowProcessModal(true); }}>开始处理</button>
                  </Show>
                  <Show when={canCompleteProcessing()}>
                    <button class="btn-primary w-full" onClick={() => { clearMessages(); setProcessEvidence(''); setShowProcessModal(true); }}>完成处理</button>
                  </Show>
                  <Show when={canTransfer()}>
                    <button class="btn-warning w-full" onClick={() => { clearMessages(); setShowTransferModal(true); }}>转办</button>
                  </Show>
                  <Show when={canFollowUp()}>
                    <button class="btn-primary w-full" onClick={() => { clearMessages(); setShowFollowUpModal(true); }}>回访</button>
                  </Show>
                  <Show when={canArchive()}>
                    <button class="btn-primary w-full" onClick={() => { clearMessages(); archiveTask(); }}>归档</button>
                  </Show>
                  <Show when={canReturn()}>
                    <button class="btn-danger w-full" onClick={() => { clearMessages(); setShowReturnModal(true); }}>退回补正</button>
                  </Show>

                  <Show when={!canAssign() && !canProcess() && !canCompleteProcessing() && !canTransfer() && !canFollowUp() && !canArchive() && !canReturn()}>
                    <p class="text-sm text-gray-400 text-center py-4">当前无可执行操作</p>
                  </Show>
                </div>
              </div>

              <Show when={task()?.status === 'returned_for_correction'}>
                <div class="card p-5 border-danger-200">
                  <h4 class="font-medium text-danger-600 mb-2">补正信息</h4>
                  <p class="text-sm text-danger-600 bg-danger-50 p-3 rounded-lg">{task().exceptionReason}</p>
                </div>
              </Show>
            </div>
          </div>

          <Show when={showAssignModal()}>
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAssignModal(false)}>
              <div class="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <h4 class="font-medium text-gray-900 mb-4">分派任务</h4>
                <div class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 mb-1">选择分派人</label>
                  <select class="select" value={selectedAssignee()} onChange={(e) => setSelectedAssignee(e.currentTarget.value)}>
                    <option value="">请选择</option>
                    <For each={users()}>
                      {(u: any) => <option value={u.id}>{u.displayName} ({ROLE_LABELS[u.role]})</option>}
                    </For>
                  </select>
                </div>
                <div class="flex gap-2 justify-end">
                  <button class="btn-secondary" onClick={() => setShowAssignModal(false)}>取消</button>
                  <button class="btn-primary" onClick={assignTask}>确认分派</button>
                </div>
              </div>
            </div>
          </Show>

          <Show when={showProcessModal()}>
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowProcessModal(false)}>
              <div class="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <h4 class="font-medium text-gray-900 mb-4">{task()?.status === 'assigned' ? '开始处理' : '完成处理'}</h4>
                <div class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    {task()?.status === 'assigned' ? '处理依据' : '处理结果'}
                  </label>
                  <textarea
                    class="input min-h-[100px]"
                    value={processEvidence()}
                    onInput={(e) => setProcessEvidence(e.currentTarget.value)}
                    placeholder={task()?.status === 'assigned' ? '请说明处理依据...' : '请说明处理结果...'}
                  />
                </div>
                <div class="flex gap-2 justify-end">
                  <button class="btn-secondary" onClick={() => setShowProcessModal(false)}>取消</button>
                  <button class="btn-primary" onClick={task()?.status === 'assigned' ? processTask : completeProcessing}>确认</button>
                </div>
              </div>
            </div>
          </Show>

          <Show when={showTransferModal()}>
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTransferModal(false)}>
              <div class="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <h4 class="font-medium text-gray-900 mb-4">转办</h4>
                <div class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 mb-1">转办目标人</label>
                  <select class="select" value={transferTarget()} onChange={(e) => setTransferTarget(e.currentTarget.value)}>
                    <option value="">请选择</option>
                    <For each={users().filter((u: any) => u.id !== user()?.id)}>
                      {(u: any) => <option value={u.id}>{u.displayName} ({ROLE_LABELS[u.role]})</option>}
                    </For>
                  </select>
                </div>
                <div class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
                  <textarea class="input" value={transferRemarks()} onInput={(e) => setTransferRemarks(e.currentTarget.value)} />
                </div>
                <div class="flex gap-2 justify-end">
                  <button class="btn-secondary" onClick={() => setShowTransferModal(false)}>取消</button>
                  <button class="btn-warning" onClick={transferTask}>确认转办</button>
                </div>
              </div>
            </div>
          </Show>

          <Show when={showFollowUpModal()}>
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowFollowUpModal(false)}>
              <div class="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <h4 class="font-medium text-gray-900 mb-4">回访</h4>
                <div class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 mb-1">回访结果</label>
                  <textarea
                    class="input min-h-[100px]"
                    value={followUpResult()}
                    onInput={(e) => setFollowUpResult(e.currentTarget.value)}
                    placeholder="请填写回访结果..."
                  />
                </div>
                <div class="flex gap-2 justify-end">
                  <button class="btn-secondary" onClick={() => setShowFollowUpModal(false)}>取消</button>
                  <button class="btn-primary" onClick={followUpTask}>确认回访</button>
                </div>
              </div>
            </div>
          </Show>

          <Show when={showReturnModal()}>
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowReturnModal(false)}>
              <div class="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <h4 class="font-medium text-danger-600 mb-4">退回补正</h4>
                <div class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 mb-1">退回原因 *</label>
                  <textarea
                    class="input min-h-[100px]"
                    value={returnReason()}
                    onInput={(e) => setReturnReason(e.currentTarget.value)}
                    placeholder="请说明退回原因..."
                  />
                </div>
                <div class="flex gap-2 justify-end">
                  <button class="btn-secondary" onClick={() => setShowReturnModal(false)}>取消</button>
                  <button class="btn-danger" onClick={returnTask}>确认退回</button>
                </div>
              </div>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  );
}
