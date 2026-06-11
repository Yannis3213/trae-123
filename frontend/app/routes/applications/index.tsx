import { Component, createSignal, For, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import Layout from '~/components/Layout';
import StatusBadge from '~/components/StatusBadge';
import WarningTag from '~/components/WarningTag';
import { getApplications } from '~/api/applications';
import { user, fetchMe } from '~/store/auth';
import { STATUS_GROUPS, GROUP_LABELS, STATUS_LABELS } from '~/utils/status';
import type { Application, ApplicationStatus, StatusGroup, StatisticsData } from '~/types';
import dayjs from 'dayjs';

type TabKey = StatusGroup;

const ApplicationsList: Component = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = createSignal<Application[]>([]);
  const [statistics, setStatistics] = createSignal<StatisticsData>({
    pending_review: 0,
    verifying: 0,
    confirming: 0,
    exception: 0,
    completed: 0,
    rejected: 0,
    returned: 0,
  });
  const [loading, setLoading] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<TabKey>('all');
  const [keyword, setKeyword] = createSignal('');
  const [filterStatus, setFilterStatus] = createSignal<ApplicationStatus | ''>('');
  const [error, setError] = createSignal('');

  const loadData = async () => {
    if (!user()) {
      await fetchMe();
    }

    setLoading(true);
    setError('');
    try {
      const res = await getApplications({ page: 1, page_size: 100 });
      setApplications(res.list);
      setStatistics(res.statistics);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
  });

  const pendingCount = () =>
    statistics().pending_review + statistics().verifying + statistics().confirming;
  const exceptionCount = () => statistics().exception;
  const completedCount = () =>
    statistics().completed + statistics().rejected + statistics().returned;

  const filteredApplications = () => {
    let list = applications();

    if (activeTab() !== 'all') {
      const groupStatuses = STATUS_GROUPS[activeTab()];
      if (groupStatuses) {
        list = list.filter((a) => groupStatuses.includes(a.status));
      }
    }

    if (filterStatus()) {
      list = list.filter((a) => a.status === filterStatus());
    }

    if (keyword()) {
      const kw = keyword().toLowerCase();
      list = list.filter(
        (a) =>
          a.application_no.toLowerCase().includes(kw) ||
          a.applicant_name.toLowerCase().includes(kw) ||
          a.title.toLowerCase().includes(kw) ||
          a.type.toLowerCase().includes(kw)
      );
    }

    return list;
  };

  const tabs: TabKey[] = ['all', 'pending', 'exception', 'completed'];
  const allStatuses: ApplicationStatus[] = [
    'pending_review',
    'verifying',
    'confirming',
    'exception',
    'completed',
    'rejected',
    'returned',
  ];

  const tabBadgeCount = (tab: TabKey): number => {
    if (tab === 'all') return applications().length;
    if (tab === 'pending') return pendingCount();
    if (tab === 'exception') return exceptionCount();
    if (tab === 'completed') return completedCount();
    return 0;
  };

  const hasRectify = (app: Application): boolean => {
    return app.status === 'returned' || app.exceptions.some((e) => !e.resolved);
  };

  return (
    <Layout>
      <div class="container">
        <div
          style={{
            display: 'grid',
            'grid-template-columns': 'repeat(3, 1fr)',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div class="stat-card stat-card-pending" onClick={() => setActiveTab('pending')} style={{ cursor: 'pointer' }}>
            <div class="stat-card-title">待确认</div>
            <div class="stat-card-value">{pendingCount()}</div>
            <div style={{ color: '#999', 'font-size': '12px', marginTop: '4px' }}>
              待审核 {statistics().pending_review} · 待复核 {statistics().verifying} · 待确认{' '}
              {statistics().confirming}
            </div>
          </div>
          <div class="stat-card stat-card-exception" onClick={() => setActiveTab('exception')} style={{ cursor: 'pointer' }}>
            <div class="stat-card-title">异常</div>
            <div class="stat-card-value">{exceptionCount()}</div>
            <div style={{ color: '#999', 'font-size': '12px', marginTop: '4px' }}>
              需尽快处理
            </div>
          </div>
          <div class="stat-card stat-card-completed" onClick={() => setActiveTab('completed')} style={{ cursor: 'pointer' }}>
            <div class="stat-card-title">已复查</div>
            <div class="stat-card-value">{completedCount()}</div>
            <div style={{ color: '#999', 'font-size': '12px', marginTop: '4px' }}>
              完成 {statistics().completed} · 拒绝 {statistics().rejected} · 退回{' '}
              {statistics().returned}
            </div>
          </div>
        </div>

        <Show when={error()}>
          <div class="card" style={{ color: '#ff4d4f', marginBottom: '16px' }}>
            {error()}
            <button class="btn btn-primary" style={{ 'margin-left': '16px' }} onClick={loadData}>
              重试
            </button>
          </div>
        </Show>

        <div class="card">
          <div class="filter-bar">
            <input
              type="text"
              class="form-input"
              style={{ width: '280px' }}
              placeholder="搜索编号/申请人/标题/类型"
              value={keyword()}
              onInput={(e) => setKeyword(e.target.value)}
            />
            <select
              class="form-input"
              style={{ width: '160px' }}
              value={filterStatus()}
              onChange={(e) => setFilterStatus(e.target.value as ApplicationStatus | '')}
            >
              <option value="">全部状态</option>
              <For each={allStatuses}>
                {(status) => (
                  <option value={status}>{STATUS_LABELS[status]}</option>
                )}
              </For>
            </select>
            <button class="btn btn-primary" onClick={loadData}>
              刷新
            </button>
          </div>

          <div class="tabs">
            <For each={tabs}>
              {(tab) => (
                <div
                  class={{ 'tab-item': true, 'active': activeTab() === tab }}
                  onClick={() => setActiveTab(tab)}
                >
                  {GROUP_LABELS[tab]}
                  <span class="badge">{tabBadgeCount(tab)}</span>
                </div>
              )}
            </For>
          </div>

          <div style={{ overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>申请编号</th>
                  <th>申请人</th>
                  <th>标题</th>
                  <th>金额</th>
                  <th>类型</th>
                  <th>创建时间</th>
                  <th>到期日</th>
                  <th>状态</th>
                  <th>到期预警</th>
                  <th>补正状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <Show when={loading()}>
                  <tr>
                    <td
                      colspan="11"
                      style={{ 'text-align': 'center', padding: '48px', color: '#999' }}
                    >
                      加载中...
                    </td>
                  </tr>
                </Show>
                <Show when={!loading() && filteredApplications().length === 0}>
                  <tr>
                    <td
                      colspan="11"
                      style={{ 'text-align': 'center', padding: '48px', color: '#999' }}
                    >
                      暂无数据
                    </td>
                  </tr>
                </Show>
                <For each={filteredApplications()}>
                  {(app) => (
                    <tr>
                      <td
                        style={{ color: '#1890ff', cursor: 'pointer' }}
                        onClick={() => navigate(`/applications/${app.id}`)}
                      >
                        {app.application_no}
                      </td>
                      <td>{app.applicant_name}</td>
                      <td style={{ maxWidth: '240px', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }} title={app.title}>
                        {app.title}
                      </td>
                      <td style={{ color: '#f5222d', 'font-weight': '500' }}>
                        ¥{app.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </td>
                      <td>{app.type}</td>
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
                        <WarningTag dueDate={app.due_date} isOverdue={app.is_overdue} />
                      </td>
                      <td>
                        {hasRectify(app) ? (
                          <span
                            class="tag"
                            style={{
                              background: '#fff7e6',
                              color: '#fa8c16',
                              border: '1px solid #ffd591',
                            }}
                          >
                            待补正
                          </span>
                        ) : (
                          <span
                            class="tag"
                            style={{
                              background: '#f6ffed',
                              color: '#52c41a',
                              border: '1px solid #b7eb8f',
                            }}
                          >
                            正常
                          </span>
                        )}
                      </td>
                      <td>
                        <a
                          style={{ color: '#1890ff', 'font-size': '14px', cursor: 'pointer' }}
                          onClick={() => navigate(`/applications/${app.id}`)}
                        >
                          办理
                        </a>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ApplicationsList;
