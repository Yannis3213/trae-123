import { component$, useSignal, useTask$, useVisibleTask$, $ } from '@builder.io/qwik';
import { Link, useNavigate } from '@builder.io/qwik-city';
import { api } from '~/utils/api';
import { hasPermission } from '~/utils/auth';
import {
  type PatrolOrder,
  type Station,
  type OrderStatus,
  type OverdueLevel,
  STATUS_LABELS,
  STATUS_COLORS,
  OVERDUE_LABELS,
  OVERDUE_COLORS,
  OVERDUE_BG_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  type BatchResultItem,
} from '~/utils/types';

const MOCK_STATIONS: Station[] = [
  { id: 1, code: 'ST-HB-001', name: '华北一号光伏电站', region: '华北区', capacity_mw: 50.0 },
  { id: 2, code: 'ST-HB-002', name: '华北二号光伏电站', region: '华北区', capacity_mw: 30.0 },
  { id: 3, code: 'ST-HD-001', name: '华东一号光伏电站', region: '华东区', capacity_mw: 80.0 },
  { id: 4, code: 'ST-HD-002', name: '华东二号光伏电站', region: '华东区', capacity_mw: 45.0 },
];

const MOCK_ORDERS: PatrolOrder[] = [
  {
    id: 1, order_no: 'PO202606001', station_id: 1, station_name: '华北一号光伏电站',
    status: 'pending_dispatch', priority: 'high',
    inspector_id: 2, inspector_name: '张伟-巡检员',
    engineer_id: undefined, engineer_name: undefined,
    manager_id: 6, manager_name: '陈刚-区域负责人',
    current_handler: 'inspector', current_handler_name: '张伟-巡检员',
    patrol_date: '2026-06-10', due_date: '2026-06-12',
    patrol_content: '月度例行巡检：组件清洗、逆变器检查、箱变巡检、接地系统检测',
    weather: '晴', temperature: '28℃', defect_count: 2,
    is_overdue: 0, overdue_level: 'normal',
    created_at: '2026-06-10 08:30:00', updated_at: '2026-06-10 08:30:00',
  },
  {
    id: 2, order_no: 'PO202606002', station_id: 2, station_name: '华北二号光伏电站',
    status: 'in_progress', priority: 'urgent',
    inspector_id: 2, inspector_name: '张伟-巡检员',
    engineer_id: 4, engineer_name: '王强-运维工程师',
    manager_id: 6, manager_name: '陈刚-区域负责人',
    current_handler: 'engineer', current_handler_name: '王强-运维工程师',
    patrol_date: '2026-06-08', due_date: '2026-06-15',
    patrol_content: '雨季专项巡检：排水系统、组件防水、电缆沟防水、防雷接地',
    weather: '多云', temperature: '25℃', defect_count: 3,
    previous_opinion: '材料已补齐，缺陷已录入，请工程师办理消缺',
    audit_remark: '巡检员初次提交时缺少逆变器温度数据，已补正',
    is_overdue: 0, overdue_level: 'near',
    created_at: '2026-06-08 09:00:00', updated_at: '2026-06-11 10:15:00',
  },
  {
    id: 3, order_no: 'PO202606003', station_id: 3, station_name: '华东一号光伏电站',
    status: 'in_progress', priority: 'medium',
    inspector_id: 3, inspector_name: '李娜-巡检员',
    engineer_id: 5, engineer_name: '赵敏-运维工程师',
    manager_id: 7, manager_name: '刘洋-区域负责人',
    current_handler: 'engineer', current_handler_name: '赵敏-运维工程师',
    patrol_date: '2026-06-05', due_date: '2026-06-10',
    patrol_content: '组件热斑专项巡检：红外检测、EL测试、接线盒检查',
    weather: '阴', temperature: '22℃', defect_count: 5,
    previous_opinion: '巡检材料完整，发现5处热斑待消缺',
    is_overdue: 1, overdue_level: 'overdue',
    created_at: '2026-06-05 07:45:00', updated_at: '2026-06-10 18:00:00',
  },
  {
    id: 4, order_no: 'PO202606004', station_id: 4, station_name: '华东二号光伏电站',
    status: 'closed', priority: 'low',
    inspector_id: 3, inspector_name: '李娜-巡检员',
    engineer_id: 5, engineer_name: '赵敏-运维工程师',
    manager_id: 7, manager_name: '刘洋-区域负责人',
    current_handler: 'inspector', current_handler_name: '李娜-巡检员',
    patrol_date: '2026-06-01', due_date: '2026-06-05',
    patrol_content: '日常巡检：组件外观、汇流箱、SCADA数据核对',
    weather: '晴', temperature: '30℃', defect_count: 1,
    previous_opinion: '消缺验收通过，区域负责人已收口',
    audit_remark: '无异常',
    is_overdue: 0, overdue_level: 'normal',
    created_at: '2026-06-01 10:00:00', updated_at: '2026-06-05 16:30:00',
  },
];

export default component$(() => {
  const nav = useNavigate();
  const orders = useSignal<PatrolOrder[]>([]);
  const stations = useSignal<Station[]>([]);
  const loading = useSignal(true);

  const statusFilter = useSignal<OrderStatus | ''>('');
  const overdueFilter = useSignal<OverdueLevel | ''>('');
  const stationFilter = useSignal<number | ''>('');
  const keywordFilter = useSignal('');
  const selectedIds = useSignal<Set<number>>(new Set());
  const showBatchResult = useSignal(false);
  const batchResults = useSignal<BatchResultItem[]>([]);

  const canCreate = useSignal(false);
  const canBatchProcess = useSignal(false);
  const canBatchClose = useSignal(false);

  useVisibleTask$(() => {
    canCreate.value = hasPermission('create_patrol');
    canBatchProcess.value = hasPermission('batch_process');
    canBatchClose.value = hasPermission('batch_close_overdue');
  });

  const serverStats = useSignal({ normal: 0, near: 0, overdue: 0 });

  useTask$(async ({ track }) => {
    track(() => statusFilter.value);
    track(() => overdueFilter.value);
    track(() => stationFilter.value);
    track(() => keywordFilter.value);

    loading.value = true;

    try {
      const [ordersRes, stationsRes] = await Promise.all([
        api.get<any>('/api/patrol-orders'),
        api.get<Station[]>('/api/stations'),
      ]);

      if (stationsRes.success && stationsRes.data) {
        const d = stationsRes.data as any;
        stations.value = d.items || d;
      } else {
        stations.value = MOCK_STATIONS;
      }

      let data: PatrolOrder[] = [];
      if (ordersRes.success && ordersRes.data) {
        if (Array.isArray(ordersRes.data)) {
          data = ordersRes.data as PatrolOrder[];
        } else if (ordersRes.data.items) {
          data = ordersRes.data.items as PatrolOrder[];
          if (ordersRes.data.group_stats) {
            serverStats.value = ordersRes.data.group_stats;
          }
        }
      } else {
        data = MOCK_ORDERS;
      }

      if (statusFilter.value) {
        data = data.filter(o => o.status === statusFilter.value);
      }
      if (overdueFilter.value) {
        data = data.filter(o => o.overdue_level === overdueFilter.value);
      }
      if (stationFilter.value) {
        data = data.filter(o => o.station_id === stationFilter.value);
      }
      if (keywordFilter.value.trim()) {
        const kw = keywordFilter.value.trim().toLowerCase();
        data = data.filter(o =>
          o.order_no.toLowerCase().includes(kw) ||
          (o.station_name || '').toLowerCase().includes(kw)
        );
      }

      orders.value = data;
    } catch {
      orders.value = MOCK_ORDERS;
      stations.value = MOCK_STATIONS;
    } finally {
      loading.value = false;
    }
  });

  const stats = serverStats.value.normal > 0 || serverStats.value.near > 0 || serverStats.value.overdue > 0
    ? serverStats.value
    : {
        normal: orders.value.filter(o => o.overdue_level === 'normal').length,
        near: orders.value.filter(o => o.overdue_level === 'near').length,
        overdue: orders.value.filter(o => o.overdue_level === 'overdue').length,
      };

  const toggleSelect$ = $((id: number) => {
    const next = new Set(selectedIds.value);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selectedIds.value = next;
  });

  const toggleSelectAll$ = $(() => {
    if (selectedIds.value.size === orders.value.length) {
      selectedIds.value = new Set();
    } else {
      selectedIds.value = new Set(orders.value.map(o => o.id));
    }
  });

  const handleBatchProcess$ = $(async () => {
    if (selectedIds.value.size === 0) return;
    try {
      const items = Array.from(selectedIds.value).map(id => {
        const order = orders.value.find(o => o.id === id);
        return { id, version: order?.version || 1, opinion: '批量办理' };
      });
      const res = await api.post<any>('/api/patrol-orders/batch-process', { items });
      if (res.success && res.data) {
        const mapped: BatchResultItem[] = (res.data as any[]).map((r: any) => {
          const order = orders.value.find(o => o.id === r.id);
          return {
            order_no: order?.order_no || String(r.id),
            success: r.success,
            message: r.message,
          };
        });
        batchResults.value = mapped;
      } else {
        batchResults.value = Array.from(selectedIds.value).map(id => {
          const order = orders.value.find(o => o.id === id);
          return { order_no: order?.order_no || String(id), success: false, message: res.message || '处理失败' };
        });
      }
    } catch (e: any) {
      batchResults.value = Array.from(selectedIds.value).map(id => {
        const order = orders.value.find(o => o.id === id);
        return { order_no: order?.order_no || String(id), success: false, message: e?.message || '网络错误' };
      });
    }
    showBatchResult.value = true;
    selectedIds.value = new Set();
    if (typeof window !== 'undefined') {
      setTimeout(() => window.location.reload(), 2000);
    }
  });

  const handleBatchCloseOverdue$ = $(async () => {
    const overdueIds = Array.from(selectedIds.value).filter(id => {
      const order = orders.value.find(o => o.id === id);
      return order?.overdue_level === 'overdue';
    });
    if (overdueIds.length === 0) return;
    try {
      const items = overdueIds.map(id => {
        const order = orders.value.find(o => o.id === id);
        return { id, version: order?.version || 1, remark: '月底批量关闭逾期单' };
      });
      const res = await api.post<any>('/api/patrol-orders/batch-close', { items });
      if (res.success && res.data) {
        const mapped: BatchResultItem[] = (res.data as any[]).map((r: any) => {
          const order = orders.value.find(o => o.id === r.id);
          return {
            order_no: order?.order_no || String(r.id),
            success: r.success,
            message: r.message,
          };
        });
        batchResults.value = mapped;
      } else {
        batchResults.value = overdueIds.map(id => {
          const order = orders.value.find(o => o.id === id);
          return { order_no: order?.order_no || String(id), success: false, message: res.message || '关闭失败' };
        });
      }
    } catch (e: any) {
      batchResults.value = overdueIds.map(id => {
        const order = orders.value.find(o => o.id === id);
        return { order_no: order?.order_no || String(id), success: false, message: e?.message || '网络错误' };
      });
    }
    showBatchResult.value = true;
    selectedIds.value = new Set();
    if (typeof window !== 'undefined') {
      setTimeout(() => window.location.reload(), 2000);
    }
  });

  const statusOptions: OrderStatus[] = ['pending_dispatch', 'in_progress', 'returned', 'reviewing', 'closed'];
  const overdueOptions: OverdueLevel[] = ['normal', 'near', 'overdue'];

  return (
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-900">电站巡检列表</h1>
        {canCreate.value && (
          <button
            onClick$={() => nav('/patrol/new')}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            + 新增巡检单
          </button>
        )}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-green-50 border border-green-200 rounded-lg p-5">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-green-700">正常</p>
              <p class="text-3xl font-bold text-green-600 mt-1">{stats.normal}</p>
            </div>
            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-yellow-700">临期</p>
              <p class="text-3xl font-bold text-yellow-600 mt-1">{stats.near}</p>
            </div>
            <div class="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div class="bg-red-50 border border-red-200 rounded-lg p-5">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-red-700">逾期</p>
              <p class="text-3xl font-bold text-red-600 mt-1">{stats.overdue}</p>
            </div>
            <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">状态</label>
            <select
              value={statusFilter.value}
              onInput$={(e) => statusFilter.value = (e.target as HTMLSelectElement).value as any}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">全部状态</option>
              {statusOptions.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">到期分级</label>
            <select
              value={overdueFilter.value}
              onInput$={(e) => overdueFilter.value = (e.target as HTMLSelectElement).value as any}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">全部分级</option>
              {overdueOptions.map(o => (
                <option key={o} value={o}>{OVERDUE_LABELS[o]}</option>
              ))}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">电站</label>
            <select
              value={stationFilter.value as any}
              onInput$={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                stationFilter.value = v === '' ? '' : Number(v);
              }}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">全部电站</option>
              {stations.value.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">关键词搜索</label>
            <input
              type="text"
              value={keywordFilter.value}
              onInput$={(e) => keywordFilter.value = (e.target as HTMLInputElement).value}
              placeholder="输入单号或电站名称..."
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.value.size === orders.value.length && orders.value.length > 0}
                    onInput$={toggleSelectAll$}
                    class="w-4 h-4 rounded border-gray-300"
                  />
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">单号</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">电站</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">优先级</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">当前处理人</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">到期日</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">到期分级</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">巡检日期</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {loading.value ? (
                <tr>
                  <td colSpan={10} class="px-4 py-8 text-center text-gray-500">加载中...</td>
                </tr>
              ) : orders.value.length === 0 ? (
                <tr>
                  <td colSpan={10} class="px-4 py-8 text-center text-gray-500">暂无数据</td>
                </tr>
              ) : (
                orders.value.map((order, idx) => (
                  <tr
                    key={order.id}
                    class={[
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                      OVERDUE_BG_COLORS[order.overdue_level],
                    ].join(' ')}
                  >
                    <td class="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.value.has(order.id)}
                        onInput$={() => toggleSelect$(order.id)}
                        class="w-4 h-4 rounded border-gray-300"
                      />
                    </td>
                    <td class="px-4 py-3 text-sm font-medium text-blue-600">
                      <Link href={`/patrol/${order.id}`} class="hover:underline">
                        {order.order_no}
                      </Link>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-900">{order.station_name}</td>
                    <td class="px-4 py-3">
                      <span class={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <span class={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[order.priority]}`}>
                        {PRIORITY_LABELS[order.priority]}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-900">{order.current_handler_name || '-'}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">{order.due_date}</td>
                    <td class="px-4 py-3">
                      <span class={`text-sm font-medium ${OVERDUE_COLORS[order.overdue_level]}`}>
                        {OVERDUE_LABELS[order.overdue_level]}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-900">{order.patrol_date}</td>
                    <td class="px-4 py-3 text-sm space-x-2">
                      <Link href={`/patrol/${order.id}`} class="text-blue-600 hover:text-blue-800">查看</Link>
                      {order.status !== 'closed' && (
                        <Link href={`/patrol/${order.id}?action=handle`} class="text-green-600 hover:text-green-800">办理</Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div class="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div class="text-sm text-gray-700">
            已选择 <span class="font-medium">{selectedIds.value.size}</span> 项
          </div>
          <div class="flex space-x-3">
            {canBatchProcess.value && (
              <button
                onClick$={handleBatchProcess$}
                disabled={selectedIds.value.size === 0}
                class={[
                  'px-4 py-2 rounded-md font-medium text-sm transition-colors',
                  selectedIds.value.size === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700',
                ].join(' ')}
              >
                批量办理
              </button>
            )}
            {canBatchClose.value && (
              <button
                onClick$={handleBatchCloseOverdue$}
                disabled={selectedIds.value.size === 0}
                class={[
                  'px-4 py-2 rounded-md font-medium text-sm transition-colors',
                  selectedIds.value.size === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700',
                ].join(' ')}
              >
                批量关闭逾期单
              </button>
            )}
          </div>
        </div>
      </div>

      {showBatchResult.value && (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 class="text-lg font-semibold text-gray-900">批量处理结果</h3>
              <button
                onClick$={() => { showBatchResult.value = false; }}
                class="text-gray-400 hover:text-gray-600"
              >
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="p-6 overflow-y-auto max-h-[60vh]">
              <div class="space-y-2">
                {batchResults.value.map((r, i) => (
                  <div
                    key={i}
                    class={[
                      'flex items-center justify-between px-4 py-3 rounded-md border',
                      r.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200',
                    ].join(' ')}
                  >
                    <div class="flex items-center space-x-3">
                      <span class={r.success ? 'text-green-600' : 'text-red-600'}>
                        {r.success ? '✓' : '✗'}
                      </span>
                      <span class="font-medium text-gray-900">{r.order_no}</span>
                    </div>
                    <span class={r.success ? 'text-green-700 text-sm' : 'text-red-700 text-sm'}>
                      {r.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick$={() => { showBatchResult.value = false; }}
                class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
