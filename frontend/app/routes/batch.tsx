import { Component, createSignal, For, Show, onMount } from 'solid-js';
import Layout from '~/components/Layout';
import StatusBadge from '~/components/StatusBadge';
import WarningTag from '~/components/WarningTag';
import BatchResultComponent from '~/components/BatchResult';
import FormModal from '~/components/FormModal';
import { getApplications, batchProcess } from '~/api/applications';
import { user, fetchMe } from '~/store/auth';
import {
  getAllowedActions,
  ACTION_LABELS,
  STATUS_GROUPS,
  GROUP_LABELS,
  getActionButtonClass,
} from '~/utils/status';
import type {
  Application,
  ProcessAction,
  BatchResultItem,
  BatchProcessItem,
  StatusGroup,
} from '~/types';
import dayjs from 'dayjs';

const BatchCenter: Component = () => {
  const [applications, setApplications] = createSignal<Application[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [processing, setProcessing] = createSignal(false);
  const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set());
  const [filterStatus, setFilterStatus] = createSignal<StatusGroup>('pending');
  const [keyword, setKeyword] = createSignal('');
  const [selectedAction, setSelectedAction] = createSignal<ProcessAction>('confirm');
  const [showResult, setShowResult] = createSignal(false);
  const [batchResults, setBatchResults] = createSignal<BatchResultItem[]>([]);
  const [modalOpen, setModalOpen] = createSignal(false);
  const [error, setError] = createSignal('');

  const loadData = async () => {
    if (!user()) {
      await fetchMe();
    }

    setLoading(true);
    setError('');
    try {
      const res = await getApplications({ page: 1, page_size: 200 });
      setApplications(res.list);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
  });

  const filteredApplications = () => {
    let list = applications();

    if (filterStatus() !== 'all') {
      const groupStatuses = STATUS_GROUPS[filterStatus()];
      if (groupStatuses) {
        list = list.filter((a) => groupStatuses.includes(a.status));
      }
    }

    if (keyword()) {
      const kw = keyword().toLowerCase();
      list = list.filter(
        (a) =>
          a.application_no.toLowerCase().includes(kw) ||
          a.applicant_name.toLowerCase().includes(kw)
      );
    }

    return list;
  };

  const availableActions = (): ProcessAction[] => {
    if (!user()) return [];
    const actions = new Set<ProcessAction>();
    const selectedApps = filteredApplications().filter((a) => selectedIds().has(a.id));
    for (const app of selectedApps) {
      const allowed = getAllowedActions(app.status, user()!.role);
      for (const action of allowed) {
        actions.add(action);
      }
    }
    return Array.from(actions);
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds());
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredApplications().map((a) => a.id);
    const allSelected = visibleIds.every((id) => selectedIds().has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  const isAllSelected = () => {
    const visibleIds = filteredApplications().map((a) => a.id);
    return visibleIds.length > 0 && visibleIds.every((id) => selectedIds().has(id));
  };

  const selectedApplications = () =>
    filteredApplications().filter((a) => selectedIds().has(a.id));

  const openBatchModal = (action: ProcessAction) => {
    setSelectedAction(action);
    setModalOpen(true);
  };

  const handleBatchProcess = async (payload: {
    comment?: string;
    reason_code?: string;
    reason_detail?: string;
    payment_evidence?: string;
    overdue_note?: string;
  }) => {
    const apps = selectedApplications();
    const items: BatchProcessItem[] = apps.map((app) => ({
      id: app.id,
      action: selectedAction(),
      version: app.version,
      ...payload,
    }));

    setProcessing(true);
    setError('');
    try {
      const res = await batchProcess({ items });
      setBatchResults(res.results);
      setShowResult(true);
      setModalOpen(false);
      setSelectedIds(new Set());
      await loadData();
    } catch (err: any) {
      setError(err.message || '批量处理失败');
    } finally {
      setProcessing(false);
    }
  };

  const tabs: StatusGroup[] = ['pending', 'exception', 'completed', 'all'];

  return (
    <Layout>
      <div class="container">
        <div class="card" style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              'justify-content': 'space-between',
              'align-items': 'center',
              marginBottom: '16px',
              'flex-wrap': 'wrap',
              gap: '12px',
            }}
          >
            <h2 style={{ 'font-size': '20px', 'font-weight': '600', margin: 0 }}>
              批量处理中心
            </h2>
            <div style={{ color: '#999', 'font-size': '14px' }}>
              已选择{' '}
              <span style={{ color: '#1890ff', 'font-weight': '600' }}>
                {selectedIds().size}
              </span>{' '}
              条申请
            </div>
          </div>

          <div class="tabs" style={{ marginBottom: '16px' }}>
            <For each={tabs}>
              {(tab) => (
                <div
                  class={{ 'tab-item': true, 'active': filterStatus() === tab }}
                  onClick={() => {
                    setFilterStatus(tab);
                    setSelectedIds(new Set());
                  }}
                >
                  {GROUP_LABELS[tab]}
                </div>
              )}
            </For>
          </div>

          <div class="filter-bar">
            <input
              type="text"
              class="form-input"
              style={{ width: '240px' }}
              placeholder="搜索编号/申请人"
              value={keyword()}
              onInput={(e) => setKeyword(e.target.value)}
            />
            <button class="btn" onClick={loadData}>
              刷新
            </button>
          </div>

          <Show when={error()}>
            <div
              style={{
                padding: '12px 16px',
                background: '#fff1f0',
                border: '1px solid #ffa39e',
                color: '#ff4d4f',
                'border-radius': '4px',
                marginBottom: '16px',
                'font-size': '14px',
              }}
            >
              {error()}
              <button
                class="btn btn-primary"
                style={{ 'margin-left': '16px' }}
                onClick={loadData}
              >
                重试
              </button>
            </div>
          </Show>

          <Show when={selectedIds().size > 0}>
            <div
              style={{
                padding: '16px',
                background: '#e6f7ff',
                'border-radius': '8px',
                border: '1px solid #91d5ff',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'space-between',
                  'flex-wrap': 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ color: '#1890ff', 'font-weight': '500' }}>
                  已选择 {selectedIds().size} 条申请，请选择操作：
                </div>
                <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap' }}>
                  <Show when={availableActions().length === 0}>
                    <span
                      style={{
                        color: '#999',
                        'font-size': '14px',
                        padding: '8px 0',
                      }}
                    >
                      所选申请无共同可用操作，请调整选择
                    </span>
                  </Show>
                  <For each={availableActions()}>
                    {(action) => (
                      <button
                        class={getActionButtonClass(action)}
                        onClick={() => openBatchModal(action)}
                      >
                        批量{ACTION_LABELS[action]}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </Show>

          <div
            style={{
              overflow: 'auto',
              border: '1px solid #f0f0f0',
              'border-radius': '8px',
            }}
          >
            <table>
              <thead>
                <tr>
                  <th style={{ width: '48px' }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected()}
                      style={{
                        cursor: 'pointer',
                        width: '16px',
                        height: '16px',
                      }}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>申请编号</th>
                  <th>申请人</th>
                  <th>标题</th>
                  <th>类型</th>
                  <th>金额</th>
                  <th>创建时间</th>
                  <th>到期日</th>
                  <th>状态</th>
                  <th>预警</th>
                </tr>
              </thead>
              <tbody>
                <Show when={loading()}>
                  <tr>
                    <td
                      colspan="10"
                      style={{
                        'text-align': 'center',
                        padding: '48px',
                        color: '#999',
                      }}
                    >
                      加载中...
                    </td>
                  </tr>
                </Show>
                <Show when={!loading() && filteredApplications().length === 0}>
                  <tr>
                    <td
                      colspan="10"
                      style={{
                        'text-align': 'center',
                        padding: '48px',
                        color: '#999',
                      }}
                    >
                      暂无数据
                    </td>
                  </tr>
                </Show>
                <For each={filteredApplications()}>
                  {(app) => (
                    <tr
                      style={{
                        background: selectedIds().has(app.id)
                          ? '#f0f8ff'
                          : undefined,
                      }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds().has(app.id)}
                          style={{
                            cursor: 'pointer',
                            width: '16px',
                            height: '16px',
                          }}
                          onChange={() => toggleSelect(app.id)}
                        />
                      </td>
                      <td style={{ color: '#1890ff' }}>{app.application_no}</td>
                      <td>{app.applicant_name}</td>
                      <td
                        style={{
                          maxWidth: '200px',
                          overflow: 'hidden',
                          'text-overflow': 'ellipsis',
                          'white-space': 'nowrap',
                        }}
                        title={app.title}
                      >
                        {app.title}
                      </td>
                      <td>{app.type}</td>
                      <td style={{ color: '#f5222d', 'font-weight': '500' }}>
                        ¥
                        {app.amount.toLocaleString('zh-CN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td style={{ color: '#666', 'font-size': '13px' }}>
                        {dayjs(app.created_at).format('YYYY-MM-DD HH:mm')}
                      </td>
                      <td style={{ color: '#666', 'font-size': '13px' }}>
                        {dayjs(app.due_date).format('YYYY-MM-DD')}
                      </td>
                      <td>
                        <StatusBadge status={app.status} />
                      </td>
                      <td>
                        <WarningTag
                          dueDate={app.due_date}
                          isOverdue={app.is_overdue}
                        />
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>

        <Show when={showResult()}>
          <div class="card">
            <div
              style={{
                display: 'flex',
                'justify-content': 'space-between',
                'align-items': 'center',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ 'font-size': '16px', 'font-weight': '600', margin: 0 }}>
                批量处理结果
              </h3>
              <button class="btn" onClick={() => setShowResult(false)}>
                关闭
              </button>
            </div>
            <BatchResultComponent results={batchResults()} />
          </div>
        </Show>
      </div>

      <FormModal
        open={modalOpen()}
        action={selectedAction()}
        isOverdue={selectedApplications().some((a) => a.is_overdue)}
        onClose={() => setModalOpen(false)}
        onConfirm={handleBatchProcess}
        loading={processing()}
      />
    </Layout>
  );
};

export default BatchCenter;
