import { component$, useStore, useVisibleTask$, $, useTask$ } from '@builder.io/qwik';
import { useNavigate, useLocation } from '@builder.io/qwik-city';
import { AppLayout } from '~/components/app-layout';
import type { TourOrder, OrderStatus, UserRole, User, BatchProcessResult } from '~/types';
import { STATUS_LABELS, STATUS_BADGE } from '~/types';
import { api } from '~/utils/api';

interface FilterState {
  status: string;
  overdue: string;
  search: string;
}

const getTabFilters = (tab: string, role: UserRole) => {
  if (tab === 'audit') {
    return { label: '过程核验', statuses: ['pending_audit', 'pending_correction'] };
  }
  if (tab === 'review') {
    return { label: '复核归档', statuses: ['pending_review', 'archived'] };
  }
  return { label: '旅游订单登记', statuses: role === 'registrar' ? ['draft', 'pending_correction'] : ['pending_audit', 'pending_review'] };
};

const getAvailableStatuses = (role: UserRole, tab: string): { value: string; label: string }[] => {
  if (tab === 'audit') {
    return [
      { value: 'pending_audit', label: '待审核' },
      { value: 'pending_correction', label: '待补正' },
    ];
  }
  if (tab === 'review') {
    return [
      { value: 'pending_review', label: '待复核' },
      { value: 'archived', label: '已归档' },
    ];
  }
  if (role === 'registrar') {
    return [
      { value: 'draft', label: '草稿' },
      { value: 'pending_correction', label: '待补正' },
    ];
  }
  return [
    { value: 'pending_audit', label: '待审核' },
    { value: 'pending_correction', label: '待补正' },
    { value: 'pending_review', label: '待复核' },
    { value: 'archived', label: '已归档' },
  ];
};

const getBatchActions = (role: UserRole, status: string): { target: string; label: string; btnClass: string }[] => {
  const actions: { target: string; label: string; btnClass: string }[] = [];
  if (role === 'registrar') {
    if (status === 'draft' || status === '') {
      actions.push({ target: 'pending_audit', label: '提交审核', btnClass: 'btn-primary' });
    }
    if (status === 'pending_correction' || status === '') {
      actions.push({ target: 'pending_audit', label: '补正后提交', btnClass: 'btn-success' });
    }
  }
  if (role === 'auditor') {
    if (status === 'pending_audit' || status === '') {
      actions.push({ target: 'pending_review', label: '审核通过', btnClass: 'btn-success' });
      actions.push({ target: 'pending_correction', label: '退回补正', btnClass: 'btn-warning' });
    }
  }
  if (role === 'reviewer') {
    if (status === 'pending_review' || status === '') {
      actions.push({ target: 'archived', label: '复核归档', btnClass: 'btn-success' });
      actions.push({ target: 'pending_correction', label: '退回补正', btnClass: 'btn-warning' });
    }
  }
  return actions;
};

const fmtDate = (s: string) => {
  try {
    return new Date(s).toLocaleString('zh-CN');
  } catch { return s; }
};

export default component$(() => {
  const nav = useNavigate();
  const location = useLocation();
  const tab = location.url.searchParams.get('tab') || '';

  const state = useStore<{
    user: User | null;
    orders: TourOrder[];
    total: number;
    page: number;
    pageSize: number;
    loading: boolean;
    error: string | null;
    showCreateModal: boolean;
    showBatchResult: boolean;
    batchResults: BatchProcessResult[];
    selectedIds: Set<string>;
  }>({
    user: null,
    orders: [],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: true,
    error: null,
    showCreateModal: false,
    showBatchResult: false,
    batchResults: [],
    selectedIds: new Set(),
  });

  const filters = useStore<FilterState>({
    status: location.url.searchParams.get('status') || '',
    overdue: '',
    search: '',
  });

  const form = useStore({
    route_name: '',
    customer_name: '',
    customer_phone: '',
    traveler_count: 1,
    departure_date: '',
    return_date: '',
    quoted_price: 0,
    as_draft: true,
  });

  useVisibleTask$(() => {
    state.user = api.getCurrentUser();
  });

  const loadOrders = $(async () => {
    if (!state.user) return;
    state.loading = true;
    state.error = null;
    try {
      const params: Record<string, any> = {
        page: state.page,
        page_size: state.pageSize,
      };
      if (filters.status) params.status = filters.status;
      if (filters.overdue) params.overdue = filters.overdue === '1';
      if (filters.search) params.search = filters.search;

      const result = await api.getOrders(params);
      state.orders = result.items;
      state.total = result.total;
    } catch (e: any) {
      state.error = e?.error || '加载失败';
    } finally {
      state.loading = false;
    }
  });

  useTask$(({ track }) => {
    track(() => state.user);
    if (state.user) loadOrders();
  });

  const toggleSelect = $((id: string) => {
    if (state.selectedIds.has(id)) {
      state.selectedIds.delete(id);
    } else {
      state.selectedIds.add(id);
    }
    state.selectedIds = new Set(state.selectedIds);
  });

  const toggleSelectAll = $(() => {
    if (state.selectedIds.size === state.orders.length && state.orders.length > 0) {
      state.selectedIds = new Set();
    } else {
      state.selectedIds = new Set(state.orders.map(o => o.id));
    }
  });

  const doBatch = $(async (target: string) => {
    if (state.selectedIds.size === 0) return;
    const versionMap: Record<string, number> = {};
    state.orders.forEach(o => {
      if (state.selectedIds.has(o.id)) versionMap[o.id] = o.version;
    });
    try {
      const results = await api.batchProcess({
        order_ids: Array.from(state.selectedIds),
        target_status: target,
        version_map: versionMap,
      });
      state.batchResults = results;
      state.showBatchResult = true;
      state.selectedIds = new Set();
      await loadOrders();
    } catch (e: any) {
      state.error = e?.error || '批量处理失败';
    }
  });

  const createOrder = $(async () => {
    if (!form.route_name || !form.customer_name || !form.customer_phone) {
      state.error = '请填写必填字段';
      return;
    }
    try {
      await api.createOrder({
        route_name: form.route_name,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        traveler_count: form.traveler_count,
        departure_date: new Date(form.departure_date).toISOString(),
        return_date: new Date(form.return_date).toISOString(),
        quoted_price: form.quoted_price,
        as_draft: form.as_draft,
      });
      state.showCreateModal = false;
      Object.assign(form, {
        route_name: '', customer_name: '', customer_phone: '',
        traveler_count: 1, departure_date: '', return_date: '',
        quoted_price: 0, as_draft: true,
      });
      await loadOrders();
    } catch (e: any) {
      state.error = e?.error || '创建失败';
    }
  });

  if (!state.user) return <AppLayout><div>加载中...</div></AppLayout>;

  const tabInfo = getTabFilters(tab, state.user.role);
  const availableStatuses = getAvailableStatuses(state.user.role, tab);
  const batchActions = getBatchActions(state.user.role, filters.status);
  const canCreate = state.user.role === 'registrar' && tab !== 'audit' && tab !== 'review';

  const isOverdue = (o: TourOrder) => {
    if (o.is_overdue) return 'overdue';
    if (o.deadline) {
      const d = new Date(o.deadline).getTime();
      const now = Date.now();
      if (d - now < 24 * 3600 * 1000 && d > now) return 'warning';
    }
    return 'normal';
  };

  return (
    <AppLayout>
      <div>
        <h2 style="margin: 0 0 16px 0; font-size: 20px;">{tabInfo.label}</h2>

        {state.error && <div class="alert alert-error">{state.error}</div>}

        {canCreate && (
          <div class="toolbar">
            <button class="btn btn-primary" onClick$={() => (state.showCreateModal = true)}>
              + 新建旅游订单
            </button>
          </div>
        )}

        <div class="card">
          <div class="filter-bar">
            <div class="filter-item">
              <label class="form-label">状态</label>
              <select
                class="form-select"
                value={filters.status}
                onChange$={(e: any) => { filters.status = e.target.value; state.page = 1; loadOrders(); }}
              >
                <option value="">全部</option>
                {availableStatuses.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div class="filter-item">
              <label class="form-label">预警状态</label>
              <select
                class="form-select"
                value={filters.overdue}
                onChange$={(e: any) => { filters.overdue = e.target.value; state.page = 1; loadOrders(); }}
              >
                <option value="">全部</option>
                <option value="1">已逾期</option>
                <option value="0">未逾期</option>
              </select>
            </div>
            <div class="filter-item" style="flex: 1; min-width: 200px;">
              <label class="form-label">搜索</label>
              <input
                class="form-input"
                placeholder="订单号 / 线路 / 客户名"
                value={filters.search}
                onInput$={(e: any) => (filters.search = e.target.value)}
                onKeyUp$={(e: any) => { if (e.key === 'Enter') { state.page = 1; loadOrders(); } }}
              />
            </div>
            <div class="filter-actions">
              <button class="btn" onClick$={() => { state.page = 1; loadOrders(); }}>查询</button>
              <button class="btn" onClick$={() => {
                filters.status = ''; filters.overdue = ''; filters.search = ''; state.page = 1; loadOrders();
              }}>重置</button>
            </div>
          </div>

          {state.selectedIds.size > 0 && batchActions.length > 0 && (
            <div class="batch-toolbar">
              <span class="batch-info">已选择 {state.selectedIds.size} 项</span>
              {batchActions.map(act => (
                <button
                  key={act.target}
                  class={`btn ${act.btnClass} btn-sm`}
                  onClick$={() => doBatch(act.target)}
                >
                  批量{act.label}
                </button>
              ))}
              <button class="btn btn-sm" onClick$={() => (state.selectedIds = new Set())}>取消选择</button>
            </div>
          )}

          {state.loading ? (
            <div class="empty-state">加载中...</div>
          ) : state.orders.length === 0 ? (
            <div class="empty-state">暂无数据</div>
          ) : (
            <>
              <table class="table">
                <thead>
                  <tr>
                    <th style="width: 40px;">
                      <input
                        type="checkbox"
                        class="checkbox"
                        checked={state.selectedIds.size === state.orders.length && state.orders.length > 0}
                        onChange$={toggleSelectAll}
                      />
                    </th>
                    <th>订单号</th>
                    <th>线路名称</th>
                    <th>客户</th>
                    <th>人数</th>
                    <th>报价</th>
                    <th>出发日期</th>
                    <th>状态</th>
                    <th>预警</th>
                    <th>版本</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {state.orders.map(order => {
                    const overdueState = isOverdue(order);
                    return (
                      <tr key={order.id}>
                        <td>
                          <input
                            type="checkbox"
                            class="checkbox"
                            checked={state.selectedIds.has(order.id)}
                            onChange$={() => toggleSelect(order.id)}
                          />
                        </td>
                        <td style="font-family: monospace;">{order.order_no}</td>
                        <td>{order.route_name}</td>
                        <td>{order.customer_name} ({order.customer_phone})</td>
                        <td>{order.traveler_count}</td>
                        <td>¥{order.quoted_price.toLocaleString()}</td>
                        <td>{fmtDate(order.departure_date)}</td>
                        <td>
                          <span class={`badge ${STATUS_BADGE[order.status as OrderStatus]}`}>
                            {STATUS_LABELS[order.status as OrderStatus]}
                          </span>
                        </td>
                        <td>
                          {overdueState === 'overdue' && <span class="badge badge-overdue">逾期</span>}
                          {overdueState === 'warning' && <span class="badge badge-warning">临期</span>}
                          {overdueState === 'normal' && <span class="badge badge-normal">正常</span>}
                        </td>
                        <td>v{order.version}</td>
                        <td>{fmtDate(order.updated_at)}</td>
                        <td>
                          <button
                            class="btn btn-primary btn-sm"
                            onClick$={() => nav(`/orders/${order.id}`)}
                          >
                            查看办理
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div class="pagination">
                <span class="pagination-info">
                  共 {state.total} 条，第 {state.page} 页 / 共 {Math.ceil(state.total / state.pageSize) || 1} 页
                </span>
                <button
                  class="btn btn-sm"
                  disabled={state.page <= 1}
                  onClick$={() => { state.page--; loadOrders(); }}
                >
                  上一页
                </button>
                <button
                  class="btn btn-sm"
                  disabled={state.page >= Math.ceil(state.total / state.pageSize)}
                  onClick$={() => { state.page++; loadOrders(); }}
                >
                  下一页
                </button>
              </div>
            </>
          )}
        </div>

        {state.showCreateModal && (
          <div class="modal-overlay" onClick$={e => { if ((e.target as HTMLElement).className === 'modal-overlay') state.showCreateModal = false; }}>
            <div class="modal">
              <div class="modal-header">
                <h3 class="modal-title">新建旅游订单</h3>
                <button class="btn btn-sm" onClick$={() => (state.showCreateModal = false)}>×</button>
              </div>
              <div class="modal-body">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">线路名称 *</label>
                    <input class="form-input" value={form.route_name} onInput$={(e: any) => (form.route_name = e.target.value)} placeholder="如：北京五日游" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">报价 (元) *</label>
                    <input type="number" class="form-input" value={form.quoted_price} onInput$={(e: any) => (form.quoted_price = parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">客户姓名 *</label>
                    <input class="form-input" value={form.customer_name} onInput$={(e: any) => (form.customer_name = e.target.value)} />
                  </div>
                  <div class="form-group">
                    <label class="form-label">联系电话 *</label>
                    <input class="form-input" value={form.customer_phone} onInput$={(e: any) => (form.customer_phone = e.target.value)} />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">出游人数</label>
                    <input type="number" min="1" class="form-input" value={form.traveler_count} onInput$={(e: any) => (form.traveler_count = parseInt(e.target.value) || 1)} />
                  </div>
                  <div class="form-group"></div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">出发日期</label>
                    <input type="date" class="form-input" value={form.departure_date} onInput$={(e: any) => (form.departure_date = e.target.value)} />
                  </div>
                  <div class="form-group">
                    <label class="form-label">返程日期</label>
                    <input type="date" class="form-input" value={form.return_date} onInput$={(e: any) => (form.return_date = e.target.value)} />
                  </div>
                </div>
                <div class="form-group">
                  <label style="display: flex; align-items: center; gap: 8px;">
                    <input
                      type="checkbox"
                      checked={form.as_draft}
                      onChange$={(e: any) => (form.as_draft = e.target.checked)}
                    />
                    <span>保存为草稿（不勾选将直接提交审核）</span>
                  </label>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn" onClick$={() => (state.showCreateModal = false)}>取消</button>
                <button class="btn btn-primary" onClick$={createOrder}>
                  {form.as_draft ? '保存草稿' : '创建并提交'}
                </button>
              </div>
            </div>
          </div>
        )}

        {state.showBatchResult && (
          <div class="modal-overlay" onClick$={e => { if ((e.target as HTMLElement).className === 'modal-overlay') state.showBatchResult = false; }}>
            <div class="modal">
              <div class="modal-header">
                <h3 class="modal-title">批量处理结果</h3>
                <button class="btn btn-sm" onClick$={() => (state.showBatchResult = false)}>×</button>
              </div>
              <div class="modal-body">
                {state.batchResults.map(r => (
                  <div key={r.order_id} class={`batch-result-item ${r.success ? 'batch-success' : 'batch-fail'}`}>
                    <strong>{r.success ? '成功' : '失败'}</strong> - {r.order_id.substring(0, 8)}...
                    <div style="margin-top: 4px; font-size: 12px;">{r.message}</div>
                  </div>
                ))}
              </div>
              <div class="modal-footer">
                <button class="btn btn-primary" onClick$={() => (state.showBatchResult = false)}>确定</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
});
