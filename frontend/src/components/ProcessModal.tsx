import { useState } from 'react';
import { api } from '../api';
import Toast, { type ToastType } from './Toast';
import type { AppointmentListItem, ProcessAppointmentRequest, UserRole } from '../types';

interface Props {
  apt: AppointmentListItem;
  userRole: UserRole;
  username: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface ActionDef {
  key: string;
  label: string;
  className: string;
  needRemark: boolean;
  needException: boolean;
  needCorrection: boolean;
  requireEvidence: string[];
}

function getAvailableActions(role: UserRole, status: string, exceptionType: string | null | undefined): ActionDef[] {
  const actions: ActionDef[] = [];
  const isException = exceptionType === 'missing_materials' || exceptionType === 'overdue' || exceptionType === 'returned';

  if (role === 'beautician') {
    if (status === 'draft') {
      actions.push({
        key: 'submit_review',
        label: '提交复核',
        className: 'btn-primary',
        needRemark: true,
        needException: true,
        needCorrection: false,
        requireEvidence: ['customer_appointment', 'project_confirmation'],
      });
    }
    if (status === 'pending_review' && exceptionType === 'returned') {
      actions.push({
        key: 'correction_submit',
        label: '补正后重新提交',
        className: 'btn-primary',
        needRemark: false,
        needException: false,
        needCorrection: true,
        requireEvidence: ['customer_appointment', 'project_confirmation'],
      });
    }
  }

  if (role === 'consultant') {
    if (status === 'pending_review') {
      if (!isException) {
        actions.push({
          key: 'review_pass',
          label: '复核通过（转店长归档）',
          className: 'btn-primary',
          needRemark: true,
          needException: false,
          needCorrection: false,
          requireEvidence: ['service_followup'],
        });
      }
      actions.push({
        key: 'return_to_correct',
        label: '退回补正',
        className: 'btn-danger',
        needRemark: false,
        needException: true,
        needCorrection: false,
        requireEvidence: [],
      });
    }
  }

  if (role === 'store_manager') {
    if (status === 'pending_review') {
      if (!isException) {
        actions.push({
          key: 'archive',
          label: '归档完成',
          className: 'btn-primary',
          needRemark: true,
          needException: false,
          needCorrection: false,
          requireEvidence: ['customer_appointment', 'project_confirmation', 'service_followup'],
        });
      }
      actions.push({
        key: 'return_to_correct',
        label: '退回补正',
        className: 'btn-danger',
        needRemark: false,
        needException: true,
        needCorrection: false,
        requireEvidence: [],
      });
    }
  }

  return actions;
}

const EVIDENCE_LABELS: Record<string, string> = {
  customer_appointment: '顾客预约凭证',
  project_confirmation: '项目确认单',
  service_followup: '服务回访记录',
};

const EXCEPTION_OPTIONS: { key: string; label: string }[] = [
  { key: 'normal', label: '正常流转' },
  { key: 'missing_materials', label: '缺材料' },
  { key: 'overdue', label: '超时/逾期' },
  { key: 'returned', label: '退回补正' },
];

export default function ProcessModal({ apt, userRole, username, onClose, onSuccess }: Props) {
  const actions = getAvailableActions(userRole, apt.status, apt.exception_type);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [remark, setRemark] = useState('');
  const [exceptionType, setExceptionType] = useState('normal');
  const [exceptionReason, setExceptionReason] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType; key: number } | null>(null);

  const currentAction = actions.find((a) => a.key === selectedAction);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, key: Date.now() });
  };

  const handleSubmit = async () => {
    if (!currentAction) return;

    if (currentAction.key === 'return_to_correct' && !exceptionReason.trim()) {
      showToast('退回补正必须填写退回原因', 'error');
      return;
    }

    if (currentAction.key === 'correction_submit' && !correctionNote.trim()) {
      showToast('补正提交必须填写补正说明', 'error');
      return;
    }

    setSubmitting(true);

    const body: ProcessAppointmentRequest = {
      action: currentAction.key,
      remark: remark || null,
      exception_type: exceptionType === 'normal' ? (apt.exception_type || null) : exceptionType,
      exception_reason: exceptionReason || null,
      correction_note: correctionNote || null,
      version: apt.version,
      evidence_required: currentAction.requireEvidence,
      attachments: [],
    };

    const resp = await api.processAppointment(apt.id, body);
    setSubmitting(false);

    if (resp.success) {
      showToast('操作成功', 'success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 600);
    } else {
      showToast(resp.message, 'error');
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <span>处理预约单 - {apt.order_no}</span>
            <span className="modal-close" onClick={onClose}>✕</span>
          </div>

          <div className="modal-body">
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f7fa', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{apt.customer_name} · {apt.service_item}</div>
              <div style={{ fontSize: 13, color: '#606266' }}>
                当前状态：<span className={`card-status ${apt.status}`}>{apt.status_label}</span>
                {apt.exception_type_label && (
                  <span className="card-exception" style={{ marginLeft: 8 }}>{apt.exception_type_label}</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#606266', marginTop: 4 }}>
                当前处理人：{apt.current_handler}
              </div>
              {apt.evidence_summary && (
                <div style={{ fontSize: 12, color: '#909399', marginTop: 4, display: 'flex', gap: 8 }}>
                  <span>{apt.evidence_summary.has_customer_appointment ? '✅' : '⭕'}预约({apt.evidence_summary.customer_appointment_count})</span>
                  <span>{apt.evidence_summary.has_project_confirmation ? '✅' : '⭕'}确认({apt.evidence_summary.project_confirmation_count})</span>
                  <span>{apt.evidence_summary.has_service_followup ? '✅' : '⭕'}回访({apt.evidence_summary.service_followup_count})</span>
                </div>
              )}
            </div>

            {!selectedAction ? (
              <div>
                <div className="form-label" style={{ marginBottom: 12 }}>请选择操作：</div>
                {actions.length === 0 ? (
                  <div className="empty">当前角色在该状态下无可用操作</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {actions.map((a) => (
                      <button
                        key={a.key}
                        className={`btn ${a.className} action-button`}
                        onClick={() => setSelectedAction(a.key)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <button
                  className="btn btn-secondary"
                  style={{ marginBottom: 16 }}
                  onClick={() => setSelectedAction(null)}
                >
                  ← 返回选择操作
                </button>

                <div className="form-group">
                  <div className="form-label">操作</div>
                  <div style={{ padding: 8, background: '#fff5f8', borderRadius: 4, color: '#c44569', fontWeight: 600 }}>
                    {currentAction?.label}
                  </div>
                </div>

                {currentAction?.needRemark && (
                  <div className="form-group">
                    <label className="form-label required">处理备注</label>
                    <textarea
                      className="form-textarea"
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder="请输入处理备注..."
                    />
                  </div>
                )}

                {currentAction?.needException && (
                  <>
                    <div className="form-group">
                      <label className="form-label">异常类型</label>
                      <select
                        className="form-select"
                        value={exceptionType}
                        onChange={(e) => setExceptionType(e.target.value)}
                      >
                        {EXCEPTION_OPTIONS.map((o) => (
                          <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    {exceptionType !== 'normal' && (
                      <div className="form-group">
                        <label className="form-label required">{currentAction.key === 'return_to_correct' ? '退回原因' : '异常原因'}</label>
                        <textarea
                          className="form-textarea"
                          value={exceptionReason}
                          onChange={(e) => setExceptionReason(e.target.value)}
                          placeholder={currentAction.key === 'return_to_correct' ? '请详细说明退回原因...' : '请详细描述异常原因...'}
                        />
                      </div>
                    )}
                  </>
                )}

                {currentAction?.needCorrection && (
                  <div className="form-group">
                    <label className="form-label required">补正说明</label>
                    <textarea
                      className="form-textarea"
                      value={correctionNote}
                      onChange={(e) => setCorrectionNote(e.target.value)}
                      placeholder="请说明补正内容，例如补充了哪些材料、修改了哪些信息..."
                    />
                  </div>
                )}

                {currentAction && currentAction.requireEvidence.length > 0 && (
                  <div className="form-group">
                    <div className="form-label">所需证据（将由后端校验）</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {currentAction.requireEvidence.map((e) => {
                        const hasIt = apt.evidence_summary && (
                          (e === 'customer_appointment' && apt.evidence_summary.has_customer_appointment) ||
                          (e === 'project_confirmation' && apt.evidence_summary.has_project_confirmation) ||
                          (e === 'service_followup' && apt.evidence_summary.has_service_followup)
                        );
                        return (
                          <span key={e} className={`evidence-item ${hasIt ? '' : 'missing'}`}>
                            {hasIt ? '✓' : '⚠'} {EVIDENCE_LABELS[e] || e}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              取消
            </button>
            {selectedAction && (
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? '处理中...' : '确认提交'}
              </button>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
