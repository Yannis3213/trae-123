import { createSignal, createEffect, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import type { TreatmentPlanItem } from '@/types';
import { getDueWarningList } from '@/api';
import { useToast, planStatusTagClass, formatDateOnly, statusTag } from '@/utils';

interface WarningData {
  normal: TreatmentPlanItem[];
  approaching: TreatmentPlanItem[];
  overdue: TreatmentPlanItem[];
}

export default function DueWarning() {
  const navigate = useNavigate();
  const { toast, show } = useToast();
  const [data, setData] = createSignal<WarningData>({ normal: [], approaching: [], overdue: [] });
  const [loading, setLoading] = createSignal(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getDueWarningList();
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

  const renderColumn = (title: string, items: TreatmentPlanItem[], tagClass: string, tagLabel: string) => (
    <div class="warning-column">
      <div class="warning-column-title">
        <span>{title}</span>
        <span class={`tag ${tagClass}`}>{tagLabel} · {items.length}</span>
      </div>
      <Show when={loading()}>
        <div class="empty">加载中...</div>
      </Show>
      <Show when={!loading() && items.length === 0}>
        <div class="empty">暂无数据</div>
      </Show>
      <For each={items}>
        {(item) => (
          <div
            class="warning-item"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/plans/${item.id}`)}
          >
            <div class="warning-item-title">
              {item.planNo} - {item.patientName}
            </div>
            <div class="warning-item-meta">
              <span style={{ 'margin-right': '12px' }}>
                <span class={planStatusTagClass(item.status)}>{statusTag(item.status)}</span>
              </span>
              <span>截止：{formatDateOnly(item.deadline)}</span>
            </div>
            <div class="warning-item-meta" style={{ 'margin-top': '4px' }}>
              处理人：{item.currentHandler}
            </div>
          </div>
        )}
      </For>
    </div>
  );

  return (
    <div>
      <div class="card">
        <div class="card-title" style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
          <span>到期预警</span>
          <button class="btn btn-sm" onClick={fetchData}>
            刷新
          </button>
        </div>
        <div class="warning-columns">
          {renderColumn('正常', data().normal, 'tag-green', '正常')}
          {renderColumn('临期（7天内）', data().approaching, 'tag-orange', '临期')}
          {renderColumn('逾期', data().overdue, 'tag-red', '逾期')}
        </div>
      </div>

      <Show when={toast()}>
        <div class={`toast toast-${toast()!.type}`}>{toast()!.message}</div>
      </Show>
    </div>
  );
}
