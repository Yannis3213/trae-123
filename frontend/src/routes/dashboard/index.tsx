import { component$, useStore, useVisibleTask$, $ } from '@builder.io/qwik';
import { AppLayout } from '~/components/app-layout';
import type { DashboardStats, User, TourOrder } from '~/types';
import { api, ApiError } from '~/utils/api';
import { useNavigate } from '@builder.io/qwik-city';
import { STATUS_LABELS, STATUS_BADGE } from '~/types';

const StatCard = ({ label, value, variant, onClick }: { label: string; value: number; variant: 'primary' | 'normal' | 'warning' | 'danger'; onClick?: () => void }) => (
  <div class="stat-card" style={onClick ? 'cursor: pointer;' : ''} onClick$={onClick}>
    <div class="stat-label">{label}</div>
    <div class={`stat-value stat-${variant}`}>{value}</div>
  </div>
);

const OrderCard = ({ order, overdue }: { order: TourOrder; overdue: boolean }) => {
  const nav = useNavigate();
  return (
    <div
      class={`queue-row ${overdue ? 'danger' : 'normal'}`}
      onClick$={() => nav(`/orders/${order.id}`)}
      style={{
        padding: '10px 12px',
        borderRadius: '6px',
        border: overdue ? '1px solid #fecaca' : '1px solid #bbf7d0',
        background: overdue ? '#fef2f2' : '#f0fdf4',
        marginBottom: '8px',
        cursor: 'pointer',
      }}
    >
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
        <div>
          <div style="font-weight: 600; font-size: 14px;">{order.order_no}</div>
          <div style="font-size: 13px; color: var(--text-secondary);">{order.route_name}</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
            客户: {order.customer_name} · {order.traveler_count}人
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
          <span class={`badge ${STATUS_BADGE[order.status]}`}>{STATUS_LABELS[order.status]}</span>
          {order.deadline && (
            <div style="font-size: 12px; color: var(--text-secondary);">
              截止: {new Date(order.deadline).toLocaleString('zh-CN', { hour12: false })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default component$(() => {
  const nav = useNavigate();
  const state = useStore<{
    stats: DashboardStats | null;
    user: User | null;
    loading: boolean;
    errMsg: string | null;
  }>({ stats: null, user: null, loading: true, errMsg: null });

  useVisibleTask$(async () => {
    state.user = api.getCurrentUser();
    try {
      state.stats = await api.getDashboardStats();
    } catch (e) {
      const ae = e as ApiError;
      state.errMsg = ae.error || '加载统计失败';
      if (ae.code === 'AUTH_ERROR') {
        localStorage.clear();
        location.href = '/login';
      }
    } finally {
      state.loading = false;
    }
  });

  const getQuickActions = $((user: User) => {
    const actions: { label: string; path: string; type: string }[] = [];
    if (user.role === 'registrar') {
      actions.push({ label: '+ 新建旅游订单', path: '/orders', type: 'btn-primary' });
      actions.push({ label: '查看待补正', path: '/orders?status=pending_correction', type: 'btn' });
    }
    if (user.role === 'auditor') {
      actions.push({ label: '办理待审核', path: '/orders?tab=audit&status=pending_audit', type: 'btn-primary' });
      actions.push({ label: '查看退回补正', path: '/orders?tab=audit&status=pending_correction', type: 'btn' });
    }
    if (user.role === 'reviewer') {
      actions.push({ label: '复核归档', path: '/orders?tab=review&status=pending_review', type: 'btn-primary' });
      actions.push({ label: '查看已归档', path: '/orders?tab=review&status=archived', type: 'btn' });
    }
    return actions;
  });

  const getStatCards = (user: User, stats: DashboardStats) => {
    const cards: { label: string; value: number; variant: 'primary' | 'normal' | 'warning' | 'danger'; path?: string }[] = [];
    cards.push({ label: '我待处理', value: stats.total_mine, variant: 'primary', path: '/orders' });
    if (user.role === 'registrar') {
      cards.push({ label: '待补正', value: stats.correction, variant: 'warning', path: '/orders?status=pending_correction' });
    }
    if (user.role === 'auditor') {
      cards.push({ label: '待审核', value: stats.to_audit, variant: 'primary', path: '/orders?tab=audit&status=pending_audit' });
      cards.push({ label: '已退回补正', value: stats.correction, variant: 'warning', path: '/orders?tab=audit&status=pending_correction' });
    }
    if (user.role === 'reviewer') {
      cards.push({ label: '待复核', value: stats.to_review, variant: 'primary', path: '/orders?tab=review&status=pending_review' });
      cards.push({ label: '已归档', value: stats.archived, variant: 'normal', path: '/orders?tab=review&status=archived' });
    }
    cards.push({ label: '已逾期', value: stats.overdue, variant: 'danger' });
    return cards;
  };

  const warningCount = (stats: DashboardStats) => {
    const now = Date.now();
    return [...stats.normal_queue, ...stats.overdue_queue].filter(o => {
      if (o.is_overdue) return false;
      if (!o.deadline) return false;
      const t = new Date(o.deadline).getTime() - now;
      return t > 0 && t <= 24 * 3600 * 1000;
    }).length;
  };

  return (
    <AppLayout>
      <div>
        <h2 style="margin: 0 0 20px 0; font-size: 20px;">工作台统计</h2>

        {state.loading ? (
          <div>加载中...</div>
        ) : state.errMsg ? (
          <div class="alert danger">错误: {state.errMsg}</div>
        ) : state.stats && state.user ? (
          <>
            <div class="stats-grid">
              {getStatCards(state.user as User, state.stats).map(c => (
                <StatCard
                  key={c.label}
                  label={c.label}
                  value={c.value}
                  variant={c.variant}
                  onClick={c.path ? () => nav(c.path!) : undefined}
                />
              ))}
            </div>

            <div class="card" style="margin-top: 16px;">
              <div class="card-header">
                <h3 class="card-title">快捷操作</h3>
              </div>
              <div class="card-body">
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                  {(function renderActions() {
                    const actions = getQuickActions(state.user as User);
                    return (
                      <>
                        {actions.map(a => (
                          <button
                            key={a.label}
                            class={`btn ${a.type}`}
                            onClick$={() => nav(a.path)}
                          >
                            {a.label}
                          </button>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div class="card" style="margin-top: 16px;">
              <div class="card-header">
                <h3 class="card-title">到期预警队列（按截止时间排序）</h3>
              </div>
              <div class="card-body">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 12px;">
                  <div style="padding: 16px; background: #f0fdf4; border-radius: 8px;">
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;">正常</div>
                    <div style="font-size: 28px; font-weight: 700; color: var(--success);">{state.stats.normal_queue.length}</div>
                  </div>
                  <div style="padding: 16px; background: #fff7ed; border-radius: 8px;">
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;">临期（1天内）</div>
                    <div style="font-size: 28px; font-weight: 700; color: var(--warning);">{warningCount(state.stats)}</div>
                  </div>
                  <div style="padding: 16px; background: #fef2f2; border-radius: 8px;">
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;">已逾期</div>
                    <div style="font-size: 28px; font-weight: 700; color: var(--danger);">{state.stats.overdue_queue.length}</div>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                  <div>
                    <div class="section-title" style="color: var(--success); margin-bottom: 8px;">● 正常 / 临期队列</div>
                    {state.stats.normal_queue.length === 0 ? (
                      <div style="padding: 16px; border: 1px dashed #d1d5db; border-radius: 6px; text-align: center; color: var(--text-secondary); font-size: 13px;">暂无</div>
                    ) : (
                      state.stats.normal_queue.map(o => <OrderCard key={o.id} order={o} overdue={false} />)
                    )}
                  </div>
                  <div>
                    <div class="section-title" style="color: var(--danger); margin-bottom: 8px;">● 已逾期队列</div>
                    {state.stats.overdue_queue.length === 0 ? (
                      <div style="padding: 16px; border: 1px dashed #d1d5db; border-radius: 6px; text-align: center; color: var(--text-secondary); font-size: 13px;">暂无</div>
                    ) : (
                      state.stats.overdue_queue.map(o => <OrderCard key={o.id} order={o} overdue={true} />)
                    )}
                  </div>
                </div>

                <div style="margin-top: 16px; font-size: 13px; color: var(--text-secondary); line-height: 1.8;">
                  * 节点超时按「当前处理责任人」计算。逾期订单禁止直接批量推进，需先更新截止日期并补正材料后再行提交。
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
});
