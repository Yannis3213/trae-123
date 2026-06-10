import { component$, useStore, useVisibleTask$, $, useTask$ } from '@builder.io/qwik';
import { useNavigate, useLocation } from '@builder.io/qwik-city';
import { AppLayout } from '~/components/app-layout';
import type { TourOrder, OrderStatus, UserRole, User, BatchProcessResult } from '~/types';
import { STATUS_LABELS, STATUS_BADGE, EVIDENCE_LABELS } from '~/types';
import { api, ApiError } from '~/utils/api';

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
    return new Date(s).toLocaleString('zh-CN', { hour12: false });
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
    deadline: '',
    as_draft: true,
    route_quote_evidence: false,
    registration_confirm_evidence: false,
    tour_audit_evidence: false,
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
      if (filters.overdue) params.overdue = filters.overdue;
      if (filters.search) params.search = filters.search;

      const result = await api.getOrders(params);
      state.orders = result.items;
      state.total = result.total;
    } catch (e: any) {
      const ae = e as ApiError;
      state.error = ae.error || '加载失败';
      if (ae.code === 'AUTH_ERROR') {
        localStorage.clear();
        location.href = '/login';
      }
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

  const resetForm = $((asDraft: boolean = true) => {
    Object.assign(form, {
      route_name: '', customer_name: '', customer_phone: '',
      traveler_count: 1, departure_date: '', return_date: '',
      quoted_price: 0, deadline: '', as_draft: asDraft,
      route_quote_evidence: false,
      registration_confirm_evidence: false,
      tour_audit_evidence: false,
    });
  });

  const createOrder = $(async () => {
    if (!form.route_name || !form.customer_name || !form.customer_phone ||
        !form.departure_date || !form.return_date) {
      state.error = '请填写必填字段（线路、客户信息、出发/返程日期）';
      return;
    }
    if (form.traveler_count < 1) {
      state.error = '出游人数必须≥1';
      return;
    }

    if (!form.as_draft && !form.route_quote_evidence) {
      state.error = '直接提交审核前必须先核验线路报价证据，请勾选对应选项或改为"保存草稿"';
      return;
    }

    try {
      const payload: Record<string, any> = {
        route_name: form.route_name,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        traveler_count: form.traveler_count,
        departure_date: new Date(form.departure_date + 'T10:00:00').toISOString(),
        return_date: new Date(form.return_date + 'T18:00:00').toISOString(),
        quoted_price: form.quoted_price,
        as_draft: form.as_draft,
      };
      if (form.deadline) payload.deadline = new Date(form.deadline + 'T18:00:00').toISOString();
      if (form.route_quote_evidence) payload.route_quote_evidence = true;
      if (form.registration_confirm_evidence) payload.registration_confirm_evidence = true;
      if (form.tour_audit_evidence) payload.tour_audit_evidence = true;

      await api.createOrder(payload);
      state.showCreateModal = false;
      resetForm();
      await loadOrders();
    } catch (e: any) {
      const ae = e as ApiError;
      state.error = ae.error || '创建失败';
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

  const evidenceHint = form.as_draft
    ? '草稿无需校验证据，可随时在详情页补充后提交审核。'
    : form.route_quote_evidence
      ? '已核验线路报价证据 ✔ 提交后将进入待审核队列。'
      : '提交审核前必须先核验线路报价证据（勾选线路报价单）。';

  return (
    <AppLayout>
      <div>
        <h2 style="margin: 0 0 16px 0; font-size: 20px;">{tabInfo.label}</h2>

        {state.error && <div class="alert alert-error">{state.error}</div>}

        {canCreate && (
          <div class="toolbar">
            <button class="btn btn-primary" onClick$={() => { resetForm(); state.showCreateModal = true; }}>
              + 新建旅游订单
            </button>
            <button class="btn btn-success" onClick$={() => { resetForm(false); state.showCreateModal = true; }}>
              ⚡ 快速登记（直接提交审核）
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
              <span class="batch-info">已选择 {state.selectedIds.size} 项（批量操作会逐条校验权限/版本/证据）</span>
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
                    <th>证据</th>
                    <th>状态</th>
                    <th>预警</th>
                    <th>责任人</th>
                    <th>版本</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {state.orders.map(order => {
                    const overdueState = isOverdue(order);
                    const evCount = [order.route_quote_evidence, order.registration_confirm_evidence, order.tour_audit_evidence].filter(Boolean).length;
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
                        <td>
                          <div class="evidence-cell" style="font-size: 12px;">
                            <span class={order.route_quote_evidence ? 'evidence-on' : 'evidence-off'}>报价</span>
                            <span class={order.registration_confirm_evidence ? 'evidence-on' : 'evidence-off'}>报名</span>
                            <span class={order.tour_audit_evidence ? 'evidence-on' : 'evidence-off'}>出团</span>
                            <span style="margin-left: 6px; color: var(--text-secondary);">{evCount}/3</span>
                          </div>
                        </td>
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
                        <td style="font-size: 12px; color: var(--text-secondary);">
                          {order.current_handler_name || (order.status === 'pending_audit' ? '审核组' :
                            order.status === 'pending_review' ? '复核组' : '—')}
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
            <div class="modal" style="max-width: 760px;">
              <div class="modal-header">
                <h3 class="modal-title">新建旅游订单（{form.as_draft ? '保存草稿模式' : '直接提交审核模式'}）</h3>
                <button class="btn btn-sm" onClick$={() => (state.showCreateModal = false)}>×</button>
              </div>
              <div class="modal-body">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">线路名称 *</label>
                    <input class="form-input" value={form.route_name} onInput$={(e: any) => (form.route_name = e.target.value)} placeholder="如：北京经典五日游" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">总报价 (元) *</label>
                    <input type="number" min="0" class="form-input" value={form.quoted_price} onInput$={(e: any) => (form.quoted_price = parseFloat(e.target.value) || 0)} />
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
                  <div class="form-group">
                    <label class="form-label">办理截止时间（可选）</label>
                    <input type="datetime-local" class="form-input" value={form.deadline} onInput$={(e: any) => (form.deadline = e.target.value)} />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">出发日期 *</label>
                    <input type="date" class="form-input" value={form.departure_date} onInput$={(e: any) => (form.departure_date = e.target.value)} />
                  </div>
                  <div class="form-group">
                    <label class="form-label">返程日期 *</label>
                    <input type="date" class="form-input" value={form.return_date} onInput$={(e: any) => (form.return_date = e.target.value)} />
                  </div>
                </div>

                <div class="card" style="border: 1px dashed #d1d5db; background: #fafafa; margin-top: 12px;">
                  <div class="card-header" style="background: transparent; padding: 8px 12px; border-bottom: 1px dashed #e5e7eb;">
                    <h3 class="card-title" style="font-size: 14px; margin: 0;">证据核验（登记时可勾选已收到的单据）</h3>
                  </div>
                  <div class="card-body" style="padding: 12px;">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                      {(Object.keys(EVIDENCE_LABELS) as Array<keyof typeof EVIDENCE_LABELS>).map((k) => {
                        const checked = k === 'route_quote' ? form.route_quote_evidence : k === 'registration_confirm' ? form.registration_confirm_evidence : form.tour_audit_evidence;
                        const onChange = (v: boolean) => {
                          if (k === 'route_quote') form.route_quote_evidence = v;
                          else if (k === 'registration_confirm') form.registration_confirm_evidence = v;
                          else form.tour_audit_evidence = v;
                        };
                        return (
                          <label key={k} class="evidence-row" style={checked ? { borderColor: 'var(--primary)', background: '#eef2ff' } : {}}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange$={(e: any) => onChange(e.target.checked)}
                            />
                            <div>
                              <div style="font-size: 13px; font-weight: 600;">{EVIDENCE_LABELS[k]}</div>
                              <div style="font-size: 11px; color: var(--text-secondary);">
                                {k === 'route_quote' ? '线路报价单已签字/盖章' : k === 'registration_confirm' ? '报名确认表及客户身份信息' : '出团通知书、行程单、导游确认'}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style="margin-top: 12px; padding: 10px 12px; border-radius: 6px; background: #eff6ff; font-size: 13px; color: #1d4ed8;">
                  <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <input
                      type="checkbox"
                      checked={form.as_draft}
                      onChange$={(e: any) => (form.as_draft = e.target.checked)}
                    />
                    <span style="font-weight: 600;">保存为草稿</span>
                  </label>
                  <div style="opacity: 0.9;">{evidenceHint}</div>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn" onClick$={() => (state.showCreateModal = false)}>取消</button>
                <button class="btn btn-primary" onClick$={createOrder}>
                  {form.as_draft ? '💾 保存草稿' : '📤 创建并提交审核'}
                </button>
              </div>
            </div>
          </div>
        )}

        {state.showBatchResult && (
          <div class="modal-overlay" onClick$={e => { if ((e.target as HTMLElement).className === 'modal-overlay') state.showBatchResult = false; }}>
            <div class="modal" style="max-width: 960px;">
              <div class="modal-header">
                <h3 class="modal-title">批量处理结果（逐条校验 · 共 {state.batchResults.length} 条）</h3>
                <button class="btn btn-sm" onClick$={() => (state.showBatchResult = false)}>×</button>
              </div>
              <div class="modal-body">
                <div style="margin-bottom: 12px; font-size: 13px; color: var(--text-secondary); display: flex; gap: 20px; flex-wrap: wrap;">
                  <span>✓ 成功: <b style="color:#16a34a;">{state.batchResults.filter(r => r.success).length}</b></span>
                  <span>✗ 失败: <b style="color:#dc2626;">{state.batchResults.filter(r => !r.success).length}</b></span>
                  <span>📝 留痕成功: <b>{state.batchResults.filter(r => r.trace_saved === true).length}</b></span>
                </div>
                <div style="max-height: 520px; overflow-y: auto;">
                  {state.batchResults.map(r => {
                    const oldStatusLabel: string = r.old_status
                      ? (STATUS_LABELS[r.old_status as OrderStatus] || r.old_status)
                      : '未知状态';
                    const newStatusLabel: string = r.new_status
                      ? (STATUS_LABELS[r.new_status as OrderStatus] || r.new_status)
                      : '';
                    const statusChange = (r.old_status && r.new_status) ? (
                      <span style="font-size: 12px; color: #0f766e; font-weight: 500;">
                        {oldStatusLabel} → {newStatusLabel}
                      </span>
                    ) : r.old_status ? (
                      <span style="font-size: 12px; color: #7f1d1d; font-weight: 500;">
                        状态未变更（{oldStatusLabel}）
                      </span>
                    ) : (
                      <span style="font-size: 12px; color: #6b7280; font-weight: 500;">
                        状态未知（订单不存在或ID无效）
                      </span>
                    );
                    const versionTag = (r.old_version != null && r.new_version != null) ? (
                      <span style="font-size: 12px; color: #1d4ed8; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: #eff6ff;">
                        v{r.old_version} → v{r.new_version}
                      </span>
                    ) : r.old_version != null ? (
                      <span style="font-size: 12px; color: #6b7280; padding: 1px 6px; border-radius: 4px; background: #f3f4f6;">
                        当前 v{r.old_version}
                      </span>
                    ) : (
                      <span style="font-size: 12px; color: #9ca3af; padding: 1px 6px; border-radius: 4px; background: #f9fafb;">
                        版本：—
                      </span>
                    );
                    const handlerTag = r.new_handler_name ? (
                      <span style="font-size: 12px; color: #92400e; font-weight: 500; padding: 1px 6px; border-radius: 4px; background: #fef3c7;">
                        责任人→{r.new_handler_name}
                      </span>
                    ) : r.old_handler_name ? (
                      <span style="font-size: 12px; color: #4b5563; padding: 1px 6px; border-radius: 4px; background: #f3f4f6;">
                        责任人：{r.old_handler_name}
                      </span>
                    ) : (
                      <span style="font-size: 12px; color: #9ca3af; padding: 1px 6px; border-radius: 4px; background: #f9fafb;">
                        责任人：—
                      </span>
                    );
                    const traceSaved = r.trace_saved != null ? r.trace_saved : false;
                    const traceTag = traceSaved ? (
                      <span style="font-size: 12px; color: #166534; font-weight: 500; padding: 1px 6px; border-radius: 4px; background: #dcfce7;">
                        📝 留痕已写
                      </span>
                    ) : (
                      <span style="font-size: 12px; color: #7c2d12; font-weight: 500; padding: 1px 6px; border-radius: 4px; background: #ffedd5;">
                        📝 留痕失败
                      </span>
                    );
                    return (
                      <div
                        key={r.order_id}
                        class={`batch-result-item ${r.success ? 'batch-success' : 'batch-fail'}`}
                        style={{ marginBottom: '8px', padding: '12px 14px', borderRadius: '8px', border: r.success ? '1px solid #86efac' : '1px solid #fca5a5', background: r.success ? '#f0fdf4' : '#fef2f2' }}
                      >
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
                          <div style="flex: 1; min-width: 320px;">
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                              <span style={{
                                padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                                background: r.success ? '#16a34a' : '#dc2626', color: '#fff'
                              }}>{r.success ? '✓ 成功' : '✗ 失败'}</span>
                              <span style="font-family: monospace; font-weight: 700; font-size: 14px; color: #1f2937;">{r.order_no}</span>
                              {r.code !== 'OK' && <span style="font-size: 12px; padding: 2px 8px; border-radius: 4px; background: #fee2e2; color: #991b1b; font-weight: 600;">错误码: {r.code}</span>}
                              {r.code === 'OK' && <span style="font-size: 12px; padding: 2px 8px; border-radius: 4px; background: #dcfce7; color: #166534; font-weight: 600;">code: OK</span>}
                            </div>
                            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px;">
                              {statusChange}
                              {versionTag}
                              {handlerTag}
                              {traceTag}
                            </div>
                            <div style="font-size: 13px; line-height: 1.7; color: #1f2937;">{r.message}</div>
                          </div>
                          <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-end;">
                            {r.success && (
                              <button
                                class="btn btn-primary btn-sm"
                                onClick$={() => { state.showBatchResult = false; nav(`/orders/${r.order_id}`); }}
                              >→ 查看详情</button>
                            )}
                            <div style="font-size: 11px; color: #9ca3af; font-family: monospace;">{r.order_id.substring(0, 12)}…</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div class="modal-footer" style="display: flex; justify-content: space-between; gap: 8px;">
                <div style="font-size: 12px; color: var(--text-secondary);">
                  💡 列表已自动刷新；如有失败订单，可点击「查看详情」进入单独办理。
                </div>
                <div style="display: flex; gap: 8px;">
                  <button class="btn" onClick$={() => (state.showBatchResult = false)}>关闭</button>
                  {state.batchResults.some(r => r.success) && (
                    <button
                      class="btn btn-primary"
                      onClick$={() => {
                        const firstSuccess = state.batchResults.find(r => r.success)!;
                        state.showBatchResult = false;
                        nav(`/orders/${firstSuccess.order_id}`);
                      }}
                    >查看首个成功订单</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
});
