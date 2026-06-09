import { createSignal, createEffect, For, Show } from 'solid-js';
import { useParams, useNavigate, useSearchParams } from '@solidjs/router';
import type {
  TreatmentPlanDetail,
  AbnormalCategory,
  ProcessAction,
  AttachmentInput,
} from '@/types';
import {
  PlanStatusLabel,
  AbnormalCategoryLabel,
  RoleLabel,
} from '@/types';
import { getPlanDetail, processPlan, addAuditNote, submitCorrection } from '@/api';
import {
  useToast,
  planStatusTagClass,
  dueStatusTagClass,
  formatDate,
  formatDateOnly,
  statusTag,
} from '@/utils';
import { useAuth } from '@/context/AuthContext';

type TabKey = 'patient_profile' | 'treatment_plan' | 'follow_up_reminder';

const tabConfig: Array<{ key: TabKey; label: string }> = [
  { key: 'patient_profile', label: '患者档案' },
  { key: 'treatment_plan', label: '治疗计划' },
  { key: 'follow_up_reminder', label: '复诊提醒' },
];

const actionLabelMap: Record<string, string> = {
  correct_patient: '补正患者档案',
  correct_plan: '补正治疗计划',
  correct_reminder: '补正复诊提醒',
};

const getActionLabel = (action: string): string => {
  return actionLabelMap[action] || action;
};

const abnormalCategories: AbnormalCategory[] = [
  'material',
  'permission',
  'timeline',
  'status',
];

export default function PlanDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast, show } = useToast();

  const [detail, setDetail] = createSignal<TreatmentPlanDetail | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<TabKey>('patient_profile');
  const [processLoading, setProcessLoading] = createSignal(false);
  const [remark, setRemark] = createSignal('');
  const [evidence, setEvidence] = createSignal('');
  const [exceptionType, setExceptionType] = createSignal<AbnormalCategory>('material');
  const [exceptionDesc, setExceptionDesc] = createSignal('');
  const [auditNote, setAuditNote] = createSignal('');
  const [auditLoading, setAuditLoading] = createSignal(false);
  const [correctionModal, setCorrectionModal] = createSignal<{
    visible: boolean;
    module: TabKey;
  }>({ visible: false, module: 'patient_profile' });
  const [correctionData, setCorrectionData] = createSignal<Record<string, string>>({});
  const [correctionFileName, setCorrectionFileName] = createSignal('');
  const [correctionFileUrl, setCorrectionFileUrl] = createSignal('');
  const [correctionEvidence, setCorrectionEvidence] = createSignal('');
  const [correctionLoading, setCorrectionLoading] = createSignal(false);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await getPlanDetail(params.id);
      setDetail(res.data);
    } catch (err: any) {
      show('error', err.message || '加载详情失败');
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    fetchDetail();
  });

  const currentRole = () => user()?.role;

  const availableActions = (): Array<{ action: ProcessAction; label: string; className: string }> => {
    const d = detail();
    if (!d) return [];
    const status = d.status;
    const role = currentRole();
    const actions: Array<{ action: ProcessAction; label: string; className: string }> = [];

    if (status === 'pending_confirm' && role === 'consultant') {
      actions.push({ action: 'confirm', label: '确认', className: 'btn-primary' });
    }
    if (status === 'confirmed' && role === 'doctor') {
      actions.push({ action: 'mark_exception', label: '标记异常', className: 'btn-danger' });
      actions.push({ action: 'submit_review', label: '提交复查', className: 'btn-warning' });
    }
    if (status === 'exception' && role === 'doctor') {
      actions.push({ action: 'resolve_exception', label: '补正后提交复查', className: 'btn-primary' });
    }
    if (status === 'pending_review' && role === 'dean') {
      actions.push({ action: 'review', label: '复查通过', className: 'btn-success' });
    }
    if (status === 'reviewed' && role === 'dean') {
      actions.push({ action: 'archive', label: '归档', className: 'btn-primary' });
    }

    return actions;
  };

  const tabKeyToAttachmentType = (key: TabKey): AttachmentInput['type'] => {
    if (key === 'patient_profile') return 'patient';
    if (key === 'treatment_plan') return 'plan';
    return 'reminder';
  };

  const handleProcess = async (action: ProcessAction) => {
    const d = detail();
    if (!d) return;

    if (!remark().trim()) {
      show('error', '请填写办理意见');
      return;
    }

    if (action === 'mark_exception') {
      if (!exceptionDesc().trim() && !evidence().trim()) {
        show('error', '标记异常必须填写异常原因或提供证据说明');
        return;
      }
    }

    if (action === 'submit_review') {
      if (!d.reminderComplete && !d.followUpReminder?.attachments?.length && !evidence().trim()) {
        show('error', '提交复查前必须完成复诊提醒（上传证据或填写证据说明）');
        return;
      }
    }

    setProcessLoading(true);
    try {
      const body: any = {
        planId: d.id,
        version: d.version,
        action,
        remark: remark(),
      };
      if (evidence().trim()) body.evidence = evidence().trim();
      if (action === 'mark_exception') {
        body.exceptionCause = {
          type: exceptionType(),
          description: exceptionDesc().trim() || '未填写详细描述',
        };
      }
      const res = await processPlan(body);
      setDetail({ ...d, version: res.data.version });
      setRemark('');
      setEvidence('');
      setExceptionDesc('');
      show('success', '办理成功');
      await fetchDetail();
    } catch (err: any) {
      let msg = err.message || '办理失败';
      if (msg.includes('version') || msg.includes('旧') || msg.includes('冲突')) {
        msg = '版本过旧或状态冲突，请刷新页面后重试';
      } else if (msg.includes('处理人')) {
        msg = '您不是当前处理人，无法执行此操作';
      } else if (msg.includes('无权') || msg.includes('权限')) {
        msg = '当前角色无权执行此操作';
      } else if (msg.includes('证据')) {
        msg = '缺少必填证据，请上传附件或填写证据说明';
      }
      show('error', msg);
    } finally {
      setProcessLoading(false);
    }
  };

  const handleAddAuditNote = async () => {
    const d = detail();
    if (!d) return;
    if (!auditNote().trim()) {
      show('error', '请填写备注内容');
      return;
    }
    setAuditLoading(true);
    try {
      await addAuditNote(String(d.id), auditNote());
      setAuditNote('');
      show('success', '备注添加成功');
      await fetchDetail();
    } catch (err: any) {
      show('error', err.message || '添加备注失败');
    } finally {
      setAuditLoading(false);
    }
  };

  const openCorrection = (module: TabKey) => {
    setCorrectionModal({ visible: true, module });
    setCorrectionData({});
    setCorrectionFileName('');
    setCorrectionFileUrl('');
    setCorrectionEvidence('');
  };

  const handleCorrectionSubmit = async () => {
    const d = detail();
    if (!d) return;
    const module = correctionModal().module;
    const hasData = Object.keys(correctionData()).some((k) => correctionData()[k]?.trim());
    const hasFile = correctionFileName().trim();
    const hasEvidence = correctionEvidence().trim();
    if (!hasData && !hasFile && !hasEvidence) {
      show('error', '请填写补正信息、上传附件或填写证据说明');
      return;
    }
    setCorrectionLoading(true);
    try {
      const attachments: AttachmentInput[] = [];
      if (hasFile) {
        attachments.push({
          type: tabKeyToAttachmentType(module),
          filename: correctionFileName(),
          url: correctionFileUrl() || `/uploads/demo/${correctionFileName()}`,
        });
      }
      const body: any = {
        planId: d.id,
        module,
        version: d.version,
        data: correctionData(),
        attachments,
      };
      if (hasEvidence) body.evidence = correctionEvidence().trim();
      await submitCorrection(body);
      show('success', '补正提交成功');
      setCorrectionModal({ ...correctionModal(), visible: false });
      await fetchDetail();
    } catch (err: any) {
      let msg = err.message || '补正失败';
      if (msg.includes('version') || msg.includes('旧') || msg.includes('冲突')) {
        msg = '版本过旧或状态冲突，请刷新页面后重试';
      }
      show('error', msg);
    } finally {
      setCorrectionLoading(false);
    }
  };

  const groupedAbnormalReasons = () => {
    const d = detail();
    if (!d) return {} as Record<AbnormalCategory, string[]>;
    const grouped: Record<string, string[]> = {};
    for (const r of d.abnormalReasons) {
      if (!grouped[r.category]) grouped[r.category] = [];
      grouped[r.category].push(r.reason || r.description || '');
    }
    return grouped;
  };

  return (
    <div>
      <div style={{ 'margin-bottom': '12px' }}>
        <button class="btn btn-sm" onClick={() => navigate('/plans')}>
          ← 返回列表
        </button>
      </div>

      <Show when={loading()}>
        <div class="empty">加载中...</div>
      </Show>

      <Show when={!loading() && detail()}>
        <div class="card">
          <div class="card-title">基本信息</div>
          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(4, 1fr)', gap: '12px 24px' }}>
            <div class="info-row">
              <span class="info-label">计划单号：</span>
              <span class="info-value" style={{ color: '#1890ff', 'font-weight': 500 }}>
                {detail()!.planNo}
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">患者姓名：</span>
              <span class="info-value">{detail()!.patient.name}</span>
            </div>
            <div class="info-row">
              <span class="info-label">身份证：</span>
              <span class="info-value">{detail()!.patient.idCard}</span>
            </div>
            <div class="info-row">
              <span class="info-label">手机号：</span>
              <span class="info-value">{detail()!.patient.phone}</span>
            </div>
            <div class="info-row">
              <span class="info-label">当前状态：</span>
              <span class="info-value">
                <span class={planStatusTagClass(detail()!.status)}>
                  {PlanStatusLabel[detail()!.status]}
                </span>
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">版本号：</span>
              <span class="info-value">v{detail()!.version}</span>
            </div>
            <div class="info-row">
              <span class="info-label">截止日期：</span>
              <span class="info-value">{formatDateOnly(detail()!.deadline)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">到期状态：</span>
              <span class="info-value">
                <span class={dueStatusTagClass(detail()!.dueStatus)}>
                  {detail()!.dueStatus === 'normal' ? '正常' : detail()!.dueStatus === 'approaching' ? '临期' : '逾期'}
                </span>
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">当前处理人：</span>
              <span class="info-value">{detail()!.currentHandlerUser?.name || detail()!.currentHandler || '-'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">材料完整：</span>
              <span class="info-value">{detail()!.materialsComplete ? '✅ 是' : '❌ 否'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">计划完整：</span>
              <span class="info-value">{detail()!.planComplete ? '✅ 是' : '❌ 否'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">复诊提醒：</span>
              <span class="info-value">{detail()!.reminderComplete ? '✅ 已完成' : '❌ 未完成'}</span>
            </div>
            <Show when={detail()!.followUpDate || detail()!.followUpReminder?.followUpDate}>
              <div class="info-row">
                <span class="info-label">复诊日期：</span>
                <span class="info-value">{formatDateOnly(detail()!.followUpDate || detail()!.followUpReminder?.followUpDate)}</span>
              </div>
            </Show>
          </div>
        </div>

        <div class="card">
          <div class="tabs">
            <For each={tabConfig}>
              {(tab) => (
                <div
                  class={`tab-item ${activeTab() === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </div>
              )}
            </For>
          </div>

          <Show when={activeTab() === 'patient_profile'}>
            <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '16px', 'margin-bottom': '16px' }}>
              <div class="info-row">
                <span class="info-label">姓名：</span>
                <span class="info-value">{detail()!.patientProfile.patient.name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">身份证：</span>
                <span class="info-value">{detail()!.patientProfile.patient.idCard}</span>
              </div>
              <div class="info-row">
                <span class="info-label">手机号：</span>
                <span class="info-value">{detail()!.patientProfile.patient.phone}</span>
              </div>
            </div>
            <div style={{ 'margin-bottom': '12px', 'font-weight': 500 }}>已上传附件：</div>
            <div class="attachment-list">
              <Show when={detail()!.patientProfile.attachments.length === 0}>
                <div class="empty" style={{ padding: '20px' }}>暂无附件</div>
              </Show>
              <For each={detail()!.patientProfile.attachments}>
                {(att) => (
                  <div class="attachment-item">
                    <span class="attachment-icon">📎</span>
                    <span>{att.name || att.filename || '附件'}</span>
                    <span style={{ color: '#999', 'margin-left': 'auto', 'font-size': '12px' }}>
                      {formatDate(att.uploadedAt)}
                    </span>
                  </div>
                )}
              </For>
            </div>
            <div style={{ 'margin-top': '16px' }}>
              <button class="btn btn-primary btn-sm" onClick={() => openCorrection('patient_profile')}>
                补正患者档案
              </button>
            </div>
          </Show>

          <Show when={activeTab() === 'treatment_plan'}>
            <div style={{ 'margin-bottom': '16px' }}>
              <div style={{ 'font-weight': 500, 'margin-bottom': '8px' }}>治疗内容：</div>
              <div style={{ padding: '12px', background: '#fafafa', 'border-radius': '4px' }}>
                {detail()!.treatmentPlan.content || '暂无内容'}
              </div>
            </div>
            <div style={{ 'margin-bottom': '12px', 'font-weight': 500 }}>已上传附件：</div>
            <div class="attachment-list">
              <Show when={detail()!.treatmentPlan.attachments.length === 0}>
                <div class="empty" style={{ padding: '20px' }}>暂无附件</div>
              </Show>
              <For each={detail()!.treatmentPlan.attachments}>
                {(att) => (
                  <div class="attachment-item">
                    <span class="attachment-icon">📎</span>
                    <span>{att.name || att.filename || '附件'}</span>
                    <span style={{ color: '#999', 'margin-left': 'auto', 'font-size': '12px' }}>
                      {formatDate(att.uploadedAt)}
                    </span>
                  </div>
                )}
              </For>
            </div>
            <div style={{ 'margin-top': '16px' }}>
              <button class="btn btn-primary btn-sm" onClick={() => openCorrection('treatment_plan')}>
                补正治疗计划
              </button>
            </div>
          </Show>

          <Show when={activeTab() === 'follow_up_reminder'}>
            <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '16px', 'margin-bottom': '16px' }}>
              <div class="info-row">
                <span class="info-label">复诊日期：</span>
                <span class="info-value">{detail()!.followUpReminder?.followUpDate ? formatDateOnly(detail()!.followUpReminder.followUpDate) : '未设置'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">完成状态：</span>
                <span class="info-value">{detail()!.followUpReminder?.complete ? '✅ 已完成' : '❌ 未完成'}</span>
              </div>
            </div>
            <div style={{ 'margin-bottom': '16px' }}>
              <div style={{ 'font-weight': 500, 'margin-bottom': '8px' }}>提醒内容：</div>
              <div style={{ padding: '12px', background: '#fafafa', 'border-radius': '4px' }}>
                {detail()!.followUpReminder?.content || detail()!.followUpReminder?.followUpContent || '暂无内容'}
              </div>
            </div>
            <div style={{ 'margin-bottom': '12px', 'font-weight': 500 }}>证据附件：</div>
            <div class="attachment-list">
              <Show when={!detail()!.followUpReminder?.attachments?.length}>
                <div class="empty" style={{ padding: '20px', color: '#ff4d4f' }}>
                  ⚠️ 缺少复诊提醒证据
                </div>
              </Show>
              <For each={detail()!.followUpReminder?.attachments || []}>
                {(att) => (
                  <div class="attachment-item">
                    <span class="attachment-icon">📎</span>
                    <span>{att.name || att.filename || '附件'}</span>
                    <span style={{ color: '#999', 'margin-left': 'auto', 'font-size': '12px' }}>
                      {formatDate(att.uploadedAt)}
                    </span>
                  </div>
                )}
              </For>
            </div>
            <div style={{ 'margin-top': '16px' }}>
              <button class="btn btn-primary btn-sm" onClick={() => openCorrection('follow_up_reminder')}>
                补正复诊提醒
              </button>
            </div>
          </Show>
        </div>

        <Show when={detail()!.abnormalReasons.length > 0}>
          <div class="card">
            <div class="card-title" style={{ color: '#ff4d4f' }}>异常原因</div>
            <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '12px' }}>
              <For each={abnormalCategories}>
                {(cat) => {
                  const items = groupedAbnormalReasons()[cat];
                  return (
                    <Show when={items && items.length > 0}>
                      <div class="abnormal-section">
                        <div class="abnormal-section-title">{AbnormalCategoryLabel[cat]}</div>
                        <For each={items}>
                          {(reason) => (
                            <div class="abnormal-item">{reason}</div>
                          )}
                        </For>
                      </div>
                    </Show>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>

        <div class="card">
          <div class="card-title">办理</div>
          <div class="form-item">
            <label class="form-label">办理意见 *</label>
            <textarea
              class="form-textarea"
              placeholder="请输入办理意见"
              value={remark()}
              onInput={(e) => setRemark((e.target as HTMLTextAreaElement).value)}
            />
          </div>
          <div class="form-item">
            <label class="form-label">证据说明（可选）</label>
            <textarea
              class="form-textarea"
              placeholder="请填写证据说明（如电话复诊记录、与患者沟通记录等）"
              value={evidence()}
              onInput={(e) => setEvidence((e.target as HTMLTextAreaElement).value)}
            />
          </div>

          <Show when={availableActions().some((a) => a.action === 'mark_exception')}>
            <div style={{ padding: '12px', background: '#fff1f0', 'border-radius': '6px', 'margin-bottom': '12px' }}>
              <div class="form-item">
                <label class="form-label">异常类型</label>
                <select
                  class="form-select"
                  value={exceptionType()}
                  onChange={(e) => setExceptionType((e.target as HTMLSelectElement).value as AbnormalCategory)}
                >
                  <For each={abnormalCategories}>
                    {(cat) => <option value={cat}>{AbnormalCategoryLabel[cat]}</option>}
                  </For>
                </select>
              </div>
              <div class="form-item">
                <label class="form-label">异常描述</label>
                <textarea
                  class="form-textarea"
                  placeholder="请详细描述异常情况"
                  value={exceptionDesc()}
                  onInput={(e) => setExceptionDesc((e.target as HTMLTextAreaElement).value)}
                />
              </div>
            </div>
          </Show>

          <div style={{ display: 'flex', gap: '10px', 'align-items': 'center' }}>
            <For each={availableActions()}>
              {(act) => (
                <button
                  class={`btn ${act.className}`}
                  onClick={() => handleProcess(act.action)}
                  disabled={processLoading()}
                >
                  {processLoading() ? '处理中...' : act.label}
                </button>
              )}
            </For>
            <Show when={availableActions().length === 0}>
              <span style={{ color: '#999' }}>当前角色在此状态下无可操作动作</span>
            </Show>
            <button class="btn" onClick={fetchDetail} style={{ 'margin-left': 'auto' }}>
              刷新
            </button>
          </div>
          <div style={{ 'margin-top': '12px', 'font-size': '12px', color: '#999' }}>
            当前角色：{user() ? RoleLabel[user().role] : '-'} | 提示：办理操作将携带当前版本号 v{detail()?.version || 0}
          </div>
        </div>

        <div class="card">
          <div class="card-title">处理历史</div>
          <Show when={detail()!.processHistory.length === 0}>
            <div class="empty">暂无处理记录</div>
          </Show>
          <div class="timeline">
            <For each={detail()!.processHistory}>
              {(h) => (
                <div class="timeline-item">
                  <div class="timeline-title">
                    {h.operator} · {getActionLabel(h.action)}
                  </div>
                  <div class="timeline-time">{formatDate(h.createdAt)}</div>
                  <div class="timeline-content">
                    <div style={{ 'margin-bottom': '4px' }}>
                      状态变更：
                      <Show when={h.fromStatus}>
                        <span class={planStatusTagClass(h.fromStatus!)} style={{ 'margin-right': '6px' }}>
                          {statusTag(h.fromStatus!)}
                        </span>
                      </Show>
                      <span>→</span>
                      <span class={planStatusTagClass(h.toStatus)} style={{ 'margin-left': '6px' }}>
                        {statusTag(h.toStatus)}
                      </span>
                    </div>
                    <Show when={h.remark}>
                      <div>意见：{h.remark}</div>
                    </Show>
                    <Show when={h.evidence}>
                      <div style={{ color: '#52c41a' }}>证据：{h.evidence}</div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        <div class="card">
          <div class="card-title">审计备注</div>
          <div class="form-item">
            <textarea
              class="form-textarea"
              placeholder="添加审计备注..."
              value={auditNote()}
              onInput={(e) => setAuditNote((e.target as HTMLTextAreaElement).value)}
            />
          </div>
          <div style={{ 'margin-bottom': '16px' }}>
            <button class="btn btn-primary btn-sm" onClick={handleAddAuditNote} disabled={auditLoading()}>
              {auditLoading() ? '提交中...' : '添加备注'}
            </button>
          </div>
          <Show when={detail()!.auditNotes.length === 0}>
            <div class="empty">暂无备注</div>
          </Show>
          <For each={detail()!.auditNotes}>
            {(n) => (
              <div class="audit-note-item">
                <div class="audit-note-header">
                  <span>{n.author}</span>
                  <span>{formatDate(n.createdAt)}</span>
                </div>
                <div class="audit-note-content">{n.note}</div>
              </div>
            )}
          </For>
        </div>

        <Show when={correctionModal().visible}>
          <div class="modal-mask" onClick={() => setCorrectionModal({ ...correctionModal(), visible: false })}>
            <div class="modal" onClick={(e) => e.stopPropagation()}>
              <div class="modal-header">
                <div class="modal-title">
                  补正{correctionModal().module === 'patient_profile' ? '患者档案' : correctionModal().module === 'treatment_plan' ? '治疗计划' : '复诊提醒'}
                </div>
                <button class="modal-close" onClick={() => setCorrectionModal({ ...correctionModal(), visible: false })}>
                  ×
                </button>
              </div>

              <Show when={correctionModal().module === 'patient_profile'}>
                <div class="form-item">
                  <label class="form-label">姓名</label>
                  <input
                    class="form-input"
                    placeholder="请输入姓名"
                    value={correctionData().name || ''}
                    onInput={(e) => setCorrectionData({ ...correctionData(), name: (e.target as HTMLInputElement).value })}
                  />
                </div>
                <div class="form-item">
                  <label class="form-label">身份证号</label>
                  <input
                    class="form-input"
                    placeholder="请输入身份证号"
                    value={correctionData().idCard || ''}
                    onInput={(e) => setCorrectionData({ ...correctionData(), idCard: (e.target as HTMLInputElement).value })}
                  />
                </div>
                <div class="form-item">
                  <label class="form-label">手机号</label>
                  <input
                    class="form-input"
                    placeholder="请输入手机号"
                    value={correctionData().phone || ''}
                    onInput={(e) => setCorrectionData({ ...correctionData(), phone: (e.target as HTMLInputElement).value })}
                  />
                </div>
              </Show>

              <Show when={correctionModal().module === 'treatment_plan'}>
                <div class="form-item">
                  <label class="form-label">治疗内容</label>
                  <textarea
                    class="form-textarea"
                    placeholder="请输入治疗内容"
                    value={correctionData().content || ''}
                    onInput={(e) => setCorrectionData({ ...correctionData(), content: (e.target as HTMLTextAreaElement).value })}
                  />
                </div>
              </Show>

              <Show when={correctionModal().module === 'follow_up_reminder'}>
                <div class="form-item">
                  <label class="form-label">复诊日期</label>
                  <input
                    type="date"
                    class="form-input"
                    value={correctionData().followUpDate || ''}
                    onInput={(e) => setCorrectionData({ ...correctionData(), followUpDate: (e.target as HTMLInputElement).value })}
                  />
                </div>
                <div class="form-item">
                  <label class="form-label">提醒内容</label>
                  <textarea
                    class="form-textarea"
                    placeholder="请输入提醒内容"
                    value={correctionData().content || ''}
                    onInput={(e) => setCorrectionData({ ...correctionData(), content: (e.target as HTMLTextAreaElement).value })}
                  />
                </div>
              </Show>

              <div class="form-item">
                <label class="form-label">证据说明（可选）</label>
                <textarea
                  class="form-textarea"
                  placeholder="请填写补正相关的证据说明"
                  value={correctionEvidence()}
                  onInput={(e) => setCorrectionEvidence((e.target as HTMLTextAreaElement).value)}
                />
              </div>
              <div class="form-item">
                <label class="form-label">附件文件名（演示用，直接填写）</label>
                <input
                  class="form-input"
                  placeholder="如：复诊记录_20260609.pdf"
                  value={correctionFileName()}
                  onInput={(e) => setCorrectionFileName((e.target as HTMLInputElement).value)}
                />
              </div>

              <div class="modal-footer">
                <button class="btn" onClick={() => setCorrectionModal({ ...correctionModal(), visible: false })}>
                  取消
                </button>
                <button class="btn btn-primary" onClick={handleCorrectionSubmit} disabled={correctionLoading()}>
                  {correctionLoading() ? '提交中...' : '提交补正'}
                </button>
              </div>
            </div>
          </div>
        </Show>
      </Show>

      <Show when={toast()}>
        <div class={`toast toast-${toast()!.type}`}>{toast()!.message}</div>
      </Show>
    </div>
  );
}
