import { component$, useStore, useVisibleTask$, $ } from '@builder.io/qwik';
import { AppLayout } from '~/components/app-layout';
import type { DashboardStats, User } from '~/types';
import { api } from '~/utils/api';
import { useNavigate } from '@builder.io/qwik-city';

const StatCard = ({ label, value, variant }: { label: string; value: number; variant: 'primary' | 'normal' | 'warning' | 'danger' }) => (
  <div class="stat-card">
    <div class="stat-label">{label}</div>
    <div class={`stat-value stat-${variant}`}>{value}</div>
  </div>
);

export default component$(() => {
  const nav = useNavigate();
  const state = useStore<{
    stats: DashboardStats | null;
    user: User | null;
    loading: boolean;
  }>({ stats: null, user: null, loading: true });

  useVisibleTask$(async () => {
    state.user = api.getCurrentUser();
    try {
      state.stats = await api.getDashboardStats();
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

  return (
    <AppLayout>
      <div>
        <h2 style="margin: 0 0 20px 0; font-size: 20px;">工作台统计</h2>

        {state.loading ? (
          <div>加载中...</div>
        ) : state.stats ? (
          <>
            <div class="stats-grid">
              <StatCard label="正常处理中" value={state.stats.normal_count} variant="normal" />
              <StatCard label="临期预警" value={state.stats.warning_count} variant="warning" />
              <StatCard label="已逾期" value={state.stats.overdue_count} variant="danger" />
              {state.user?.role === 'registrar' && (
                <StatCard label="草稿" value={state.stats.draft_count} variant="primary" />
              )}
              {state.user?.role === 'registrar' && (
                <StatCard label="待补正" value={state.stats.pending_correction_count} variant="warning" />
              )}
              {state.user?.role === 'auditor' && (
                <StatCard label="待审核" value={state.stats.pending_audit_count} variant="primary" />
              )}
              {state.user?.role === 'auditor' && (
                <StatCard label="待补正(已退回)" value={state.stats.pending_correction_count} variant="warning" />
              )}
              {state.user?.role === 'reviewer' && (
                <StatCard label="待复核" value={state.stats.pending_review_count} variant="primary" />
              )}
              {state.user?.role === 'reviewer' && (
                <StatCard label="已归档" value={state.stats.archived_count} variant="normal" />
              )}
            </div>

            <div class="card">
              <div class="card-header">
                <h3 class="card-title">快捷操作</h3>
              </div>
              <div class="card-body">
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                  {state.user && (
                    (function renderActions() {
                      const actions = getQuickActions(state.user as User);
                      return (
                        <>
                          {(actions as any[]).map((a: any) => (
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
                    })()
                  )}
                </div>
              </div>
            </div>

            <div class="card" style="margin-top: 20px;">
              <div class="card-header">
                <h3 class="card-title">到期预警队列</h3>
              </div>
              <div class="card-body">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                  <div style="padding: 16px; background: #f0fdf4; border-radius: 8px;">
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;">正常</div>
                    <div style="font-size: 28px; font-weight: 700; color: var(--success);">{state.stats.normal_count}</div>
                  </div>
                  <div style="padding: 16px; background: #fff7ed; border-radius: 8px;">
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;">临期 (1天内到期)</div>
                    <div style="font-size: 28px; font-weight: 700; color: var(--warning);">{state.stats.warning_count}</div>
                  </div>
                  <div style="padding: 16px; background: #fef2f2; border-radius: 8px;">
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;">已逾期</div>
                    <div style="font-size: 28px; font-weight: 700; color: var(--danger);">{state.stats.overdue_count}</div>
                  </div>
                </div>
                <div style="margin-top: 16px; font-size: 13px; color: var(--text-secondary);">
                  * 节点超时按责任人计算，逾期订单将继续留在待处理列表直至处理完成
                </div>
              </div>
            </div>
          </>
        ) : (
          <div>加载失败</div>
        )}
      </div>
    </AppLayout>
  );
});
