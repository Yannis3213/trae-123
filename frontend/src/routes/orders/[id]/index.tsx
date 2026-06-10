import { component$, useStore, useVisibleTask$, $ } from '@builder.io/qwik';
import { useNavigate, useLocation } from '@builder.io/qwik-city';
import { AppLayout } from '~/components/app-layout';
import type { TourOrder, ProcessingRecord, Attachment, AuditNote, User, OrderStatus, UserRole, EvidenceType } from '~/types';
import { STATUS_LABELS, STATUS_BADGE, ROLE_LABELS, EVIDENCE_LABELS } from '~/types';
import { api, ApiError } from '~/utils/api';

const fmtDate = (s: string) => {
  try {
    return new Date(s).toLocaleString('zh-CN', { hour12: false });
  } catch { return s; }
};

const fmtMoney = (n: number) => `¥${n.toLocaleString()}`;

interface ActionMeta {
  target: OrderStatus;
  label: string;
  btnClass: string;
  required: EvidenceType[];
  submitLabel: string;
  formType: 'submit-audit' | 'back-correction' | 'audit-pass' | 'correction-resubmit' | 'review-archive' | 'review-back';
}

const getActionMeta = (order: TourOrder, role: UserRole): ActionMeta[] => {
  const list: ActionMeta[] = [];
  if (role === 'registrar') {
    if (order.status === 'draft') {
      list.push({
        target: 'pending_audit',
        label: '📤 提交审核（线路报价已核验）',
        btnClass: 'btn-primary',
        required: ['route_quote'],
        submitLabel: '确认提交审核',
        formType: 'submit-audit',
      });
    }
    if (order.status === 'pending_correction') {
      list.push({
        target: 'pending_audit',
        label: '✅ 补正后重新提交审核',
        btnClass: 'btn-success',
        required: ['route_quote'],
        submitLabel: '提交补正后订单',
        formType: 'correction-resubmit',
      });
    }
  }
  if (role === 'auditor') {
    if (order.status === 'pending_audit') {
      list.push({
        target: 'pending_review',
        label: '✅ 审核通过，进入复核归档',
        btnClass: 'btn-success',
        required: ['route_quote', 'registration_confirm'],
        submitLabel: '确认审核通过',
        formType: 'audit-pass',
      });
      list.push({
        target: 'pending_correction',
        label: '↩ 退回补正',
        btnClass: 'btn-warning',
        required: [],
        submitLabel: '确认退回',
        formType: 'back-correction',
      });
    }
  }
  if (role === 'reviewer') {
    if (order.status === 'pending_review') {
      list.push({
        target: 'archived',
        label: '📦 复核归档（三类证据齐全）',
        btnClass: 'btn-success',
        required: ['route_quote', 'registration_confirm', 'tour_audit'],
        submitLabel: '确认归档',
        formType: 'review-archive',
      });
      list.push({
        target: 'pending_correction',
        label: '↩ 复核退回补正',
        btnClass: 'btn-warning',
        required: [],
        submitLabel: '确认退回',
        formType: 'review-back',
      });
    }
  }
  return list;
};

const getPhaseTitle = (status: OrderStatus, role: UserRole): { name: string; desc: string; variant: 'info' | 'warning' | 'success' | 'danger' | 'draft' } => {
  if (role === 'registrar') {
    if (status === 'draft') return { name: '旅游订单登记 · 草稿编辑', desc: '补充线路信息、客户、报价，核验线路报价证据后即可提交审核。', variant: 'info' };
    if (status === 'pending_correction') return { name: '旅游订单登记 · 补正编辑', desc: '审核/复核退回的订单，请根据异常原因补充或更正材料，然后重新提交。', variant: 'warning' };
  }
  if (role === 'auditor') {
    if (status === 'pending_audit') return { name: '过程核验 · 审核办理', desc: '核验线路报价 + 报名确认单据，决定通过至复核或退回补正。', variant: 'info' };
    if (status === 'pending_correction') return { name: '过程核验 · 退回追踪', desc: '退回登记员补正的订单，仅查阅和添加审计备注。', variant: 'warning' };
  }
  if (role === 'reviewer') {
    if (status === 'pending_review') return { name: '复核归档 · 复核办理', desc: '终校三类证据（线路+报名+出团），决定归档或退回补正。', variant: 'info' };
    if (status === 'archived') return { name: '复核归档 · 已归档', desc: '订单已完成闭环，可查阅所有历史与附件。', variant: 'success' };
  }
  return { name: STATUS_LABELS[status], desc: '', variant: 'info' };
};

export default component$(() => {
  const nav = useNavigate();
  const location = useLocation();
  const id = location.params.id;

  const state = useStore<{
    user: User | null;
    order: TourOrder | null;
    records: ProcessingRecord[];
    attachments: Attachment[];
    auditNotes: AuditNote[];
    loading: boolean;
    error: string | null;
    success: string | null;
    showStatusModal: boolean;
    selectedAction: ActionMeta | null;
    statusNote: string;
    exceptionReason: string;
    localEvRoute: boolean;
    localEvReg: boolean;
    localEvTour: boolean;
    showAuditModal: boolean;
    auditContent: string;
    activeTab: 'records' | 'attachments' | 'audit';
    uploadingAtt: boolean;
    newAtt: { file_name: string; file_type: string; file_size: number; evidence_type: EvidenceType };
  }>({
    user: null,
    order: null,
    records: [],
    attachments: [],
    auditNotes: [],
    loading: true,
    error: null,
    success: null,
    showStatusModal: false,
    selectedAction: null,
    statusNote: '',
    exceptionReason: '',
    localEvRoute: false,
    localEvReg: false,
    localEvTour: false,
    showAuditModal: false,
    auditContent: '',
    activeTab: 'records',
    uploadingAtt: false,
    newAtt: { file_name: '', file_type: 'application/pdf', file_size: 0, evidence_type: 'route_quote' },
  });

  useVisibleTask$(() => {
    state.user = api.getCurrentUser();
  });

  const loadData = $(async () => {
    state.loading = true;
    state.error = null;
    try {
      const [order, records, attachments, auditNotes] = await Promise.all([
        api.getOrder(id),
        api.getRecords(id),
        api.getAttachments(id),
        api.getAuditNotes(id),
      ]) as [TourOrder, ProcessingRecord[], Attachment[], AuditNote[]];
      state.order = order;
      state.records = records;
      state.attachments = attachments;
      state.auditNotes = auditNotes;
      state.localEvRoute = !!order.route_quote_evidence;
      state.localEvReg = !!order.registration_confirm_evidence;
      state.localEvTour = !!order.tour_audit_evidence;
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

  useVisibleTask$(({ track }) => {
    track(() => state.user);
    if (state.user) loadData();
  });

  const openStatusModal = $((action: ActionMeta) => {
    if (!state.order) return;
    state.selectedAction = action;
    state.statusNote = '';
    state.exceptionReason = '';
    state.showStatusModal = true;
  });

  const doStatusChange = $(async () => {
    if (!state.order || !state.selectedAction) return;
    try {
      const payload: Record<string, any> = {
        target_status: state.selectedAction.target,
        version: state.order.version,
        route_quote_evidence: state.localEvRoute,
        registration_confirm_evidence: state.localEvReg,
        tour_audit_evidence: state.localEvTour,
      };
      if (state.statusNote.trim()) payload.note = state.statusNote.trim();
      if (state.exceptionReason.trim()) payload.exception_reason = state.exceptionReason.trim();

      const updated = await api.changeStatus(id, payload);
      state.order = updated;
      state.localEvRoute = updated.route_quote_evidence;
      state.localEvReg = updated.registration_confirm_evidence;
      state.localEvTour = updated.tour_audit_evidence;
      state.showStatusModal = false;
      state.success = `状态变更成功：${STATUS_LABELS[state.order.status]}（版本 v${state.order.version}）`;
      setTimeout(() => (state.success = null), 5000);
      state.records = await api.getRecords(id);
    } catch (e: any) {
      const ae = e as ApiError;
      state.error = `${ae.code}: ${ae.error || '操作失败'}`;
      setTimeout(() => (state.error = null), 6000);
    }
  });

  const saveEvidenceOnly = $(async () => {
    if (!state.order) return;
    try {
      const updated = await api.updateOrder(id, {
        route_quote_evidence: state.localEvRoute,
        registration_confirm_evidence: state.localEvReg,
        tour_audit_evidence: state.localEvTour,
        version: state.order.version,
      }) as TourOrder;
      state.order = updated;
      state.success = '证据状态已保存（v' + updated.version + '）';
      setTimeout(() => (state.success = null), 4000);
      state.records = await api.getRecords(id);
    } catch (e: any) {
      state.error = e.error || '保存失败';
    }
  });

  const submitAuditNote = $(async () => {
    if (!state.auditContent.trim()) return;
    try {
      await api.addAuditNote(id, { content: state.auditContent.trim() });
      state.showAuditModal = false;
      state.auditContent = '';
      state.auditNotes = await api.getAuditNotes(id);
      state.success = '审计备注已添加';
      setTimeout(() => (state.success = null), 3000);
    } catch (e: any) {
      state.error = e.error || '添加备注失败';
    }
  });

  const mockUploadAttachment = $(async () => {
    if (!state.order || !state.newAtt.file_name.trim()) {
      state.error = '请填写文件名';
      return;
    }
    try {
      state.uploadingAtt = true;
      await api.uploadAttachment(id, {
        file_name: state.newAtt.file_name.trim(),
        file_type: state.newAtt.file_type,
        file_size: state.newAtt.file_size,
        evidence_type: state.newAtt.evidence_type,
      });
      state.newAtt = { file_name: '', file_type: 'application/pdf', file_size: 0, evidence_type: 'route_quote' };
      state.uploadingAtt = false;
      state.success = '附件已上传，对应证据标记已同步';
      setTimeout(() => (state.success = null), 4000);
      await loadData();
    } catch (e: any) {
      state.uploadingAtt = false;
      state.error = e.error || '上传失败';
    }
  });

  if (state.loading) return <AppLayout><div class="empty-state">加载中...</div></AppLayout>;
  if (!state.order) return <AppLayout><div class="empty-state">订单不存在或无权查看</div></AppLayout>;
  if (!state.user) return <AppLayout><div>加载中...</div></AppLayout>;

  const order = state.order;
  const actions = getActionMeta(order, state.user.role);
  const phase = getPhaseTitle(order.status, state.user.role);

  const canEditEvidence = (order.status === 'draft' || order.status === 'pending_correction')
    ? state.user.role === 'registrar'
    : state.user.role !== 'registrar';

  const isOverdue = () => {
    if (order.is_overdue) return 'overdue';
    if (order.deadline) {
      const d = new Date(order.deadline).getTime();
      const now = Date.now();
      if (d - now < 24 * 3600 * 1000 && d > now) return 'warning';
    }
    return 'normal';
  };
  const overdueState = isOverdue();

  const evidenceList: Array<{ key: EvidenceType; field: 'localEvRoute' | 'localEvReg' | 'localEvTour'; canDisable: boolean }> = [
    { key: 'route_quote', field: 'localEvRoute', canDisable: (order.status === 'draft' || order.status === 'pending_correction') && state.user.role === 'registrar' },
    { key: 'registration_confirm', field: 'localEvReg', canDisable: state.user.role === 'auditor' || state.user.role === 'reviewer' || ((order.status === 'draft' || order.status === 'pending_correction') && state.user.role === 'registrar') },
    { key: 'tour_audit', field: 'localEvTour', canDisable: state.user.role === 'auditor' || state.user.role === 'reviewer' || ((order.status === 'draft' || order.status === 'pending_correction') && state.user.role === 'registrar') },
  ];

  const handlerBadgeColor = () => {
    if (order.status === 'pending_audit') return { bg: '#fef3c7', fg: '#92400e', label: '审核组' };
    if (order.status === 'pending_review') return { bg: '#ede9fe', fg: '#5b21b6', label: '复核组' };
    if (order.status === 'archived') return { bg: '#d1fae5', fg: '#065f46', label: '已归档' };
    if (order.current_handler_name) return { bg: '#dbeafe', fg: '#1e40af', label: order.current_handler_name };
    return { bg: '#e5e7eb', fg: '#374151', label: '—' };
  };
  const hb = handlerBadgeColor();

  const phaseColor = {
    info: 'background:#eff6ff;color:#1d4ed8;',
    warning: 'background:#fff7ed;color:#c2410c;',
    success: 'background:#f0fdf4;color:#166534;',
    danger: 'background:#fef2f2;color:#b91c1c;',
    draft: 'background:#f3f4f6;color:#374151;',
  };

  return (
    <AppLayout>
      <div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:16px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <button class="btn btn-sm" onClick$={() => nav('/orders')}>← 返回列表</button>
            <h2 style="margin:0; font-size:20px;">{order.order_no} · {order.route_name}</h2>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            {actions.map(a => (
              <button
                key={a.target + a.label}
                class={`btn ${a.btnClass}`}
                onClick$={() => openStatusModal(a)}
                disabled={order.is_overdue && (a.target === 'pending_audit' || a.target === 'pending_review')}
              >
                {a.label}
              </button>
            ))}
            {(state.user.role === 'auditor' || state.user.role === 'reviewer') && (
              <button class="btn" onClick$={() => (state.showAuditModal = true)}>+ 审计备注</button>
            )}
          </div>
        </div>

        {state.error && <div class="alert alert-error">{state.error}</div>}
        {state.success && <div class="alert alert-success">{state.success}</div>}

        <div class="card" style="margin-bottom:16px;">
          <div style={`padding: 14px 18px; border-radius: 8px; ${phaseColor[phase.variant]}; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;`}>
            <div>
              <div style="font-weight:700; font-size:15px;">● {phase.name}</div>
              {phase.desc && <div style="opacity:0.85; font-size:13px; margin-top:4px; line-height:1.6;">{phase.desc}</div>}
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <span class={`badge ${STATUS_BADGE[order.status]}`} style="font-size:13px; padding:6px 12px;">{STATUS_LABELS[order.status]}</span>
              {overdueState === 'overdue' && <span class="badge badge-overdue" style="font-size:13px;">已逾期</span>}
              {overdueState === 'warning' && <span class="badge badge-warning" style="font-size:13px;">临期</span>}
              <span style={`padding:6px 12px; border-radius:999px; font-size:13px; font-weight:600; background:${hb.bg}; color:${hb.fg};`}>
                当前责任人: {hb.label}
              </span>
              <span style={`padding:6px 12px; border-radius:999px; font-size:13px; font-weight:600; background:#fafafa; color:#374151; border:1px solid #e5e7eb;`}>
                版本 v{order.version}
              </span>
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 2fr 1fr; gap: 16px;">
          <div>
            <div class="card" style="margin-bottom:16px;">
              <div class="card-header">
                <h3 class="card-title">订单基本信息</h3>
              </div>
              <div class="card-body">
                <div class="detail-grid">
                  <div class="detail-item"><span class="detail-label">订单号：</span><span class="detail-value" style="font-family:monospace;">{order.order_no}</span></div>
                  <div class="detail-item"><span class="detail-label">客户：</span><span class="detail-value">{order.customer_name} · {order.customer_phone}</span></div>
                  <div class="detail-item"><span class="detail-label">线路名称：</span><span class="detail-value">{order.route_name}</span></div>
                  <div class="detail-item"><span class="detail-label">总报价：</span><span class="detail-value" style="color:var(--primary); font-weight:700;">{fmtMoney(order.quoted_price)}</span></div>
                  <div class="detail-item"><span class="detail-label">出游人数：</span><span class="detail-value">{order.traveler_count} 人</span></div>
                  <div class="detail-item"><span class="detail-label">出发 / 返程：</span><span class="detail-value">{fmtDate(order.departure_date)} ~ {fmtDate(order.return_date)}</span></div>
                  <div class="detail-item"><span class="detail-label">办理截止：</span><span class={`detail-value ${overdueState === 'overdue' ? 'text-danger' : ''}`}>{order.deadline ? fmtDate(order.deadline) : '未设置'}</span></div>
                  <div class="detail-item"><span class="detail-label">最近更新：</span><span class="detail-value">{fmtDate(order.updated_at)}</span></div>
                </div>

                {order.correction_note && (
                  <div style="margin-top:16px; padding:12px; background:#fffbeb; border-radius:6px; border:1px solid #fde68a;">
                    <div style="font-weight:600; color:#92400e; margin-bottom:4px;">📌 退回补正说明：</div>
                    <div style="color:#78350f; line-height:1.7;">{order.correction_note}</div>
                  </div>
                )}
                {order.exception_reason && (
                  <div style="margin-top:8px; padding:12px; background:#fef2f2; border-radius:6px; border:1px solid #fecaca;">
                    <div style="font-weight:600; color:#991b1b; margin-bottom:4px;">⚠️ 异常原因：</div>
                    <div style="color:#7f1d1d; line-height:1.7;">{order.exception_reason}</div>
                  </div>
                )}
              </div>
            </div>

            {/* 登记补正表单 - 仅登记员可见 */}
            {(state.user.role === 'registrar' && (order.status === 'draft' || order.status === 'pending_correction')) && (
              <div class="card" style="margin-bottom:16px; border:1px solid #bfdbfe; background:#f8fafc;">
                <div class="card-header" style="background:#eff6ff;">
                  <h3 class="card-title" style="color:#1e40af;">📝 {order.status === 'draft' ? '旅游订单登记表' : '补正修改表单'}</h3>
                </div>
                <div class="card-body">
                  <div style="margin-bottom:12px; font-size:13px; color:#1e40af; padding:8px 12px; background:#dbeafe; border-radius:6px; line-height:1.6;">
                    {order.status === 'draft'
                      ? '完成必填信息 + 线路报价证据勾选后，点击「提交审核」进入过程核验环节。草稿可随时修改。'
                      : '根据退回异常原因补正后，勾选「线路报价证据」重新提交审核。补正过程将被记录。'}
                  </div>

                  <div style="font-size:13px; font-weight:600; margin-bottom:10px; color:#374151;">证据核验</div>
                  {evidenceList.map(ev => {
                    const checked = state[ev.field];
                    return (
                      <label key={ev.key} class={`evidence-row ${checked ? 'evidence-row-checked' : ''}`} style={{ marginBottom: '8px' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!ev.canDisable}
                          onChange$={(e: any) => { (state as any)[ev.field] = e.target.checked; }}
                        />
                        <div style="flex:1;">
                          <div style="font-weight:600;">{EVIDENCE_LABELS[ev.key]}</div>
                          <div style="font-size:12px; color:var(--text-secondary);">
                            {ev.key === 'route_quote' ? '线路报价签字/盖章（提交必填）' :
                              ev.key === 'registration_confirm' ? '报名确认表和客户身份证（审核必填）' :
                              '出团通知书+行程+导游确认（归档必填）'}
                          </div>
                        </div>
                        <span class={checked ? 'evidence-ok' : 'evidence-missing'}>
                          {checked ? '✓ 已核验' : '✗ 未核验'}
                        </span>
                      </label>
                    );
                  })}

                  <div style="margin-top: 12px; display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn" onClick$={saveEvidenceOnly}>💾 保存证据/草稿</button>
                    {order.status === 'draft' && actions.find(a => a.formType === 'submit-audit') && (
                      <button class="btn btn-primary" onClick$={() => openStatusModal(actions.find(a => a.formType === 'submit-audit')!)}>📤 提交审核</button>
                    )}
                    {order.status === 'pending_correction' && actions.find(a => a.formType === 'correction-resubmit') && (
                      <button class="btn btn-success" onClick$={() => openStatusModal(actions.find(a => a.formType === 'correction-resubmit')!)}>✅ 补正后提交</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 过程核验表单 - 审核主管 */}
            {state.user.role === 'auditor' && order.status === 'pending_audit' && (
              <div class="card" style="margin-bottom:16px; border:1px solid #fde68a; background:#fffbeb;">
                <div class="card-header" style="background:#fef3c7;">
                  <h3 class="card-title" style="color:#92400e;">🔍 过程核验表单</h3>
                </div>
                <div class="card-body">
                  <div style="margin-bottom:12px; font-size:13px; color:#92400e; padding:8px 12px; background:#fde68a; border-radius:6px; line-height:1.6;">
                    审核通过需满足：线路报价证据 ✓ + 报名确认证据 ✓。退回补正需填写异常原因，将由登记员补正后重新提交。
                  </div>
                  <div style="font-size:13px; font-weight:600; margin-bottom:10px; color:#374151;">证据核验（审核岗确认）</div>
                  {evidenceList.map(ev => {
                    const checked = state[ev.field];
                    return (
                      <label key={ev.key} class={`evidence-row ${checked ? 'evidence-row-checked' : ''}`} style={{ marginBottom: '8px' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!ev.canDisable}
                          onChange$={(e: any) => { (state as any)[ev.field] = e.target.checked; }}
                        />
                        <div style="flex:1;">
                          <div style="font-weight:600;">{EVIDENCE_LABELS[ev.key]}</div>
                          <div style="font-size:12px; color:var(--text-secondary);">
                            {ev.key === 'route_quote' ? '审核员确认报价无误' :
                              ev.key === 'registration_confirm' ? '审核员确认报名资料齐全' :
                              '审核员确认出团准备工作'}
                          </div>
                        </div>
                        <span class={checked ? 'evidence-ok' : 'evidence-missing'}>
                          {checked ? '✓' : '✗'}
                        </span>
                      </label>
                    );
                  })}

                  <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
                    {actions.find(a => a.formType === 'audit-pass') && (
                      <button class="btn btn-success" onClick$={() => openStatusModal(actions.find(a => a.formType === 'audit-pass')!)}>✅ 审核通过 → 待复核</button>
                    )}
                    {actions.find(a => a.formType === 'back-correction') && (
                      <button class="btn btn-warning" onClick$={() => openStatusModal(actions.find(a => a.formType === 'back-correction')!)}>↩ 退回补正</button>
                    )}
                    <button class="btn" onClick$={saveEvidenceOnly}>💾 仅保存证据</button>
                  </div>
                </div>
              </div>
            )}

            {/* 复核归档表单 - 复核负责人 */}
            {state.user.role === 'reviewer' && order.status === 'pending_review' && (
              <div class="card" style="margin-bottom:16px; border:1px solid #a7f3d0; background:#f0fdf4;">
                <div class="card-header" style="background:#d1fae5;">
                  <h3 class="card-title" style="color:#065f46;">🏛️ 复核归档表单</h3>
                </div>
                <div class="card-body">
                  <div style="margin-bottom:12px; font-size:13px; color:#065f46; padding:8px 12px; background:#a7f3d0; border-radius:6px; line-height:1.6;">
                    复核归档需满足：报价 ✓ + 报名 ✓ + 出团 ✓ 三类证据齐全。如发现问题可退回补正，异常原因将持久化留存。
                  </div>
                  <div style="font-size:13px; font-weight:600; margin-bottom:10px; color:#374151;">三类证据终校</div>
                  {evidenceList.map(ev => {
                    const checked = state[ev.field];
                    return (
                      <label key={ev.key} class={`evidence-row ${checked ? 'evidence-row-checked' : ''}`} style={{ marginBottom: '8px' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!ev.canDisable}
                          onChange$={(e: any) => { (state as any)[ev.field] = e.target.checked; }}
                        />
                        <div style="flex:1;">
                          <div style="font-weight:600;">{EVIDENCE_LABELS[ev.key]}</div>
                          <div style="font-size:12px; color:var(--text-secondary);">终校签字</div>
                        </div>
                        <span class={checked ? 'evidence-ok' : 'evidence-missing'}>
                          {checked ? '✓ 终校通过' : '✗ 缺失或需补正'}
                        </span>
                      </label>
                    );
                  })}

                  <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
                    {actions.find(a => a.formType === 'review-archive') && (
                      <button class="btn btn-success" onClick$={() => openStatusModal(actions.find(a => a.formType === 'review-archive')!)}>📦 复核归档</button>
                    )}
                    {actions.find(a => a.formType === 'review-back') && (
                      <button class="btn btn-warning" onClick$={() => openStatusModal(actions.find(a => a.formType === 'review-back')!)}>↩ 退回补正</button>
                    )}
                    <button class="btn" onClick$={saveEvidenceOnly}>💾 保存证据标记</button>
                  </div>
                </div>
              </div>
            )}

            <div class="card">
              <div class="tabs">
                <div class={`tab ${state.activeTab === 'records' ? 'active' : ''}`} onClick$={() => (state.activeTab = 'records')}>
                  📋 处理记录时间线 ({state.records.length})
                </div>
                <div class={`tab ${state.activeTab === 'attachments' ? 'active' : ''}`} onClick$={() => (state.activeTab = 'attachments')}>
                  📎 附件证据 ({state.attachments.length})
                </div>
                <div class={`tab ${state.activeTab === 'audit' ? 'active' : ''}`} onClick$={() => (state.activeTab = 'audit')}>
                  📝 审计备注 ({state.auditNotes.length})
                </div>
              </div>
              <div class="card-body" style="padding-top: 0;">
                {state.activeTab === 'records' && (
                  state.records.length === 0 ? (
                    <div class="empty-state">暂无处理记录</div>
                  ) : (
                    <div class="timeline">
                      {state.records.map(r => (
                        <div key={r.id} class="timeline-item">
                          <div class="timeline-action">
                            {r.action}
                            {r.from_status && ` (${STATUS_LABELS[r.from_status as OrderStatus]} → ${STATUS_LABELS[r.to_status as OrderStatus]})`}
                          </div>
                          <div class="timeline-meta">
                            <span class="role-tag">{ROLE_LABELS[r.handler_role as UserRole]}</span>
                            <span style="margin: 0 8px;">{r.handler_name}</span>
                            <span style="opacity:0.7;">{fmtDate(r.created_at)}</span>
                          </div>
                          {r.note && <div class="timeline-note">💬 {r.note}</div>}
                          {r.exception_reason && (
                            <div class="timeline-note" style="background:#fef2f2; color:#991b1b;">
                              ⚠️ 异常: {r.exception_reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {state.activeTab === 'attachments' && (
                  <>
                    {!['archived'].includes(order.status) && (
                      <div class="card" style="border:1px dashed #d1d5db; background:#fafafa; margin-bottom:12px;">
                        <div class="card-header" style="background:transparent; padding: 10px 14px; border-bottom: 1px dashed #e5e7eb;">
                          <h3 class="card-title" style="font-size: 14px; margin: 0;">📤 上传新附件（模拟上传，会自动刷新对应证据标记）</h3>
                        </div>
                        <div class="card-body" style="padding: 12px;">
                          <div class="form-row">
                            <div class="form-group">
                              <label class="form-label">文件名 *</label>
                              <input class="form-input" placeholder="如：TO-2026...线路报价单.pdf"
                                value={state.newAtt.file_name}
                                onInput$={(e: any) => (state.newAtt.file_name = e.target.value)} />
                            </div>
                            <div class="form-group">
                              <label class="form-label">证据类型</label>
                              <select class="form-select" value={state.newAtt.evidence_type}
                                onChange$={(e: any) => (state.newAtt.evidence_type = e.target.value as EvidenceType)}>
                                <option value="route_quote">{EVIDENCE_LABELS['route_quote']}</option>
                                <option value="registration_confirm">{EVIDENCE_LABELS['registration_confirm']}</option>
                                <option value="tour_audit">{EVIDENCE_LABELS['tour_audit']}</option>
                              </select>
                            </div>
                          </div>
                          <div class="form-row">
                            <div class="form-group">
                              <label class="form-label">文件类型</label>
                              <input class="form-input" value={state.newAtt.file_type}
                                onInput$={(e: any) => (state.newAtt.file_type = e.target.value)} />
                            </div>
                            <div class="form-group">
                              <label class="form-label">文件大小 (字节)</label>
                              <input type="number" class="form-input" min="0"
                                value={state.newAtt.file_size}
                                onInput$={(e: any) => (state.newAtt.file_size = parseInt(e.target.value) || 0)} />
                            </div>
                          </div>
                          <button
                            class="btn btn-primary btn-sm"
                            onClick$={mockUploadAttachment}
                            disabled={state.uploadingAtt}
                          >
                            {state.uploadingAtt ? '上传中...' : '📤 上传附件并标记证据'}
                          </button>
                        </div>
                      </div>
                    )}
                    {state.attachments.length === 0 ? (
                      <div class="empty-state">暂无附件（上传附件后会自动勾选对应证据并写入处理记录）</div>
                    ) : (
                      <table class="table">
                        <thead>
                          <tr>
                            <th>文件名</th>
                            <th>类型</th>
                            <th>证据分类</th>
                            <th>大小</th>
                            <th>上传人</th>
                            <th>上传时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.attachments.map(a => (
                            <tr key={a.id}>
                              <td>{a.file_name}</td>
                              <td>{a.file_type}</td>
                              <td>{EVIDENCE_LABELS[a.evidence_type as EvidenceType] || a.evidence_type}</td>
                              <td>{(a.file_size / 1024).toFixed(1)} KB</td>
                              <td>{a.uploaded_by_name}</td>
                              <td>{fmtDate(a.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}

                {state.activeTab === 'audit' && (
                  state.auditNotes.length === 0 ? (
                    <div class="empty-state">暂无审计备注</div>
                  ) : (
                    state.auditNotes.map(n => (
                      <div key={n.id} style="padding: 12px 0; border-bottom: 1px solid var(--border);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap: 8px; flex-wrap: wrap;">
                          <div>
                            <span style="font-weight:600;">{n.created_by_name}</span>
                            <span style="margin: 0 6px; opacity:0.5;">·</span>
                            <span style="font-size:12px; color:var(--text-secondary);">{fmtDate(n.created_at)}</span>
                          </div>
                        </div>
                        <div style="line-height:1.7; white-space: pre-wrap;">{n.content}</div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>
          </div>

          {/* 右侧固定区 */}
          <div>
            <div class="card" style="margin-bottom:16px;">
              <div class="card-header"><h3 class="card-title">🔒 证据核验总览</h3></div>
              <div class="card-body">
                {evidenceList.map(ev => {
                  const checked = state[ev.field];
                  return (
                    <label
                      key={ev.key}
                      class={`evidence-row ${checked ? 'evidence-row-checked' : ''}`}
                      style={{ marginBottom: '8px', padding: '10px 12px', borderRadius: '6px', border: `1px solid ${checked ? '#bbf7d0' : '#e5e7eb'}`, background: checked ? '#f0fdf4' : '#fff' }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canEditEvidence}
                        onChange$={(e: any) => { (state as any)[ev.field] = e.target.checked; }}
                      />
                      <div style="flex:1;">
                        <div style="font-weight:600;">{EVIDENCE_LABELS[ev.key]}</div>
                      </div>
                      <span class={checked ? 'evidence-ok' : 'evidence-missing'}>
                        {checked ? '✓' : '✗'}
                      </span>
                    </label>
                  );
                })}

                {canEditEvidence && (
                  <>
                    <button class="btn btn-sm btn-primary" style="width: 100%; margin-top: 10px;" onClick$={saveEvidenceOnly}>
                      💾 保存证据状态
                    </button>
                    <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary); line-height:1.7;">
                      提示：也可在状态变更时一同勾选并保存证据。版本号会随每次变更递增。
                    </div>
                  </>
                )}
              </div>
            </div>

            <div class="card" style="margin-bottom:16px;">
              <div class="card-header"><h3 class="card-title">🗂 流转摘要</h3></div>
              <div class="card-body" style="font-size: 13px; line-height: 2;">
                <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-secondary);">当前状态：</span><span class={`badge ${STATUS_BADGE[order.status]}`}>{STATUS_LABELS[order.status]}</span></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-secondary);">版本：</span><span style="font-weight:600;">v{order.version}</span></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-secondary);">处理记录：</span><span style="font-weight:600;">{state.records.length} 条</span></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-secondary);">附件数：</span><span style="font-weight:600;">{state.attachments.length}</span></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-secondary);">证据齐备：</span><span style="font-weight:600;">
                  {[state.localEvRoute, state.localEvReg, state.localEvTour].filter(Boolean).length}/3
                </span></div>
              </div>
            </div>
          </div>
        </div>

        {/* 状态变更模态 */}
        {state.showStatusModal && state.selectedAction && (
          <div class="modal-overlay" onClick$={e => { if ((e.target as HTMLElement).className === 'modal-overlay') state.showStatusModal = false; }}>
            <div class="modal" style="max-width: 760px;">
              <div class="modal-header">
                <h3 class="modal-title">{state.selectedAction.label}</h3>
                <button class="btn btn-sm" onClick$={() => (state.showStatusModal = false)}>×</button>
              </div>
              <div class="modal-body">
                <div style="margin-bottom:16px; padding: 12px 14px; border-radius:6px; background:#f8fafc; border:1px solid #e5e7eb; font-size:13px;">
                  <div style="font-weight:600; margin-bottom:4px;">流转：
                    <span class={`badge ${STATUS_BADGE[order.status]}`} style="margin:0 4px;">{STATUS_LABELS[order.status]}</span>
                    →
                    <span class={`badge ${STATUS_BADGE[state.selectedAction.target]}`} style="margin:0 4px;">{STATUS_LABELS[state.selectedAction.target]}</span>
                  </div>
                  <div style="color: var(--text-secondary);">
                    当前版本 v{order.version}，提交成功后自动递增为 v{order.version + 1}。
                  </div>
                </div>

                {state.selectedAction.required.length > 0 && (
                  <div style="margin-bottom:16px;">
                    <div class="section-title" style="margin-bottom:10px;">🧾 必填证据（共 {state.selectedAction.required.length} 项）</div>
                    {state.selectedAction.required.map(e => {
                      const checked = e === 'route_quote' ? state.localEvRoute
                        : e === 'registration_confirm' ? state.localEvReg
                        : state.localEvTour;
                      return (
                        <label key={e} class={`evidence-row ${checked ? 'evidence-row-checked' : ''}`} style="margin-bottom:8px;">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange$={(ev: any) => {
                              if (e === 'route_quote') state.localEvRoute = ev.target.checked;
                              if (e === 'registration_confirm') state.localEvReg = ev.target.checked;
                              if (e === 'tour_audit') state.localEvTour = ev.target.checked;
                            }}
                          />
                          <div style="flex:1;">
                            <div style="font-weight:600;">{EVIDENCE_LABELS[e]}</div>
                            <div style="font-size:12px; color:var(--text-secondary);">必须</div>
                          </div>
                          <span class={checked ? 'evidence-ok' : 'evidence-missing'}>
                            {checked ? '✓ 已准备' : '✗ 未准备'}
                          </span>
                        </label>
                      );
                    })}
                    <div style="font-size: 12px; color: #92400e; background: #fffbeb; padding: 8px 10px; border-radius: 6px; margin-top:4px;">
                      后端会再次校验必填证据，缺任意一项将被 400 MISSING_EVIDENCE 拦截。
                    </div>
                  </div>
                )}

                <div class="form-group">
                  <label class="form-label">处理备注 {state.selectedAction.formType === 'back-correction' || state.selectedAction.formType === 'review-back' ? '（建议填写）' : '（可选）'}</label>
                  <textarea
                    class="form-textarea"
                    rows={3}
                    placeholder={state.selectedAction.formType === 'back-correction' || state.selectedAction.formType === 'review-back'
                      ? '请填写退回补正的具体要求，登记员将据此修改...'
                      : '请输入处理说明（如已核验的文件、经办日期等）...'}
                    value={state.statusNote}
                    onInput$={(e: any) => (state.statusNote = e.target.value)}
                  />
                </div>

                {state.selectedAction.formType === 'back-correction' || state.selectedAction.formType === 'review-back' ? (
                  <div class="form-group">
                    <label class="form-label">异常原因 *（退回必填，会持久化展示）</label>
                    <textarea
                      class="form-textarea"
                      rows={4}
                      placeholder="请填写具体异常原因（如：报价单未签字、身份证信息缺失、导游未确认出发等）..."
                      value={state.exceptionReason}
                      onInput$={(e: any) => (state.exceptionReason = e.target.value)}
                    />
                  </div>
                ) : null}

                <div style="font-size:12px; color: var(--text-secondary); line-height:1.8;">
                  ✋ 提交后订单的责任人将自动切换：
                  {state.selectedAction.target === 'pending_audit' ? '审核组' :
                    state.selectedAction.target === 'pending_review' ? '复核组' :
                    state.selectedAction.target === 'pending_correction' ? '原登记员' :
                    '（归档后无责任人）'}
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn" onClick$={() => (state.showStatusModal = false)}>取消</button>
                <button class="btn btn-primary" onClick$={doStatusChange}>{state.selectedAction.submitLabel}</button>
              </div>
            </div>
          </div>
        )}

        {/* 审计备注模态 */}
        {state.showAuditModal && (
          <div class="modal-overlay" onClick$={e => { if ((e.target as HTMLElement).className === 'modal-overlay') state.showAuditModal = false; }}>
            <div class="modal">
              <div class="modal-header">
                <h3 class="modal-title">添加审计备注（仅审核/复核角色可加）</h3>
                <button class="btn btn-sm" onClick$={() => (state.showAuditModal = false)}>×</button>
              </div>
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label">备注内容</label>
                  <textarea
                    class="form-textarea"
                    rows={6}
                    placeholder="请输入审计备注内容（如：注意事项、风险点、建议等）..."
                    value={state.auditContent}
                    onInput$={(e: any) => (state.auditContent = e.target.value)}
                  />
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn" onClick$={() => (state.showAuditModal = false)}>取消</button>
                <button class="btn btn-primary" onClick$={submitAuditNote}>提交</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
});
