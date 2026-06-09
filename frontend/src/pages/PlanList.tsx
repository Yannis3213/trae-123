import { createSignal, createEffect, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import type { TreatmentPlanItem, PlanStatus, DueStatus, ProcessAction } from '@/types';
import { PlanStatusLabel, DueStatusLabel } from '@/types';
import { getPlanList } from '@/api';
import { useToast, dueStatusTagClass, planStatusTagClass, formatDate, formatDateOnly } from '@/utils';
import BatchProcessModal from '@/components/BatchProcessModal';

const statusOptions: Array<{ value: PlanStatus | ''; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'pending_confirm', label: '待确认' },
  { value: 'confirmed', label: '已确认' },
  { value: 'exception', label: '异常' },
  { value: 'pending_review', label: '待复查' },
  { value: 'reviewed', label: '已复查' },
  { value: 'archived', label: '已归档' },
];

const dueStatusOptions: Array<{ value: DueStatus | ''; label: string }> = [
  { value: '', label: '全部' },
  { value: 'normal', label: '正常' },
  { value: 'approaching', label: '临期7天内' },
  { value: 'overdue', label: '逾期' },
];

export default function PlanList() {
  const navigate = useNavigate();
  const { toast, show } = useToast();
  const [list, setList] = createSignal<TreatmentPlanItem[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [status, setStatus] = createSignal<PlanStatus | ''>('');
  const [deadlineWarning, setDeadlineWarning] = createSignal<DueStatus | ''>('');
  const [search, setSearch] = createSignal('');
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const [batchModal, setBatchModal] = createSignal<{
    visible: boolean;
    action: ProcessAction;
    actionLabel: string;
  }>({ visible: false, action: 'confirm', actionLabel: '确认' });

  const fetchList = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (status()) params.status = status();
      if (deadlineWarning()) params.deadlineWarning = deadlineWarning();
      if (search()) params.search = search();
      const res = await getPlanList(params);
      setList(res.data);
    } catch (err: any) {
      show('error', err.message || '加载列表失败');
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    fetchList();
    const handleRefresh = () => fetchList();
    window.addEventListener('plan-list:refresh', handleRefresh);
    return () => window.removeEventListener('plan-list:refresh', handleRefresh);
  });

  const handleSearch = () => {
    fetchList();
  };

  const handleReset = () => {
    setStatus('');
    setDeadlineWarning('');
    setSearch('');
    fetchList();
  };

  const toggleSelect = (id: string | number) => {
    const set = new Set(selectedIds());
    const key = String(id);
    if (set.has(key)) {
      set.delete(key);
    } else {
      set.add(key);
    }
    setSelectedIds(set);
  };

  const toggleSelectAll = () => {
    if (selectedIds().size === list().length) {
      setSelectedIds(new Set());
    } else {
      const newSet = new Set<string>();
      for (const item of list()) {
        newSet.add(String(item.id));
      }
      setSelectedIds(newSet);
    }
  };

  const selectedItems = () => list().filter((i) => selectedIds().has(String(i.id)));

  const openBatchModal = (action: typeof batchModal().action, actionLabel: string) => {
    if (selectedIds().size === 0) {
      show('error', '请先选择要批量处理的单据');
      return;
    }
    setBatchModal({ visible: true, action, actionLabel });
  };

  return (
    <div>
      <div class="card">
        <div class="card-title">治疗计划列表</div>
        <div class="filter-bar">
          <div class="form-item">
            <select
              class="form-select"
              value={status()}
              onChange={(e) => setStatus((e.target as HTMLSelectElement).value as PlanStatus | '')}
            >
              <For each={statusOptions}>
                {(opt) => (
                  <option value={opt.value}>{opt.label}</option>
                )}
              </For>
            </select>
          </div>
          <div class="form-item">
            <select
              class="form-select"
              value={deadlineWarning()}
              onChange={(e) => setDeadlineWarning((e.target as HTMLSelectElement).value as DueStatus | '')}
            >
              <For each={dueStatusOptions}>
                {(opt) => (
                  <option value={opt.value}>{opt.label}</option>
                )}
              </For>
            </select>
          </div>
          <div class="form-item" style={{ flex: 1, 'min-width': '240px' }}>
            <input
              class="form-input"
              type="text"
              placeholder="搜索：患者姓名/计划单号"
              value={search()}
              onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />
          </div>
          <div class="btn-group">
            <button class="btn btn-primary" onClick={handleSearch}>
              搜索
            </button>
            <button class="btn" onClick={handleReset}>
              重置
            </button>
          </div>
        </div>

        <div style={{ margin: '12px 0', display: 'flex', gap: '8px', 'align-items': 'center', 'flex-wrap': 'wrap' }}>
          <span style={{ color: '#666', 'font-size': '13px' }}>
            已选择 {selectedIds().size} / {list().length} 条
          </span>
          <button class="btn btn-sm btn-primary" onClick={() => openBatchModal('confirm', '确认')}>
            批量确认
          </button>
          <button class="btn btn-sm btn-danger" onClick={() => openBatchModal('mark_exception', '标记异常')}>
            批量异常
          </button>
          <button class="btn btn-sm btn-info" onClick={() => openBatchModal('resolve_exception', '补正复查')}>
            批量补正复查
          </button>
          <button class="btn btn-sm btn-warning" onClick={() => openBatchModal('submit_review', '提交复查')}>
            批量提交复查
          </button>
          <button class="btn btn-sm btn-success" onClick={() => openBatchModal('review', '复查通过')}>
            批量复查通过
          </button>
          <button class="btn btn-sm" onClick={() => openBatchModal('archive', '归档')}>
            批量归档
          </button>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th style={{ width: '44px' }}>
                  <input
                    type="checkbox"
                    class="checkbox"
                    checked={selectedIds().size === list().length && list().length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>计划单号</th>
                <th>患者姓名</th>
                <th>手机号</th>
                <th>当前状态</th>
                <th>当前处理人</th>
                <th>复诊日期</th>
                <th>提醒状态</th>
                <th>补正次数</th>
                <th>异常摘要</th>
                <th>创建时间</th>
                <th>截止日期</th>
                <th>到期状态</th>
                <th style={{ width: '160px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              <Show when={!loading() && list().length === 0}>
                <tr>
                  <td colspan="14">
                    <div class="empty">暂无数据</div>
                  </td>
                </tr>
              </Show>
              <For each={list()}>
                {(item) => (
                  <tr>
                    <td>
                      <input
                        type="checkbox"
                        class="checkbox"
                        checked={selectedIds().has(String(item.id))}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td style={{ color: '#1890ff', cursor: 'pointer' }} onClick={() => navigate(`/plans/${item.id}`)}>
                      {item.planNo}
                    </td>
                    <td>{item.patientName}</td>
                    <td>{item.patientPhone || item.phone}</td>
                    <td>
                      <span class={planStatusTagClass(item.status)}>
                        {PlanStatusLabel[item.status]}
                      </span>
                    </td>
                    <td>{item.currentHandler}</td>
                    <td>{item.followUpDate ? formatDateOnly(item.followUpDate) : '-'}</td>
                    <td>{item.reminderComplete ? '✅ 已完成' : '❌ 未完成'}</td>
                    <td style={{ color: (item.correctCount || 0) > 0 ? '#fa8c16' : 'inherit' }}>
                      {item.correctCount || 0}
                    </td>
                    <td style={{ color: item.abnormalSummary ? '#ff4d4f' : 'inherit' }}>
                      {item.abnormalSummary || '-'}
                    </td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>{formatDateOnly(item.deadline)}</td>
                    <td>
                      <span class={dueStatusTagClass(item.dueStatus)}>
                        {DueStatusLabel[item.dueStatus]}
                      </span>
                    </td>
                    <td>
                      <button class="btn btn-sm" onClick={() => navigate(`/plans/${item.id}`)}>
                        详情
                      </button>
                      <button
                        class="btn btn-sm btn-primary"
                        style={{ 'margin-left': '6px' }}
                        onClick={() => navigate(`/plans/${item.id}?action=process`)}
                      >
                        办理
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>

      <BatchProcessModal
        visible={batchModal().visible}
        items={selectedItems()}
        action={batchModal().action}
        actionLabel={batchModal().actionLabel}
        onClose={() => setBatchModal({ ...batchModal(), visible: false })}
        onSuccess={() => {
          setBatchModal({ ...batchModal(), visible: false });
          setSelectedIds(new Set());
          fetchList();
        }}
      />

      <Show when={toast()}>
        <div class={`toast toast-${toast()!.type}`}>{toast()!.message}</div>
      </Show>
    </div>
  );
}
