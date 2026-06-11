import { Component, createSignal, For, Show, onMount, createEffect } from 'solid-js';
import Layout from '~/components/Layout';
import StatusBadge from '~/components/StatusBadge';
import WarningTag from '~/components/WarningTag';
import BatchResultComponent from '~/components/BatchResult';
import FormModal from '~/components/FormModal';
import { getApplications, batchProcess, getAllowedActionsBatch } from '~/api/applications';
import { user, fetchMe } from '~/store/auth';
import { ACTION_LABELS, GROUP_LABELS, getActionButtonClass } from '~/utils/status';
import type { Application, ProcessAction, BatchResultItem, StatusGroup } from '~/types';

const BatchCenter: Component = () => {
  const [applications, setApplications] = createSignal<Application[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [processing, setProcessing] = createSignal(false);
  const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set());
  const [filterStatus, setFilterStatus] = createSignal<StatusGroup>('pending');
  const [keyword, setKeyword] = createSignal('');
  const [selectedAction, setSelectedAction] = createSignal<ProcessAction>('review');
  const [showResult, setShowResult] = createSignal(false);
  const [batchResults, setBatchResults] = createSignal<BatchResultItem[]>([]);
  const [modalOpen, setModalOpen] = createSignal(false);
  const [error, setError] = createSignal('');
  const [commonActions, setCommonActions] = createSignal<ProcessAction[]>([]);
  const [loadingActions, setLoadingActions] = createSignal(false);
  const [actionsById, setActionsById] = createSignal<Record<number, ProcessAction[]>>({});
  const [requirementsByAction, setRequirementsByAction] = createSignal<Record<string, any>>({});

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

  createEffect(() => {
    const ids = Array.from(selectedIds());
    if (ids.length === 0 || !user()) {
      setCommonActions([]);
      setActionsById({});
      return;
    }

    setLoadingActions(true);
    getAllowedActionsBatch(ids)
      .then((res) => {
        setCommonActions(res.common_actions || []);
        setActionsById(res.actions_by_id || {});
        setRequirementsByAction(res.requirements_by_action || {});
      })
      .catch((err) => {
        console.error('获取共同动作失败:', err);
        setCommonActions([]);
        setActionsById({});
        setRequirementsByAction({});
      })
      .finally(() => {
        setLoadingActions(false);
      });
  });

  const filteredApplications = () => {
    let list = applications();

    if (filterStatus() !== 'all') {
      const groupStatuses = {
        pending: ['pending_review', 'verifying', 'confirming'],
        exception: ['exception'],
        completed: ['completed', 'rejected', 'returned'],
        all: ['pending_review', 'verifying', 'confirming', 'exception', 'completed', 'rejected', 'returned'],
      } as const;
      const statuses = groupStatuses[filterStatus()];
      if (statuses) {
        list = list.filter((a) => statuses.includes(a.status));
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
    const items = apps.map((app) => ({
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

  const hasAnyActionForApp = (app: Application) => {
    const actions = actionsById()[app.id];
    return (actions?.length || 0) > 0;
  };

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
              {selectedIds().size > 0 && loadingActions() && (
                <span style={{ marginLeft: '8px', color: '#1890ff' }}>（查询后端共同动作中...）</span>
              )}
              {selectedIds().size > 0 && !loadingActions() && (
                <span style={{ marginLeft: '8px', color: commonActions().length > 0 ? '#52c41a' : '#ff4d4f' }}>
                  （后端下发共同动作：{commonActions().length}个）
                </span>
              )}
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
                  已选择 {selectedIds().size} 条申请，
                  后端下发共同可执行操作：
                </div>
                <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap' }}>
                  <Show when={commonActions().length === 0 && !loadingActions()}>
                    <span style={{ color: '#999', 'font-size': '14px', padding: '8px 0' }}>
                      ❌ 所选申请无共同可用操作（后端未下发 common_actions）。请减少选择或切换筛选条件。
                    </span>
                  </Show>
                  <For each={commonActions()}>
                    {(action) => {
                      const allSupport = selectedApplications().every(
                        (a) => actionsById()[a.id]?.includes(action)
                      );
                      const unsupportedCount = selectedApplications().filter(
                        (a) => !actionsById()[a.id]?.includes(action)
                      ).length;
                      return (
                        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                          <button
                            class={getActionButtonClass(action)}
                            disabled={unsupportedCount > 0}
                            style={{
                              padding: '8px 20px',
                              'font-size': '13px',
                              opacity: unsupportedCount > 0 ? 0.5 : 1,
                              cursor: unsupportedCount > 0 ? 'not-allowed' : 'pointer',
                            }}
                            onClick={() => openBatchModal(action)}
                            title={unsupportedCount > 0 ? `${unsupportedCount}条不支持该操作` : `对${selectedApplications().length}条执行${ACTION_LABELS[action]}`}
                          >
                            批量{ACTION_LABELS[action]}
                            {unsupportedCount > 0 && `（${selectedApplications().length - unsupportedCount}/${selectedApplications().length}）`}
                          </button>
                          {!allSupport && unsupportedCount === 0 && (
                            <div style={{ color: '#52c41a', 'font-size': '11px', 'text-align': 'center' }}>
                              后端全量支持
                            </div>
                          )}
                          {unsupportedCount > 0 && (
                            <div style={{ color: '#ff4d4f', 'font-size': '11px', 'text-align': 'center' }}>
                              {unsupportedCount}条不支持
                            </div>
                          )}
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>

              <Show when={selectedIds().size > 0}>
                <div
                  style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: '#fff',
                    'border-radius': '4px',
                    'font-size': '12px',
                    color: '#666',
                  }}
                >
                  <strong style={{ color: '#333' }}>每条的后端可执行动作：</strong>
                  <span style={{ marginLeft: '8px' }}>
                    {selectedApplications().slice(0, 5).map((a) => (
                      <span key={a.id} style={{ marginRight: '16px' }}>
                        {a.application_no}：
                        <span style={{ color: '#1890ff', fontWeight: 500 }}>
                          {(actionsById()[a.id] || []).map((x) => ACTION_LABELS[x]).join('、') || '无'}
                        </span>
                      </span>
                    ))}
                    {selectedApplications().length > 5 && (
                      <span style={{ color: '#999' }}>...共{selectedApplications().length}条</span>
                    )}
                  </span>
                </div>
              </Show>
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
                  <th>金额</th>
                  <th>状态</th>
                  <th>预警</th>
                  <th>处理人</th>
                  <th>附件</th>
                  <th>异常摘要</th>
                  <th>后端动作</th>
                </tr>
              </thead>
              <tbody>
                <Show when={loading()}>
                  <tr>
                    <td
                      colspan="11"
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
                      colspan="11"
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
                  {(app) => {
                    const appActions = actionsById()[app.id] || [];
                    const disabled = selectedIds().size > 0 && !commonActions().some((a) => appActions.includes(a));
                    return (
                      <tr
                        style={{
                          background: selectedIds().has(app.id)
                            ? '#f0f8ff'
                            : disabled
                            ? '#f9f9f9'
                            : undefined,
                          opacity: disabled ? 0.6 : 1,
                        }}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds().has(app.id)}
                            style={{
                              cursor: selectedIds().size > 0 && !commonActions().some((a) => appActions.includes(a)) && !selectedIds().has(app.id) ? 'not-allowed' : 'pointer',
                              width: '16px',
                              height: '16px',
                            }}
                            disabled={selectedIds().size > 0 && !commonActions().some((a) => appActions.includes(a)) && !selectedIds().has(app.id)}
                            onChange={() => toggleSelect(app.id)}
                          />
                        </td>
                        <td style={{ color: '#1890ff' }}>{app.application_no}</td>
                        <td>{app.applicant_name}</td>
                        <td
                          style={{
                            maxWidth: '160px',
                            overflow: 'hidden',
                            'text-overflow': 'ellipsis',
                            'white-space': 'nowrap',
                          }}
                          title={app.title}
                        >
                          {app.title}
                        </td>
                        <td style={{ color: '#f5222d', 'font-weight': '500' }}>
                          ¥{app.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <StatusBadge status={app.status} />
                        </td>
                        <td>
                          <WarningTag dueDate={app.due_date} isOverdue={app.is_overdue} />
                        </td>
                        <td style={{ 'font-size': '13px' }}>
                          {app.handler_name || '-'}
                        </td>
                        <td style={{ 'text-align': 'center' }}>
                          {app.attachment_count ?? 0}
                        </td>
                        <td style={{ maxWidth: '140px', 'font-size': '12px', color: '#ff4d4f', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }} title={app.exception_summary || ''}>
                          {app.exception_summary || <span style={{ color: '#ccc' }}>-</span>}
                        </td>
                        <td style={{ 'font-size': '11px', 'text-align': 'center', maxWidth: '140px' }}>
                          {appActions.length > 0 ? (
                            <span style={{ color: '#52c41a' }}>
                              {appActions.map((a) => ACTION_LABELS[a]).join('、')}
                            </span>
                          ) : (
                            <span style={{ color: '#999' }}>无</span>
                          )}
                        </td>
                      </tr>
                    );
                  }}
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
                批量处理结果（成功/失败原因 + 异常摘要 + 补正说明 + 审计备注）
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
        applicationNo={`批量${selectedApplications().length}条`}
        requirements={requirementsByAction()[selectedAction()]}
        onClose={() => setModalOpen(false)}
        onConfirm={handleBatchProcess}
        loading={processing()}
      />
    </Layout>
  );
};

export default BatchCenter;
