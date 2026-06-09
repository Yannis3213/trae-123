import { createSignal, createEffect, For, Show } from 'solid-js';
import type { PlanStatus, DueStatus, StatisticsData } from '@/types';
import { PlanStatusLabel, DueStatusLabel } from '@/types';
import { getStatistics } from '@/api';
import { useToast } from '@/utils';

const statusColorMap: Record<PlanStatus, string> = {
  pending_confirm: '#1890ff',
  confirmed: '#52c41a',
  exception: '#ff4d4f',
  pending_review: '#faad14',
  reviewed: '#1890ff',
  archived: '#8c8c8c',
};

const dueStatusColorMap: Record<DueStatus, string> = {
  normal: '#52c41a',
  approaching: '#faad14',
  overdue: '#ff4d4f',
};

export default function Statistics() {
  const { toast, show } = useToast();
  const [data, setData] = createSignal<StatisticsData | null>(null);
  const [loading, setLoading] = createSignal(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getStatistics();
      setData(res.data);
    } catch (err: any) {
      show('error', err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    fetchData();
  });

  const totalStatusCount = () => {
    const d = data();
    if (!d) return 0;
    return Object.values(d.statusCounts).reduce((s, n) => s + n, 0);
  };

  const totalDueCount = () => {
    const d = data();
    if (!d) return 0;
    return Object.values(d.dueStatusCounts).reduce((s, n) => s + n, 0);
  };

  const maxStatusCount = () => {
    const d = data();
    if (!d) return 1;
    return Math.max(1, ...Object.values(d.statusCounts));
  };

  const maxDueCount = () => {
    const d = data();
    if (!d) return 1;
    return Math.max(1, ...Object.values(d.dueStatusCounts));
  };

  return (
    <div>
      <div class="card">
        <div class="card-title" style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
          <span>统计概览</span>
          <button class="btn btn-sm" onClick={fetchData}>
            刷新
          </button>
        </div>

        <Show when={loading()}>
          <div class="empty">加载中...</div>
        </Show>

        <Show when={!loading() && data()}>
          <div style={{ 'margin-bottom': '24px' }}>
            <div style={{ 'font-size': '15px', 'font-weight': 600, 'margin-bottom': '12px' }}>
              各状态数量统计（共 {totalStatusCount()} 条）
            </div>
            <div class="stat-cards">
              <For each={Object.entries(data()!.statusCounts) as Array<[PlanStatus, number]>}>
                {([status, count]) => (
                  <div class="stat-card">
                    <div class="stat-card-label">{PlanStatusLabel[status]}</div>
                    <div class="stat-card-value" style={{ color: statusColorMap[status] }}>
                      {count}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          <div style={{ 'margin-bottom': '24px' }}>
            <div style={{ 'font-size': '15px', 'font-weight': 600, 'margin-bottom': '12px' }}>
              各状态柱状图
            </div>
            <div class="chart-container">
              <For each={Object.entries(data()!.statusCounts) as Array<[PlanStatus, number]>}>
                {([status, count]) => (
                  <div class="bar-chart-item">
                    <div class="bar-chart-value">{count}</div>
                    <div
                      class="bar-chart-bar"
                      style={{
                        height: `${(count / maxStatusCount()) * 150}px`,
                        background: statusColorMap[status],
                      }}
                    />
                    <div class="bar-chart-label">{PlanStatusLabel[status]}</div>
                  </div>
                )}
              </For>
            </div>
          </div>

          <div style={{ 'margin-bottom': '24px' }}>
            <div style={{ 'font-size': '15px', 'font-weight': 600, 'margin-bottom': '12px' }}>
              到期预警统计（共 {totalDueCount()} 条）
            </div>
            <div class="stat-cards" style={{ 'grid-template-columns': 'repeat(3, 1fr)' }}>
              <For each={Object.entries(data()!.dueStatusCounts) as Array<[DueStatus, number]>}>
                {([status, count]) => (
                  <div class="stat-card">
                    <div class="stat-card-label">{DueStatusLabel[status]}</div>
                    <div class="stat-card-value" style={{ color: dueStatusColorMap[status] }}>
                      {count}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          <div>
            <div style={{ 'font-size': '15px', 'font-weight': 600, 'margin-bottom': '12px' }}>
              到期预警柱状图
            </div>
            <div class="chart-container" style={{ 'justify-content': 'center', gap: '80px' }}>
              <For each={Object.entries(data()!.dueStatusCounts) as Array<[DueStatus, number]>}>
                {([status, count]) => (
                  <div class="bar-chart-item">
                    <div class="bar-chart-value">{count}</div>
                    <div
                      class="bar-chart-bar"
                      style={{
                        width: '80px',
                        height: `${(count / maxDueCount()) * 150}px`,
                        background: dueStatusColorMap[status],
                      }}
                    />
                    <div class="bar-chart-label">{DueStatusLabel[status]}</div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>

      <Show when={toast()}>
        <div class={`toast toast-${toast()!.type}`}>{toast()!.message}</div>
      </Show>
    </div>
  );
}
