import { createSignal, Show, For, onMount } from 'solid-js';
import { api, STATUS_LABELS, ROLE_LABELS } from '../lib/api';

export default function AuditLogList() {
  const [logs, setLogs] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [actionFilter, setActionFilter] = createSignal('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (actionFilter()) params.action = actionFilter();
      const data: any = await api.auditLogs.list(params);
      setLogs(data);
    } catch (err) {
      console.error('加载审计日志失败', err);
    } finally {
      setLoading(false);
    }
  };

  onMount(loadLogs);

  const actionLabels: Record<string, string> = {
    create: '创建',
    assign: '分派',
    process: '处理',
    complete_processing: '完成处理',
    transfer: '转办',
    follow_up: '回访',
    archive: '归档',
    return_for_correction: '退回补正',
    overdue_advance: '逾期推进',
  };

  return (
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-bold text-gray-900">审计轨迹</h2>
          <p class="text-sm text-gray-500 mt-1">记录所有操作人、前后状态和失败原因</p>
        </div>
        <select
          class="select max-w-xs"
          value={actionFilter()}
          onChange={(e) => { setActionFilter(e.currentTarget.value); loadLogs(); }}
        >
          <option value="">全部操作类型</option>
          <For each={Object.entries(actionLabels)}>
            {([key, label]) => <option value={key}>{label}</option>}
          </For>
        </select>
      </div>

      <Show when={!loading()} fallback={<div class="text-center text-gray-400 py-8">加载中...</div>}>
        <div class="card">
          <Show when={logs().length > 0} fallback={<div class="p-8 text-center text-gray-400">暂无审计记录</div>}>
            <table class="w-full">
              <thead>
                <tr class="border-b border-gray-100">
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">时间</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">操作人</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">角色</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">操作</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">任务</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">状态变更</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">失败原因</th>
                </tr>
              </thead>
              <tbody>
                <For each={logs()}>
                  {(log: any) => (
                    <tr class="border-b border-gray-50 hover:bg-gray-50">
                      <td class="px-4 py-3 text-xs text-gray-500">{log.created_at}</td>
                      <td class="px-4 py-3 text-sm font-medium">{log.operator_name || '-'}</td>
                      <td class="px-4 py-3 text-xs text-gray-500">{ROLE_LABELS[log.operator_role] || log.operator_role}</td>
                      <td class="px-4 py-3 text-sm">{actionLabels[log.action] || log.action}</td>
                      <td class="px-4 py-3 text-sm">
                        <span class="text-primary-600">{log.task_no}</span>
                        <span class="text-gray-400 text-xs ml-1">{log.task_title}</span>
                      </td>
                      <td class="px-4 py-3 text-xs">
                        <span class="text-gray-500">{STATUS_LABELS[log.before_status] || '-'}</span>
                        <span class="mx-1">→</span>
                        <span class="text-primary-600">{STATUS_LABELS[log.after_status] || '-'}</span>
                      </td>
                      <td class="px-4 py-3 text-xs text-danger-500">{log.fail_reason || '-'}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Show>
        </div>
      </Show>
    </div>
  );
}
