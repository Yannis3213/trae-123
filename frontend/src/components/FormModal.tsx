import { Component, createSignal, Show, createEffect } from 'solid-js';
import type { ProcessAction, ReasonCode, ActionRequirements } from '../types';
import { ACTION_LABELS, ACTION_TYPE } from '../utils/status';

interface FormModalProps {
  open: boolean;
  action: ProcessAction;
  applicationNo?: string;
  requirements?: ActionRequirements | null;
  onClose: () => void;
  onConfirm: (payload: {
    comment?: string;
    reason_code?: string;
    reason_detail?: string;
    payment_evidence?: string;
    overdue_note?: string;
  }) => void;
  loading?: boolean;
}

const REASON_CODE_OPTIONS: Array<{ value: ReasonCode; label: string }> = [
  { value: 'missing_evidence', label: '附件缺失' },
  { value: 'timeout', label: '超时未处理' },
  { value: 'state_conflict', label: '状态冲突' },
  { value: 'returned_rectify', label: '退回需补正' },
  { value: 'risky_amount', label: '金额风险' },
];

const FormModal: Component<FormModalProps> = (props) => {
  const [comment, setComment] = createSignal('');
  const [reasonCode, setReasonCode] = createSignal<string>('');
  const [reasonDetail, setReasonDetail] = createSignal('');
  const [paymentEvidence, setPaymentEvidence] = createSignal('');
  const [overdueNote, setOverdueNote] = createSignal('');
  const [error, setError] = createSignal('');

  createEffect(() => {
    if (props.open) {
      setComment('');
      setReasonCode('');
      setReasonDetail('');
      setPaymentEvidence('');
      setOverdueNote('');
      setError('');
    }
  });

  const req = () => props.requirements;

  const requireComment = () => {
    return !!req()?.require_comment;
  };

  const commentMinLen = () => {
    if (!req()?.require_comment) return 0;
    return 3;
  };

  const showExceptionFields = () => {
    return !!req()?.require_reason_code;
  };

  const showPaymentEvidence = () => {
    return !!req()?.require_payment_evidence;
  };

  const showOverdueNote = () => {
    return !!req()?.require_overdue_note;
  };

  const submitBtnClass = () => {
    const type = ACTION_TYPE[props.action] || 'primary';
    switch (type) {
      case 'danger':
        return 'btn btn-danger';
      case 'warning':
        return 'btn btn-warning';
      case 'success':
        return 'btn btn-success';
      default:
        return 'btn btn-primary';
    }
  };

  const handleConfirm = () => {
    if (requireComment()) {
      const trimmed = comment().trim();
      const minLen = commentMinLen();
      if (!trimmed) {
        setError('请填写备注说明（后端必填）');
        return;
      }
      if (trimmed.length < minLen) {
        setError(`备注说明至少需要 ${minLen} 个字`);
        return;
      }
    }

    if (showExceptionFields()) {
      if (!reasonCode()) {
        setError('请选择异常原因类型');
        return;
      }
      if (!reasonDetail().trim()) {
        setError('请填写异常详细说明');
        return;
      }
    }

    if (showPaymentEvidence()) {
      const p = paymentEvidence().trim();
      if (!p) {
        setError('请填写付款凭证/流水号（后端必填，缺付款记录不得放行）');
        return;
      }
      if (p.length < 5) {
        setError('付款凭证至少需要 5 个字符');
        return;
      }
    }

    if (showOverdueNote()) {
      const trimmed = overdueNote().trim();
      if (!trimmed) {
        setError('请填写逾期说明（后端必填，逾期不可悄悄放行）');
        return;
      }
      if (trimmed.length < 10) {
        setError('逾期说明至少需要 10 个字');
        return;
      }
    }

    props.onConfirm({
      comment: comment().trim() || undefined,
      reason_code: reasonCode() || undefined,
      reason_detail: reasonDetail().trim() || undefined,
      payment_evidence: paymentEvidence().trim() || undefined,
      overdue_note: overdueNote().trim() || undefined,
    });
  };

  const modalTitle = () => {
    const base = ACTION_LABELS[props.action] || props.action;
    return `${base}申请`;
  };

  return (
    <Show when={props.open}>
      <div class="modal-mask" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
        <div class="modal-content">
          <div class="modal-header">
            <span class="modal-title">
              {modalTitle()}
              {props.applicationNo && (
                <span
                  style={{
                    color: '#999',
                    'font-weight': 'normal',
                    'font-size': '14px',
                    'margin-left': '8px',
                  }}
                >
                  {' '}
                  - {props.applicationNo}
                </span>
              )}
            </span>
            <button class="modal-close" onClick={props.onClose}>
              ×
            </button>
          </div>

          {req() && (
            <div
              style={{
                padding: '8px 20px',
                background: '#e6f7ff',
                'border-bottom': '1px solid #91d5ff',
                'font-size': '12px',
                color: '#1890ff',
              }}
            >
              后端下发表单要求：
              {req().require_comment && <span style={{ marginLeft: '8px' }}>✓意见必填</span>}
              {req().require_payment_evidence && <span style={{ marginLeft: '8px' }}>✓付款凭证</span>}
              {req().require_overdue_note && <span style={{ marginLeft: '8px' }}>✓逾期说明</span>}
              {req().require_reason_code && <span style={{ marginLeft: '8px' }}>✓异常类型</span>}
              {!req().require_comment && !req().require_payment_evidence && !req().require_overdue_note && !req().require_reason_code && (
                <span>无额外必填项</span>
              )}
            </div>
          )}

          <div class="modal-body">
            {showExceptionFields() && (
              <>
                <div class="form-item">
                  <label class="form-label">
                    异常原因类型 <span style={{ color: '#ff4d4f' }}>*</span>
                  </label>
                  <select
                    class="form-input"
                    value={reasonCode()}
                    onChange={(e) => setReasonCode(e.target.value)}
                  >
                    <option value="">请选择异常原因</option>
                    {REASON_CODE_OPTIONS.map((opt) => (
                      <option value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div class="form-item">
                  <label class="form-label">
                    异常详细说明 <span style={{ color: '#ff4d4f' }}>*</span>
                  </label>
                  <textarea
                    class="form-input form-textarea"
                    value={reasonDetail()}
                    onInput={(e) => setReasonDetail(e.target.value)}
                    placeholder="请详细描述异常情况..."
                  />
                </div>
              </>
            )}

            {showPaymentEvidence() && (
              <div class="form-item">
                <label class="form-label">
                  付款凭证/流水号 <span style={{ color: '#ff4d4f' }}>*</span>
                  <span style={{ color: '#999', 'font-weight': 'normal', 'font-size': '12px' }}>
                    （至少5字，缺付款记录报销申请不得放行）
                  </span>
                </label>
                <input
                  type="text"
                  class="form-input"
                  value={paymentEvidence()}
                  onInput={(e) => setPaymentEvidence(e.target.value)}
                  placeholder="如：P202406150001、银行流水号20240611..."
                />
              </div>
            )}

            {showOverdueNote() && (
              <div class="form-item">
                <label class="form-label">
                  逾期说明 <span style={{ color: '#ff4d4f' }}>*</span>
                  <span style={{ color: '#999', 'font-weight': 'normal', 'font-size': '12px' }}>
                    （至少10字，逾期不可悄悄放行）
                  </span>
                </label>
                <textarea
                  class="form-input form-textarea"
                  value={overdueNote()}
                  onInput={(e) => setOverdueNote(e.target.value)}
                  placeholder="请详细说明逾期原因、责任人、处理情况..."
                />
              </div>
            )}

            <div class="form-item">
              <label class="form-label">
                {requireComment() ? (
                  <>
                    备注说明 <span style={{ color: '#ff4d4f' }}>*</span>
                    {commentMinLen() > 1 && (
                      <span style={{ color: '#999', 'font-weight': 'normal', 'font-size': '12px' }}>
                        （至少{commentMinLen()}字）
                      </span>
                    )}
                  </>
                ) : (
                  '备注（可选）'
                )}
              </label>
              <textarea
                class="form-input form-textarea"
                value={comment()}
                onInput={(e) => setComment(e.target.value)}
                placeholder={
                  requireComment()
                    ? '请填写备注说明（退回原因/复核意见/补正说明等）...'
                    : '可选，填写操作备注...'
                }
              />
            </div>

            <Show when={error()}>
              <div
                style={{
                  color: '#ff4d4f',
                  'font-size': '13px',
                  marginBottom: '16px',
                }}
              >
                ❌ {error()}
              </div>
            </Show>
          </div>
          <div class="modal-footer">
            <button class="btn" onClick={props.onClose} disabled={props.loading}>
              取消
            </button>
            <button class={submitBtnClass()} onClick={handleConfirm} disabled={props.loading}>
              {props.loading ? '处理中...' : '确认提交'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default FormModal;
