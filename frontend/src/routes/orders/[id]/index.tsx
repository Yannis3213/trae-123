import { component$, useStore, useVisibleTask$, $ } from '@builder.io/qwik';
import { useNavigate, useLocation } from '@builder.io/qwik-city';
import { AppLayout } from '~/components/app-layout';
import type { TourOrder, ProcessingRecord, Attachment, AuditNote, User, OrderStatus, UserRole } from '~/types';
import { STATUS_LABELS, STATUS_BADGE, ROLE_LABELS } from '~/types';
import { api } from '~/utils/api';

const fmtDate = (s: string) => {
  try {
    return new Date(s).toLocaleString('zh-CN');
  } catch { return s; }
};

const fmtMoney = (n: number) => `¥${n.toLocaleString()}`;

const getStatusActions = (order: TourOrder, role: UserRole) => {
  const actions: { target: OrderStatus; label: string; btnClass: string }[] = [];
  if (role === 'registrar') {
    if (order.status === 'draft') {
      actions.push({ target: 'pending_audit', label: '提交审核', btnClass: 'btn-primary' });
    }
    if (order.status === 'pending_correction') {
      actions.push({ target: 'pending_audit', label: '补正后提交', btnClass: 'btn-success' });
    }
  }
  if (role === 'auditor') {
    if (order.status === 'pending_audit') {
      actions.push({ target: 'pending_review', label: '审核通过待复核', btnClass: 'btn-success' });
      actions.push({ target: 'pending_correction', label: '退回补正', btnClass: 'btn-warning' });
    }
  }
  if (role === 'reviewer') {
    if (order.status === 'pending_review') {
      actions.push({ target: 'archived', label: '复核归档', btnClass: 'btn-success' });
      actions.push({ target: 'pending_correction', label: '退回补正', btnClass: 'btn-warning' });
    }
  }
  return actions;
};

const getRequiredEvidence = (from: OrderStatus, to: OrderStatus): string[] => {
  if (from === 'draft' && to === 'pending_audit') return ['route_quote_evidence'];
  if (from === 'pending_audit' && to === 'pending_review') return ['route_quote_evidence', 'registration_confirm_evidence'];
  if (from === 'pending_correction' && to === 'pending_audit') return ['route_quote_evidence'];
  if (from === 'pending_review' && to === 'archived') return ['route_quote_evidence', 'registration_confirm_evidence', 'tour_audit_evidence'];
  return [];
};

const EVIDENCE_LABELS: Record<string, string> = {
  route_quote_evidence: '线路报价证据',
  registration_confirm_evidence: '报名确认证据',
  tour_audit_evidence: '出团审核证据',
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
    selectedTarget: OrderStatus | null;
    statusNote: string;
    exceptionReason: string;
    localRouteQuote: boolean;
    localRegistration: boolean;
    localTourAudit: boolean;
    showAuditModal: boolean;
    auditContent: string;
    activeTab: string;
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
    selectedTarget: null,
    statusNote: '',
    exceptionReason: '',
    localRouteQuote: false,
    localRegistration: false,
    localTourAudit: false,
    showAuditModal: false,
    auditContent: '',
    activeTab: 'detail',
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
      ]);
      state.order = order;
      state.records = records;
      state.attachments = attachments;
      state.auditNotes = auditNotes;
      state.localRouteQuote = order.route_quote_evidence ?? false;
      state.localRegistration = order.registration_confirm_evidence ?? false;
      state.localTourAudit = order.tour_audit_evidence ?? false;
    } catch (e: any) {
      state.error = e?.error || '加载失败';
    } finally {
      state.loading = false;
    }
  });

  useVisibleTask$(({ track }) => {
    track(() => state.user);
    if (state.user) loadData();
  });

  const openStatusModal = $((target: OrderStatus) => {
    if (!state.order) return;
    state.selectedTarget = target;
    state.statusNote = '';
    state.exceptionReason = '';
    const required = getRequiredEvidence(state.order.status, target);
    state.localRouteQuote = state.order.route_quote_evidence ?? required.includes('route_quote_evidence') ? state.order.route_quote_evidence ?? false : state.localRouteQuote;
    state.localRegistration = state.order.registration_confirm_evidence ?? required.includes('registration_confirm_evidence') ? state.order.registration_confirm_evidence ?? false : state.localRegistration;
    state.localTourAudit = state.order.tour_audit_evidence ?? required.includes('tour_audit_evidence') ? state.order.tour_audit_evidence ?? false : state.localTourAudit;
    state.showStatusModal = true;
  });

  const doStatusChange = $(async () => {
    if (!state.order || !state.selectedTarget) return;
    try {
      const payload: Record<string, any> = {
        target_status: state.selectedTarget,
        version: state.order.version,
      };
      if (state.statusNote) payload.note = state.statusNote;
      if (state.exceptionReason) payload.exception_reason = state.exceptionReason;
      payload.route_quote_evidence = state.localRouteQuote;
      payload.registration_confirm_evidence = state.localRegistration;
      payload.tour_audit_evidence = state.localTourAudit;

      await api.changeStatus(id, payload);
      state.showStatusModal = false;
      state.success = '状态变更成功';
      setTimeout(() => (state.success = null), 3000);
      await loadData();
    } catch (e: any) {
      state.error = e?.error || '操作失败';
      setTimeout(() => (state.error = null), 5000);
    }
  });

  const submitAuditNote = $(async () => {
    if (!state.auditContent.trim()) return;
    try {
      await api.addAuditNote(id, { content: state.auditContent });
      state.showAuditModal = false;
      state.auditContent = '';
      await loadData();
    } catch (e: any) {
      state.error = e?.error || '添加备注失败';
    }
  });

  if (state.loading) return <AppLayout><div class="empty-state">加载中...</div></AppLayout>;
  if (!state.order) return <AppLayout><div class="empty-state">订单不存在或无权查看</div></AppLayout>;
  if (!state.user) return <AppLayout><div>加载中...</div></AppLayout>;

  const order = state.order;
  const actions = getStatusActions(order, state.user.role);
  const canEdit = (order.status === 'draft' || order.status === 'pending_correction') && state.user.role === 'registrar';
  const canAuditNote = state.user.role === 'auditor' || state.user.role === 'reviewer';

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

  return (
    <AppLayout>
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <button class="btn btn-sm" onClick$={() => nav('/orders')}>← 返回列表</button>
            <h2 style="margin: 0; font-size: 20px;">订单详情</h2>
          </div>
          <div style="display: flex; gap: 8px;">
            {actions.map(a => (
              <button key={a.target} class={`btn ${a.btnClass}`} onClick$={() => openStatusModal(a.target)}>
                {a.label}
              </button>
            ))}
            {canAuditNote && (
              <button class="btn" onClick$={() => (state.showAuditModal = true)}>添加审计备注</button>
            )}
          </div>
        </div>

        {state.error && <div class="alert alert-error">{state.error}</div>}
        {state.success && <div class="alert alert-success">{state.success}</div>}

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
          <div>
            <div class="card" style="margin-bottom: 16px;">
              <div class="card-header">
                <h3 class="card-title">基本信息</h3>
                <div style="display: flex; gap: 8px;">
                  <span class={`badge ${STATUS_BADGE[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                  {overdueState === 'overdue' && <span class="badge badge-overdue">已逾期</span>}
                  {overdueState === 'warning' && <span class="badge badge-warning">临期预警</span>}
                  <span style="font-size: 12px; color: var(--text-secondary);">v{order.version}</span>
                </div>
              </div>
              <div class="card-body">
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="detail-label">订单号：</span>
                    <span class="detail-value" style="font-family: monospace;">{order.order_no}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">线路名称：</span>
                    <span class="detail-value">{order.route_name}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">客户姓名：</span>
                    <span class="detail-value">{order.customer_name}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">联系电话：</span>
                    <span class="detail-value">{order.customer_phone}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">出游人数：</span>
                    <span class="detail-value">{order.traveler_count} 人</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">报价金额：</span>
                    <span class="detail-value" style="color: var(--primary); font-weight: 700;">{fmtMoney(order.quoted_price)}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">出发日期：</span>
                    <span class="detail-value">{fmtDate(order.departure_date)}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">返程日期：</span>
                    <span class="detail-value">{fmtDate(order.return_date)}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">处理截止：</span>
                    <span class={`detail-value ${overdueState === 'overdue' ? 'text-danger' : ''}`}>
                      {order.deadline ? fmtDate(order.deadline) : '未设置'}
                    </span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">创建时间：</span>
                    <span class="detail-value">{fmtDate(order.created_at)}</span>
                  </div>
                </div>

                {order.correction_note && (
                  <div style="margin-top: 16px; padding: 12px; background: #fffbeb; border-radius: 6px; border: 1px solid #fde68a;">
                    <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">退回补正说明：</div>
                    <div style="color: #78350f;">{order.correction_note}</div>
                  </div>
                )}
                {order.exception_reason && (
                  <div style="margin-top: 8px; padding: 12px; background: #fef2f2; border-radius: 6px; border: 1px solid #fecaca;">
                    <div style="font-weight: 600; color: #991b1b; margin-bottom: 4px;">异常原因：</div>
                    <div style="color: #7f1d1d;">{order.exception_reason}</div>
                  </div>
                )}
              </div>
            </div>

            <div class="card">
              <div class="tabs">
                <div class={`tab ${state.activeTab === 'records' ? 'active' : ''}`} onClick$={() => (state.activeTab = 'records')}>
                  处理记录 ({state.records.length})
                </div>
                <div class={`tab ${state.activeTab === 'attachments' ? 'active' : ''}`} onClick$={() => (state.activeTab = 'attachments')}>
                  附件 ({state.attachments.length})
                </div>
                <div class={`tab ${state.activeTab === 'audit' ? 'active' : ''}`} onClick$={() => (state.activeTab = 'audit')}>
                  审计备注 ({state.auditNotes.length})
                </div>
              </div>

              <div class="card-body" style="padding-top: 0;">
                {state.activeTab === 'records' && (
                  <div class="timeline">
                    {state.records.length === 0 ? (
                      <div class="empty-state">暂无处理记录</div>
                    ) : state.records.map(r => (
                      <div key={r.id} class="timeline-item">
                        <div class="timeline-action">
                          {r.action}
                          {r.from_status && ` (${STATUS_LABELS[r.from_status as OrderStatus]} → ${STATUS_LABELS[r.to_status as OrderStatus]})`}
                        </div>
                        <div class="timeline-meta">
                          <span class="role-tag">{ROLE_LABELS[r.handler_role as UserRole]}</span>
                          <span style="margin: 0 8px;">{r.handler_name}</span>
                          <span>{fmtDate(r.created_at)}</span>
                        </div>
                        {r.note && <div class="timeline-note">备注：{r.note}</div>}
                        {r.exception_reason && (
                          <div class="timeline-note" style="background: #fef2f2; color: #991b1b;">
                            异常：{r.exception_reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {state.activeTab === 'attachments' && (
                  state.attachments.length === 0 ? (
                    <div class="empty-state">暂无附件</div>
                  ) : (
                    <table class="table">
                      <thead>
                        <tr>
                          <th>文件名</th>
                          <th>类型</th>
                          <th>证据分类</th>
                          <th>大小</th>
                          <th>上传时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.attachments.map(a => (
                          <tr key={a.id}>
                            <td>{a.file_name}</td>
                            <td>{a.file_type}</td>
                            <td>{a.evidence_type}</td>
                            <td>{(a.file_size / 1024).toFixed(1)} KB</td>
                            <td>{fmtDate(a.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}

                {state.activeTab === 'audit' && (
                  state.auditNotes.length === 0 ? (
                    <div class="empty-state">暂无审计备注</div>
                  ) : state.auditNotes.map(n => (
                    <div key={n.id} style="padding: 12px 0; border-bottom: 1px solid var(--border);">
                      <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;">
                        {fmtDate(n.created_at)}
                      </div>
                      <div>{n.content}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <div class="card" style="margin-bottom: 16px;">
              <div class="card-header">
                <h3 class="card-title">证据核验</h3>
              </div>
              <div class="card-body">
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  <div class="evidence-row">
                    <input
                      type="checkbox"
                      class="checkbox"
                      checked={state.localRouteQuote}
                      disabled={!canEdit}
                      onChange$={(e: any) => (state.localRouteQuote = e.target.checked)}
                    />
                    <span class="detail-label">线路报价证据：</span>
                    <span class={state.localRouteQuote ? 'evidence-ok' : 'evidence-missing'}>
                      {state.localRouteQuote ? '✓ 已上传' : '✗ 缺失'}
                    </span>
                  </div>
                  <div class="evidence-row">
                    <input
                      type="checkbox"
                      class="checkbox"
                      checked={state.localRegistration}
                      disabled={!canEdit && state.user.role !== 'auditor'}
                      onChange$={(e: any) => (state.localRegistration = e.target.checked)}
                    />
                    <span class="detail-label">报名确认证据：</span>
                    <span class={state.localRegistration ? 'evidence-ok' : 'evidence-missing'}>
                      {state.localRegistration ? '✓ 已上传' : '✗ 缺失'}
                    </span>
                  </div>
                  <div class="evidence-row">
                    <input
                      type="checkbox"
                      class="checkbox"
                      checked={state.localTourAudit}
                      disabled={!canEdit && state.user.role !== 'auditor' && state.user.role !== 'reviewer'}
                      onChange$={(e: any) => (state.localTourAudit = e.target.checked)}
                    />
                    <span class="detail-label">出团审核证据：</span>
                    <span class={state.localTourAudit ? 'evidence-ok' : 'evidence-missing'}>
                      {state.localTourAudit ? '✓ 已上传' : '✗ 缺失'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {canEdit && (
              <div class="card">
                <div class="card-header">
                  <h3 class="card-title">快捷操作</h3>
                </div>
                <div class="card-body" style="display: flex; flex-direction: column; gap: 8px;">
                  <button class="btn" onClick$={() => {
                    if (state.localRouteQuote !== order.route_quote_evidence ||
                        state.localRegistration !== order.registration_confirm_evidence ||
                        state.localTourAudit !== order.tour_audit_evidence) {
                      api.updateOrder(id, {
                        route_quote_evidence: state.localRouteQuote,
                        registration_confirm_evidence: state.localRegistration,
                        tour_audit_evidence: state.localTourAudit,
                        version: order.version,
                      }).then(() => {
                        state.success = '证据状态已更新';
                        setTimeout(() => (state.success = null), 3000);
                        loadData();
                      }).catch(e => {
                        state.error = e.error || '更新失败';
                      });
                    }
                  }}>
                    保存证据状态
                  </button>
                  <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                    勾选证据表示该类单据已上传并核验通过。状态变更时会再次校验必填证据。
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {state.showStatusModal && state.selectedTarget && (
          <div class="modal-overlay" onClick$={e => { if ((e.target as HTMLElement).className === 'modal-overlay') state.showStatusModal = false; }}>
            <div class="modal">
              <div class="modal-header">
                <h3 class="modal-title">
                  状态变更：{STATUS_LABELS[order.status]} → {STATUS_LABELS[state.selectedTarget]}
                </h3>
                <button class="btn btn-sm" onClick$={() => (state.showStatusModal = false)}>×</button>
              </div>
              <div class="modal-body">
                {getRequiredEvidence(order.status, state.selectedTarget).length > 0 && (
                  <div style="margin-bottom: 16px;">
                    <div class="section-title">必填证据校验</div>
                    {getRequiredEvidence(order.status, state.selectedTarget).map(e => {
                      const has = e === 'route_quote_evidence' ? state.localRouteQuote
                        : e === 'registration_confirm_evidence' ? state.localRegistration
                        : state.localTourAudit;
                      return (
                        <div key={e} class="evidence-row" style="margin-bottom: 8px;">
                          <input
                            type="checkbox"
                            class="checkbox"
                            checked={has}
                            onChange$={(ev: any) => {
                              if (e === 'route_quote_evidence') state.localRouteQuote = ev.target.checked;
                              if (e === 'registration_confirm_evidence') state.localRegistration = ev.target.checked;
                              if (e === 'tour_audit_evidence') state.localTourAudit = ev.target.checked;
                            }}
                          />
                          <span class="detail-label">{EVIDENCE_LABELS[e]}：</span>
                          <span class={has ? 'evidence-ok' : 'evidence-missing'}>
                            {has ? '✓ 已准备' : '✗ 缺失（必须）'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div class="form-group">
                  <label class="form-label">处理备注</label>
                  <textarea
                    class="form-textarea"
                    placeholder="请输入处理说明..."
                    value={state.statusNote}
                    onInput$={(e: any) => (state.statusNote = e.target.value)}
                  />
                </div>

                {state.selectedTarget === 'pending_correction' && (
                  <div class="form-group">
                    <label class="form-label">异常/退回原因</label>
                    <textarea
                      class="form-textarea"
                      placeholder="请描述需要补正的内容或异常原因..."
                      value={state.exceptionReason}
                      onInput$={(e: any) => (state.exceptionReason = e.target.value)}
                    />
                  </div>
                )}

                <div style="font-size: 12px; color: var(--text-secondary);">
                  当前版本 v{order.version}，提交后版本自动递增
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn" onClick$={() => (state.showStatusModal = false)}>取消</button>
                <button class="btn btn-primary" onClick$={doStatusChange}>确认提交</button>
              </div>
            </div>
          </div>
        )}

        {state.showAuditModal && (
          <div class="modal-overlay" onClick$={e => { if ((e.target as HTMLElement).className === 'modal-overlay') state.showAuditModal = false; }}>
            <div class="modal">
              <div class="modal-header">
                <h3 class="modal-title">添加审计备注</h3>
                <button class="btn btn-sm" onClick$={() => (state.showAuditModal = false)}>×</button>
              </div>
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label">备注内容</label>
                  <textarea
                    class="form-textarea"
                    placeholder="请输入审计备注内容..."
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
