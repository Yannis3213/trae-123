import { component$, useSignal, useTask$, useVisibleTask$, $ } from '@builder.io/qwik';
import { useNavigate, Link } from '@builder.io/qwik-city';
import { api } from '~/utils/api';
import { getCurrentUser, getUsersByRole, hasPermission } from '~/utils/auth';
import {
  type Station,
  type User,
  type Priority,
  PRIORITY_LABELS,
  type PatrolOrder,
} from '~/utils/types';

const MOCK_STATIONS: Station[] = [
  { id: 1, code: 'ST-HB-001', name: '华北一号光伏电站', region: '华北区', capacity_mw: 50.0 },
  { id: 2, code: 'ST-HB-002', name: '华北二号光伏电站', region: '华北区', capacity_mw: 30.0 },
  { id: 3, code: 'ST-HD-001', name: '华东一号光伏电站', region: '华东区', capacity_mw: 80.0 },
  { id: 4, code: 'ST-HD-002', name: '华东二号光伏电站', region: '华东区', capacity_mw: 45.0 },
];

export default component$(() => {
  const nav = useNavigate();

  const stations = useSignal<Station[]>([]);
  const inspectors = useSignal<User[]>([]);
  const managers = useSignal<User[]>([]);
  const loading = useSignal(true);
  const submitting = useSignal(false);
  const errorMessage = useSignal('');

  const stationId = useSignal<number | ''>('');
  const patrolDate = useSignal('');
  const dueDate = useSignal('');
  const priority = useSignal<Priority>('medium');
  const patrolContent = useSignal('');
  const inspectorId = useSignal<number | ''>('');
  const managerId = useSignal<number | ''>('');

  const formErrors = useSignal<Record<string, string>>({});

  useVisibleTask$(() => {
    if (!hasPermission('create_patrol')) {
      nav('/');
    }
  });

  useTask$(async () => {
    loading.value = true;
    try {
      const stationsRes = await api.get<Station[]>('/api/stations');
      if (stationsRes.success && stationsRes.data) {
        const d = stationsRes.data as any;
        stations.value = d.items || d;
      } else {
        stations.value = MOCK_STATIONS;
      }
    } catch {
      stations.value = MOCK_STATIONS;
    }

    inspectors.value = getUsersByRole('inspector');
    managers.value = getUsersByRole('manager');

    const user = getCurrentUser();
    if (user.role === 'inspector') {
      inspectorId.value = user.id;
    }

    const today = new Date().toISOString().split('T')[0];
    patrolDate.value = today;

    const due = new Date();
    due.setDate(due.getDate() + 7);
    dueDate.value = due.toISOString().split('T')[0];

    loading.value = false;
  });

  const validateForm = $(() => {
    const errors: Record<string, string> = {};

    if (!stationId.value) {
      errors.stationId = '请选择电站';
    }
    if (!patrolDate.value) {
      errors.patrolDate = '请选择巡检日期';
    }
    if (!dueDate.value) {
      errors.dueDate = '请选择到期日期';
    }
    if (patrolDate.value && dueDate.value && patrolDate.value > dueDate.value) {
      errors.dueDate = '到期日期不能早于巡检日期';
    }
    if (!patrolContent.value.trim()) {
      errors.patrolContent = '请输入巡检内容';
    }
    if (!inspectorId.value) {
      errors.inspectorId = '请选择巡检员';
    }
    if (!managerId.value) {
      errors.managerId = '请选择区域负责人';
    }

    formErrors.value = errors;
    return Object.keys(errors).length === 0;
  });

  const handleSubmit = $(async () => {
    if (!validateForm()) return;

    submitting.value = true;
    errorMessage.value = '';

    try {
      const res = await api.post<PatrolOrder>('/api/patrol-orders', {
        station_id: stationId.value,
        patrol_date: patrolDate.value,
        due_date: dueDate.value,
        priority: priority.value,
        patrol_content: patrolContent.value,
        inspector_id: inspectorId.value,
        manager_id: managerId.value,
      });

      if (res.success && res.data) {
        const order = res.data as any;
        const id = order.id || order.order?.id;
        if (id) {
          nav(`/patrol/${id}`);
          return;
        }
      }
      errorMessage.value = res.message || '创建失败';
    } catch (e: any) {
      errorMessage.value = e?.message || '网络错误';
    } finally {
      submitting.value = false;
    }
  });

  const handleCancel = $(() => {
    nav('/');
  });

  const priorityOptions: Priority[] = ['low', 'medium', 'high', 'urgent'];

  if (loading.value) {
    return <div class="text-center py-12 text-gray-500">加载中...</div>;
  }

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <Link href="/" class="text-gray-500 hover:text-gray-700">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 class="text-2xl font-bold text-gray-900">新建巡检单</h1>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {errorMessage.value && (
          <div class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {errorMessage.value}
          </div>
        )}

        <div class="space-y-5">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                电站 <span class="text-red-500">*</span>
              </label>
              <select
                value={stationId.value as any}
                onInput$={(e) => {
                  const v = (e.target as HTMLSelectElement).value;
                  stationId.value = v === '' ? '' : Number(v);
                  if (formErrors.value.stationId) {
                    formErrors.value = { ...formErrors.value, stationId: '' };
                  }
                }}
                class={[
                  'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  formErrors.value.stationId ? 'border-red-500' : 'border-gray-300',
                ].join(' ')}
              >
                <option value="">请选择电站</option>
                {stations.value.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {formErrors.value.stationId && (
                <p class="mt-1 text-sm text-red-600">{formErrors.value.stationId}</p>
              )}
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                优先级 <span class="text-red-500">*</span>
              </label>
              <select
                value={priority.value}
                onInput$={(e) => priority.value = (e.target as HTMLSelectElement).value as Priority}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {priorityOptions.map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                巡检日期 <span class="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={patrolDate.value}
                onInput$={(e) => {
                  patrolDate.value = (e.target as HTMLInputElement).value;
                  if (formErrors.value.patrolDate) {
                    formErrors.value = { ...formErrors.value, patrolDate: '' };
                  }
                }}
                class={[
                  'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  formErrors.value.patrolDate ? 'border-red-500' : 'border-gray-300',
                ].join(' ')}
              />
              {formErrors.value.patrolDate && (
                <p class="mt-1 text-sm text-red-600">{formErrors.value.patrolDate}</p>
              )}
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                到期日期 <span class="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dueDate.value}
                onInput$={(e) => {
                  dueDate.value = (e.target as HTMLInputElement).value;
                  if (formErrors.value.dueDate) {
                    formErrors.value = { ...formErrors.value, dueDate: '' };
                  }
                }}
                class={[
                  'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  formErrors.value.dueDate ? 'border-red-500' : 'border-gray-300',
                ].join(' ')}
              />
              {formErrors.value.dueDate && (
                <p class="mt-1 text-sm text-red-600">{formErrors.value.dueDate}</p>
              )}
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              巡检内容 <span class="text-red-500">*</span>
            </label>
            <textarea
              value={patrolContent.value}
              onInput$={(e) => {
                patrolContent.value = (e.target as HTMLTextAreaElement).value;
                if (formErrors.value.patrolContent) {
                  formErrors.value = { ...formErrors.value, patrolContent: '' };
                }
              }}
              rows={5}
              placeholder="请输入巡检内容..."
              class={[
                'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                formErrors.value.patrolContent ? 'border-red-500' : 'border-gray-300',
              ].join(' ')}
            />
            {formErrors.value.patrolContent && (
              <p class="mt-1 text-sm text-red-600">{formErrors.value.patrolContent}</p>
            )}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                指派巡检员 <span class="text-red-500">*</span>
              </label>
              <select
                value={inspectorId.value as any}
                onInput$={(e) => {
                  const v = (e.target as HTMLSelectElement).value;
                  inspectorId.value = v === '' ? '' : Number(v);
                  if (formErrors.value.inspectorId) {
                    formErrors.value = { ...formErrors.value, inspectorId: '' };
                  }
                }}
                class={[
                  'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  formErrors.value.inspectorId ? 'border-red-500' : 'border-gray-300',
                ].join(' ')}
              >
                <option value="">请选择巡检员</option>
                {inspectors.value.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              {formErrors.value.inspectorId && (
                <p class="mt-1 text-sm text-red-600">{formErrors.value.inspectorId}</p>
              )}
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                区域负责人 <span class="text-red-500">*</span>
              </label>
              <select
                value={managerId.value as any}
                onInput$={(e) => {
                  const v = (e.target as HTMLSelectElement).value;
                  managerId.value = v === '' ? '' : Number(v);
                  if (formErrors.value.managerId) {
                    formErrors.value = { ...formErrors.value, managerId: '' };
                  }
                }}
                class={[
                  'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  formErrors.value.managerId ? 'border-red-500' : 'border-gray-300',
                ].join(' ')}
              >
                <option value="">请选择区域负责人</option>
                {managers.value.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              {formErrors.value.managerId && (
                <p class="mt-1 text-sm text-red-600">{formErrors.value.managerId}</p>
              )}
            </div>
          </div>
        </div>

        <div class="mt-8 flex justify-end space-x-3">
          <button
            onClick$={handleCancel}
            class="px-5 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 font-medium transition-colors"
          >
            取消
          </button>
          <button
            onClick$={handleSubmit}
            disabled={submitting.value}
            class={[
              'px-5 py-2 text-white rounded-md font-medium transition-colors',
              submitting.value
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700',
            ].join(' ')}
          >
            {submitting.value ? '提交中...' : '提交'}
          </button>
        </div>
      </div>
    </div>
  );
});
