import { component$, useSignal, useTask$, useVisibleTask$, $ } from '@builder.io/qwik';
import { routeLoader$, useNavigate, Link } from '@builder.io/qwik-city';
import { api } from '~/utils/api';
import { getCurrentUser, hasPermission } from '~/utils/auth';
import {
  type PatrolOrder,
  type DefectReport,
  type AcceptanceRecord,
  type Attachment,
  type AuditTrail,
  type ProcessRecord,
  type User,
  STATUS_LABELS,
  STATUS_COLORS,
  OVERDUE_LABELS,
  OVERDUE_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from '~/utils/types';

export const usePatrolOrderId = routeLoader$(({ params }) => {
  return params.id;
});

const MOCK_ORDER: PatrolOrder = {
  id: 2,
  order_no: 'PO202606002',
  station_id: 2,
  station_name: '华北二号光伏电站',
  status: 'in_progress',
  priority: 'urgent',
  inspector_id: 2,
  inspector_name: '张伟-巡检员',
  engineer_id: 4,
  engineer_name: '王强-运维工程师',
  manager_id: 6,
  manager_name: '陈刚-区域负责人',
  current_handler: 'engineer',
  current_handler_name: '王强-运维工程师',
  patrol_date: '2026-06-08',
  due_date: '2026-06-15',
  patrol_content: '雨季专项巡检：排水系统、组件防水、电缆沟防水、防雷接地',
  weather: '多云',
  temperature: '25℃',
  patrol_evidence: ['雨季巡检记录表_002.pdf', '排水系统照片_002.jpg'],
  defect_count: 3,
  previous_opinion: '材料已补齐，缺陷已录入，请工程师办理消缺',
  previous_attachment: '/uploads/PO202606002/雨季巡检记录表_002.pdf',
  audit_remark: '巡检员初次提交时缺少逆变器温度数据，已补正',
  anomaly_reason: null as any,
  is_overdue: 0,
  overdue_level: 'near',
  created_at: '2026-06-08 09:00:00',
  updated_at: '2026-06-11 10:15:00',
};

const MOCK_PROCESS: ProcessRecord[] = [
  {
    id: 2, patrol_order_id: 2, step_order: 1,
    step_name: '站点巡检员补齐材料',
    handler_id: 2, handler_name: '张伟-巡检员', handler_role: 'inspector',
    status: 'completed', opinion: '巡检材料已提交，含2处缺陷上报',
    evidence: ['雨季巡检记录表_002.pdf', '排水系统照片_002.jpg'],
    started_at: '2026-06-08 09:00:00', finished_at: '2026-06-09 10:15:00',
    anomaly_reason: '初次提交缺少逆变器温度数据',
    correction_note: '2026-06-09补充逆变器温度记录及截图',
  },
  {
    id: 3, patrol_order_id: 2, step_order: 2,
    step_name: '运维工程师办理',
    handler_id: 4, handler_name: '王强-运维工程师', handler_role: 'engineer',
    status: 'in_progress', opinion: '正在处理3处缺陷消缺',
    evidence: ['消缺方案_002.pdf'],
    started_at: '2026-06-09 11:00:00', finished_at: undefined,
  },
  {
    id: 4, patrol_order_id: 2, step_order: 3,
    step_name: '区域负责人收口',
    status: 'pending',
  },
];

const MOCK_DEFECTS: DefectReport[] = [
  {
    id: 3, patrol_order_id: 2, defect_no: 'DF202606003',
    location: '3号方阵电缆沟', description: '电缆沟积水约15cm，排水口堵塞',
    severity: 'major', category: '排水系统',
    reported_at: '2026-06-08 14:20:00', deadline: '2026-06-14',
    status: 'in_progress',
    reporter_id: 2, reporter_name: '张伟-巡检员',
    assignee_id: 4, assignee_name: '王强-运维工程师',
    evidence: ['积水照片_3.jpg', '排水口堵塞_3.jpg'],
  },
  {
    id: 4, patrol_order_id: 2, defect_no: 'DF202606004',
    location: '1号箱变', description: '箱变门密封条老化，雨天有渗水痕迹',
    severity: 'minor', category: '箱变密封',
    reported_at: '2026-06-08 15:00:00', deadline: '2026-06-20',
    status: 'reported',
    reporter_id: 2, reporter_name: '张伟-巡检员',
    anomaly_reason: '初次上报时未附照片，已补正',
  },
  {
    id: 5, patrol_order_id: 2, defect_no: 'DF202606005',
    location: '4号方阵B区8号组件', description: '组件热斑温度达72℃',
    severity: 'critical', category: '热斑',
    reported_at: '2026-06-08 16:30:00', deadline: '2026-06-11',
    status: 'in_progress',
    reporter_id: 2, reporter_name: '张伟-巡检员',
    assignee_id: 4, assignee_name: '王强-运维工程师',
    evidence: ['红外热像图_5.jpg', '组件定位_5.png'],
    anomaly_reason: '上报超时，距巡检完成超过24小时',
  },
];

const MOCK_ACCEPTANCE: AcceptanceRecord[] = [
  {
    id: 1, defect_id: 7, patrol_order_id: 2,
    result: 'pass',
    evidence: ['更换后红外检测_7.jpg'],
    remark: '更换组件后复测温度正常，验收通过',
    acceptor_id: 7, acceptor_name: '刘洋-区域负责人',
    accepted_at: '2026-06-09 16:30:00',
  },
];

const MOCK_ATTACHMENTS: Attachment[] = [
  { id: 1, patrol_order_id: 2, file_name: '雨季巡检记录表_002.pdf', file_path: '/uploads/PO202606002/雨季巡检记录表_002.pdf', file_size: 327680, file_type: 'application/pdf', uploaded_by: 2, uploaded_by_name: '张伟-巡检员', created_at: '2026-06-08 10:30:00' },
  { id: 3, defect_id: 3, file_name: '积水照片_3.jpg', file_path: '/uploads/DF202606003/积水照片_3.jpg', file_size: 2097152, file_type: 'image/jpeg', uploaded_by: 2, uploaded_by_name: '张伟-巡检员', created_at: '2026-06-08 14:25:00' },
];

const MOCK_AUDIT: AuditTrail[] = [
  { id: 2, patrol_order_id: 2, action: '创建巡检单', to_status: 'pending_dispatch', actor_id: 2, actor_role: 'inspector', actor_name: '张伟-巡检员', remark: '创建雨季专项巡检', created_at: '2026-06-08 09:00:00' },
  { id: 3, patrol_order_id: 2, action: '退回补正', from_status: 'pending_dispatch', to_status: 'returned', actor_id: 4, actor_role: 'engineer', actor_name: '王强-运维工程师', remark: '缺少逆变器温度记录，请补充', anomaly_reason: '巡检材料不全：逆变器温度数据缺失', created_at: '2026-06-08 16:00:00' },
  { id: 4, patrol_order_id: 2, action: '补正提交', from_status: 'returned', to_status: 'in_progress', actor_id: 2, actor_role: 'inspector', actor_name: '张伟-巡检员', remark: '已补充逆变器温度数据及照片', evidence: ['逆变器温度曲线补充.png'], previous_opinion: '缺少逆变器温度记录，请补充', previous_attachment: '/uploads/PO202606002/雨季巡检记录表_002.pdf', created_at: '2026-06-09 10:15:00' },
  { id: 5, patrol_order_id: 2, action: '派发工程师', from_status: 'pending_dispatch', to_status: 'in_progress', actor_id: 6, actor_role: 'manager', actor_name: '陈刚-区域负责人', remark: '派发王强工程师处理消缺', created_at: '2026-06-09 11:00:00' },
];

type TabKey = 'patrol' | 'defect' | 'acceptance';

export default component$(() => {
  const nav = useNavigate();
  const orderId = usePatrolOrderId();

  const order = useSignal<PatrolOrder | null>(null);
  const processRecords = useSignal<ProcessRecord[]>([]);
  const defects = useSignal<DefectReport[]>([]);
  const acceptanceRecords = useSignal<AcceptanceRecord[]>([]);
  const attachments = useSignal<Attachment[]>([]);
  const auditTrails = useSignal<AuditTrail[]>([]);
  const loading = useSignal(true);

  const activeTab = useSignal<TabKey>('patrol');
  const currentUser = useSignal<User | null>(null);
  const handleOpinion = useSignal('');
  const showHandleDialog = useSignal(false);
  const handleResult = useSignal<'submit' | 'dispatch' | 'return' | 'review' | ''>('');

  useVisibleTask$(() => {
    currentUser.value = getCurrentUser();
  });

  useTask$(async () => {
    loading.value = true;
    try {
      const id = Number(orderId.value);
      const [detailRes, auditRes] = await Promise.all([
        api.get<any>(`/api/patrol-orders/${id}`),
        api.get<AuditTrail[]>(`/api/patrol-orders/${id}/audit-trails`),
      ]);

      if (detailRes.success && detailRes.data) {
        if (detailRes.data.order) {
          order.value = detailRes.data.order;
          processRecords.value = detailRes.data.process_records || [];
          defects.value = detailRes.data.defects || [];
          attachments.value = detailRes.data.attachments || [];
          acceptanceRecords.value = detailRes.data.acceptance_records || [];
        } else {
          order.value = detailRes.data;
        }
      } else {
        order.value = MOCK_ORDER;
        processRecords.value = MOCK_PROCESS;
        defects.value = MOCK_DEFECTS;
        acceptanceRecords.value = MOCK_ACCEPTANCE;
        attachments.value = MOCK_ATTACHMENTS;
      }

      auditTrails.value = auditRes.success && auditRes.data ? auditRes.data : MOCK_AUDIT;
    } catch {
      order.value = MOCK_ORDER;
      processRecords.value = MOCK_PROCESS;
      defects.value = MOCK_DEFECTS;
      acceptanceRecords.value = MOCK_ACCEPTANCE;
      attachments.value = MOCK_ATTACHMENTS;
      auditTrails.value = MOCK_AUDIT;
    } finally {
      loading.value = false;
    }
  });

  const getCurrentStep = () => {
    if (!order.value) return 1;
    const handler = order.value.current_handler;
    if (handler === 'inspector') return 1;
    if (handler === 'engineer') return 2;
    if (handler === 'manager') return 3;
    return 1;
  };

  const showActionButtons = () => {
    if (!order.value || !currentUser.value) return { submit: false, dispatch: false, handle: false, return: false, review: false };
    const o = order.value;
    const role = currentUser.value.role;
    const canSubmit = (role === 'inspector' || role === 'admin') && o.current_handler === 'inspector' && o.status !== 'closed';
    const canDispatch = (role === 'manager' || role === 'admin') && o.status === 'pending_dispatch';
    const canHandle = ((role === 'engineer' && o.current_handler === 'engineer') ||
                      (role === 'manager' && o.current_handler === 'manager') ||
                      role === 'admin') && o.status !== 'closed' && o.status !== 'pending_dispatch';
    const canReturn = (role === 'engineer' || role === 'manager' || role === 'admin') &&
                      o.status === 'in_progress' && o.current_handler !== 'inspector';
    const canReview = (role === 'manager' || role === 'admin') && o.status === 'reviewing';
    return { submit: canSubmit, dispatch: canDispatch, handle: canHandle, return: canReturn, review: canReview };
  };

  const handleAction$ = $((action: 'submit' | 'dispatch' | 'handle' | 'return' | 'review') => {
    handleResult.value = action;
    showHandleDialog.value = true;
  });

  const confirmHandle$ = $(async () => {
    if (!order.value) return;
    const id = order.value.id;
    const version = order.value.version || 1;
    try {
      const action = handleResult.value;
      if (action === 'submit') {
        await api.put(`/api/patrol-orders/${id}/submit`, {
          patrol_content: order.value.patrol_content,
          weather: order.value.weather,
          temperature: order.value.temperature,
          patrol_evidence: order.value.patrol_evidence || [],
          version,
        });
      } else if (action === 'dispatch') {
        await api.put(`/api/patrol-orders/${id}/dispatch`, {
          engineer_id: order.value.engineer_id || 4,
          version,
          remark: handleOpinion.value,
        });
      } else if (action === 'handle' || action === 'process') {
        const evidences: Record<string, string[]> = {};
        defects.value.forEach(d => {
          evidences[d.defect_no] = d.evidence || [`消缺证据_${d.defect_no}.pdf`];
        });
        await api.put(`/api/patrol-orders/${id}/process`, {
          defect_evidences: evidences,
          opinion: handleOpinion.value || '消缺完成',
          version,
        });
      } else if (action === 'return') {
        await api.put(`/api/patrol-orders/${id}/return`, {
          opinion: handleOpinion.value || '材料不完整，请补充',
          attachment: undefined,
          version,
        });
      } else if (action === 'review') {
        await api.put(`/api/patrol-orders/${id}/review`, {
          result: 'pass',
          remark: handleOpinion.value || '复核通过',
          version,
        });
      }
    } catch {
      // ignore
    }
    showHandleDialog.value = false;
    handleOpinion.value = '';
    handleResult.value = '';
    nav('/');
  });

  if (loading.value) {
    return <div class="text-center py-12 text-gray-500">加载中...</div>;
  }

  if (!order.value) {
    return <div class="text-center py-12 text-gray-500">未找到巡检单</div>;
  }

  const actions = showActionButtons();
  const currentStep = getCurrentStep();
  const o = order.value;

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <Link href="/" class="text-gray-500 hover:text-gray-700">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 class="text-2xl font-bold text-gray-900">巡检单详情</h1>
          <span class="text-gray-400">{o.order_no}</span>
        </div>
        <div class="flex space-x-2">
          {actions.submit && (
            <button onClick$={() => handleAction$('submit')} class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium">提交</button>
          )}
          {actions.dispatch && (
            <button onClick$={() => handleAction$('dispatch')} class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">派发</button>
          )}
          {actions.handle && (
            <button onClick$={() => handleAction$('handle')} class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">办理</button>
          )}
          {actions.return && (
            <button onClick$={() => handleAction$('return')} class="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 font-medium">退回</button>
          )}
          {actions.review && (
            <button onClick$={() => handleAction$('review')} class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium">复核</button>
          )}
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-1 space-y-6">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">基础信息</h2>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">单号</span>
                <span class="font-medium text-gray-900">{o.order_no}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">电站</span>
                <span class="font-medium text-gray-900">{o.station_name}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-500">状态</span>
                <span class={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[o.status]}`}>
                  {STATUS_LABELS[o.status]}
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-500">优先级</span>
                <span class={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[o.priority]}`}>
                  {PRIORITY_LABELS[o.priority]}
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-500">到期分级</span>
                <span class={`text-sm font-medium ${OVERDUE_COLORS[o.overdue_level]}`}>
                  {OVERDUE_LABELS[o.overdue_level]}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">到期日</span>
                <span class="font-medium text-gray-900">{o.due_date}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">巡检日期</span>
                <span class="font-medium text-gray-900">{o.patrol_date}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">创建时间</span>
                <span class="font-medium text-gray-900">{o.created_at}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">当前处理人</span>
                <span class="font-medium text-gray-900">{o.current_handler_name || '-'}</span>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">处理流程</h2>
            <div class="space-y-1">
              {processRecords.value.map((step, idx) => {
                const isActive = idx + 1 === currentStep;
                const isDone = step.status === 'completed';
                return (
                  <div key={step.id} class="relative pb-6">
                    {idx < processRecords.value.length - 1 && (
                      <div class={`absolute left-3.5 top-8 w-0.5 h-full ${isDone ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                    )}
                    <div class="flex items-start space-x-3">
                      <div class={[
                        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium z-10',
                        isActive ? 'bg-blue-500 text-white ring-4 ring-blue-100' :
                        isDone ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500',
                      ].join(' ')}>
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class={['font-medium text-sm', isActive ? 'text-blue-600' : isDone ? 'text-gray-900' : 'text-gray-500'].join(' ')}>
                          {step.step_name}
                        </div>
                        {step.handler_name && (
                          <div class="text-xs text-gray-500 mt-0.5">处理人：{step.handler_name}</div>
                        )}
                        {step.status && (
                          <div class="text-xs mt-1">
                            <span class={[
                              'inline-block px-2 py-0.5 rounded',
                              step.status === 'completed' ? 'bg-green-100 text-green-700' :
                              step.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600',
                            ].join(' ')}>
                              {step.status === 'completed' ? '已完成' : step.status === 'in_progress' ? '处理中' : '待处理'}
                            </span>
                          </div>
                        )}
                        {step.opinion && (
                          <div class="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                            <span class="font-medium">意见：</span>{step.opinion}
                          </div>
                        )}
                        {step.anomaly_reason && (
                          <div class="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded">
                            <span class="font-medium">异常：</span>{step.anomaly_reason}
                          </div>
                        )}
                        {step.correction_note && (
                          <div class="text-xs text-orange-600 mt-1 bg-orange-50 p-2 rounded">
                            <span class="font-medium">补正：</span>{step.correction_note}
                          </div>
                        )}
                        {(step.started_at || step.finished_at) && (
                          <div class="text-xs text-gray-400 mt-2 space-y-0.5">
                            {step.started_at && <div>开始：{step.started_at}</div>}
                            {step.finished_at && <div>完成：{step.finished_at}</div>}
                          </div>
                        )}
                        {step.evidence && step.evidence.length > 0 && (
                          <div class="text-xs text-gray-500 mt-2">
                            <span class="font-medium">附件：</span>
                            {step.evidence.join('、')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {o.previous_opinion && (
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h2 class="text-lg font-semibold text-gray-900 mb-3">上一处理人意见</h2>
              <div class="text-sm text-gray-700 bg-blue-50 p-3 rounded">
                {o.previous_opinion}
              </div>
              {o.previous_attachment && (
                <div class="mt-2 text-sm text-blue-600">
                  📎 {o.previous_attachment.split('/').pop()}
                </div>
              )}
            </div>
          )}

          {(o.audit_remark || o.anomaly_reason) && (
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h2 class="text-lg font-semibold text-gray-900 mb-3">审计备注</h2>
              {o.audit_remark && (
                <div class="text-sm text-gray-700 mb-2">
                  <span class="font-medium">备注：</span>{o.audit_remark}
                </div>
              )}
              {o.anomaly_reason && (
                <div class="text-sm text-red-600 bg-red-50 p-2 rounded">
                  <span class="font-medium">异常原因：</span>{o.anomaly_reason}
                </div>
              )}
            </div>
          )}

          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">附件列表</h2>
            {attachments.value.length === 0 ? (
              <div class="text-sm text-gray-500">暂无附件</div>
            ) : (
              <div class="space-y-2">
                {attachments.value.map(a => (
                  <div key={a.id} class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div class="flex items-center space-x-2">
                      <span class="text-gray-400">📎</span>
                      <span class="text-sm text-gray-700">{a.file_name}</span>
                    </div>
                    <span class="text-xs text-gray-400">{a.created_at}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div class="lg:col-span-2 space-y-6">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200">
            <div class="border-b border-gray-200">
              <nav class="flex">
                <button
                  onClick$={() => activeTab.value = 'patrol'}
                  class={[
                    'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                    activeTab.value === 'patrol'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700',
                  ].join(' ')}
                >
                  电站巡检
                </button>
                <button
                  onClick$={() => activeTab.value = 'defect'}
                  class={[
                    'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                    activeTab.value === 'defect'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700',
                  ].join(' ')}
                >
                  缺陷上报 ({defects.value.length})
                </button>
                <button
                  onClick$={() => activeTab.value = 'acceptance'}
                  class={[
                    'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                    activeTab.value === 'acceptance'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700',
                  ].join(' ')}
                >
                  消缺验收
                </button>
              </nav>
            </div>

            <div class="p-5">
              {activeTab.value === 'patrol' && (
                <div class="space-y-4">
                  <div class="flex justify-between items-start">
                    <h3 class="text-md font-semibold text-gray-900">巡检内容</h3>
                    {hasPermission('handle_inspector') && o.current_handler === 'inspector' && (
                      <button class="text-sm text-blue-600 hover:text-blue-800">编辑补正</button>
                    )}
                  </div>
                  <div class="bg-gray-50 rounded p-4 text-sm text-gray-700">
                    {o.patrol_content || '暂无巡检内容'}
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-500 mb-1">天气</label>
                      <div class="text-sm text-gray-900">{o.weather || '-'}</div>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-500 mb-1">温度</label>
                      <div class="text-sm text-gray-900">{o.temperature || '-'}</div>
                    </div>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-500 mb-2">证据文件</label>
                    {o.patrol_evidence && o.patrol_evidence.length > 0 ? (
                      <div class="flex flex-wrap gap-2">
                        {o.patrol_evidence.map((e, i) => (
                          <span key={i} class="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded text-sm">
                            📎 {e}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div class="text-sm text-gray-500">暂无证据文件</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab.value === 'defect' && (
                <div class="space-y-4">
                  <div class="flex justify-between items-center">
                    <h3 class="text-md font-semibold text-gray-900">缺陷列表</h3>
                    {hasPermission('handle_inspector') && o.current_handler === 'inspector' && (
                      <button class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ 新增缺陷</button>
                    )}
                  </div>

                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                      <thead class="bg-gray-50">
                        <tr>
                          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">缺陷号</th>
                          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">位置</th>
                          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">描述</th>
                          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">严重度</th>
                          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">状态</th>
                          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">上报时限</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-200">
                        {defects.value.map(d => (
                          <tr key={d.id} class="hover:bg-gray-50">
                            <td class="px-3 py-2 text-sm text-blue-600 font-medium">{d.defect_no}</td>
                            <td class="px-3 py-2 text-sm text-gray-900">{d.location}</td>
                            <td class="px-3 py-2 text-sm text-gray-700 max-w-xs truncate">{d.description}</td>
                            <td class="px-3 py-2">
                              <span class={[
                                'inline-flex px-2 py-0.5 text-xs font-medium rounded',
                                d.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                d.severity === 'major' ? 'bg-orange-100 text-orange-700' :
                                'bg-yellow-100 text-yellow-700',
                              ].join(' ')}>
                                {d.severity === 'critical' ? '严重' : d.severity === 'major' ? '重要' : '轻微'}
                              </span>
                            </td>
                            <td class="px-3 py-2 text-sm text-gray-600">
                              {d.status === 'reported' ? '已上报' :
                               d.status === 'in_progress' ? '处理中' :
                               d.status === 'resolved' ? '已消缺' :
                               d.status === 'verified' ? '已验收' : '已拒绝'}
                            </td>
                            <td class="px-3 py-2 text-sm text-gray-500">{d.deadline || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab.value === 'acceptance' && (
                <div class="space-y-4">
                  <div class="flex justify-between items-center">
                    <h3 class="text-md font-semibold text-gray-900">验收记录</h3>
                    {hasPermission('handle_manager') && (
                      <button class="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">+ 新增验收</button>
                    )}
                  </div>

                  {acceptanceRecords.value.length === 0 ? (
                    <div class="text-sm text-gray-500 py-8 text-center">暂无验收记录</div>
                  ) : (
                    <div class="space-y-3">
                      {acceptanceRecords.value.map(r => (
                        <div key={r.id} class="border border-gray-200 rounded-lg p-4">
                          <div class="flex justify-between items-start mb-2">
                            <div class="flex items-center space-x-2">
                              <span class={[
                                'inline-flex px-2 py-0.5 text-xs font-medium rounded',
                                r.result === 'pass' ? 'bg-green-100 text-green-700' :
                                r.result === 'fail' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700',
                              ].join(' ')}>
                                {r.result === 'pass' ? '通过' : r.result === 'fail' ? '不通过' : '待处理'}
                              </span>
                              <span class="text-sm text-gray-500">验收人：{r.acceptor_name}</span>
                            </div>
                            <span class="text-xs text-gray-400">{r.accepted_at}</span>
                          </div>
                          {r.remark && (
                            <div class="text-sm text-gray-700 mb-2">{r.remark}</div>
                          )}
                          {r.anomaly_reason && (
                            <div class="text-xs text-red-600 bg-red-50 p-2 rounded">
                              异常：{r.anomaly_reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">审计轨迹</h2>
            <div class="relative">
              {auditTrails.value.slice().sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              ).map((trail, idx, arr) => (
                <div key={trail.id} class="relative pb-5 last:pb-0">
                  {idx < arr.length - 1 && (
                    <div class="absolute left-2.5 top-6 w-0.5 h-full bg-gray-200"></div>
                  )}
                  <div class="flex items-start space-x-3">
                    <div class="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 z-10">
                      <div class="w-2 h-2 rounded-full bg-blue-500"></div>
                    </div>
                    <div class="flex-1">
                      <div class="flex items-baseline space-x-2">
                        <span class="text-sm font-medium text-gray-900">{trail.action}</span>
                        <span class="text-xs text-gray-500">{trail.actor_name}（{trail.actor_role}）</span>
                      </div>
                      <div class="text-xs text-gray-400 mt-0.5">{trail.created_at}</div>
                      {trail.remark && (
                        <div class="text-sm text-gray-600 mt-1">{trail.remark}</div>
                      )}
                      {trail.anomaly_reason && (
                        <div class="text-xs text-red-600 mt-1">异常：{trail.anomaly_reason}</div>
                      )}
                      {(trail.from_status || trail.to_status) && (
                        <div class="text-xs text-gray-500 mt-1">
                          {trail.from_status && <span>{STATUS_LABELS[trail.from_status as keyof typeof STATUS_LABELS] || trail.from_status}</span>}
                          {trail.from_status && trail.to_status && <span class="mx-1">→</span>}
                          {trail.to_status && <span class="font-medium">{STATUS_LABELS[trail.to_status as keyof typeof STATUS_LABELS] || trail.to_status}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showHandleDialog.value && (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div class="px-6 py-4 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">
                {handleResult.value === 'submit' && '提交巡检单'}
                {handleResult.value === 'dispatch' && '派发巡检单'}
                {handleResult.value === 'handle' && '办理巡检单'}
                {handleResult.value === 'return' && '退回巡检单'}
                {handleResult.value === 'review' && '复核巡检单'}
              </h3>
            </div>
            <div class="p-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">处理意见</label>
              <textarea
                value={handleOpinion.value}
                onInput$={(e) => handleOpinion.value = (e.target as HTMLTextAreaElement).value}
                rows={4}
                placeholder="请输入处理意见..."
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick$={() => { showHandleDialog.value = false; handleOpinion.value = ''; }}
                class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick$={confirmHandle$}
                class={[
                  'px-4 py-2 text-white rounded-md font-medium',
                  handleResult.value === 'return' ? 'bg-orange-600 hover:bg-orange-700' :
                  'bg-blue-600 hover:bg-blue-700',
                ].join(' ')}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
