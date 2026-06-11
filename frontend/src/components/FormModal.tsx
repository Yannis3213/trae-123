import { Component, createSignal, Show, createEffect } from 'solid-js';
import type { ProcessAction, ReasonCode } from '../types';
import { ACTION_LABELS } from '../utils/status';

interface FormModalProps {
  open: boolean;
  action: ProcessAction;
  applicationNo?: string;
  isOverdue?: boolean;
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

interface ActionConfig {
  title: string;
  type: 'normal' | 'danger' | 'warning' | 'success';
  requireComment: boolean;
  commentMinLength?: number;
  showExceptionFields: boolean;
  showPaymentEvidence: boolean;
  showOverdueNote: boolean;
}

const getActionConfig = (action: ProcessAction, isOverdue: boolean): ActionConfig => {
  const base: Record<ProcessAction, Omit<ActionConfig, 'showOverdueNote'>> = {
    submit: { title: '提交申请', type: 'success', requireComment: false, showExceptionFields: false, showPaymentEvidence: false },
    review: { title: '审核申请', type: 'success', requireComment: true, commentMinLength: 3, showExceptionFields: false, showPaymentEvidence: false },
    verify: { title: '复核申请', type: 'success', requireComment: true, commentMinLength: 3, showExceptionFields: false, showPaymentEvidence: false },
    confirm: { title: '付款确认', type: 'success', requireComment: false, showExceptionFields: false, showPaymentEvidence: true },
    return: { title: '退回申请', type: 'warning', requireComment: true, commentMinLength: 1, showExceptionFields: false, showPaymentEvidence: false },
    reject: { title: '拒绝申请', type: 'danger', requireComment: true, commentMinLength: 1, showExceptionFields: false, showPaymentEvidence: false },
    exception: { title: '标记异常', type: 'danger', requireComment: false, showExceptionFields: true, showPaymentEvidence: false },
    rectify: { title: '补正重提', type: 'success', requireComment: true, commentMinLength: 1, showExceptionFields: false, showPaymentEvidence: false },
  };
  return {
    ...base[action],
    showOverdueNote: action === 'confirm' && isOverdue,
  };
};

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

  const config = () => getActionConfig(props.action, props.isOverdue || false);

  const submitBtnClass = () => {
    switch (config().type) {
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
    const cfg = config();

    if (cfg.requireComment) {
      const trimmed = comment().trim();
      const minLen = cfg.commentMinLength || 1;
      if (!trimmed) {
        setError('请填写备注说明');
        return;
      }
      if (trimmed.length < minLen) {
        setError(`备注说明至少需要 ${minLen} 个字`);
        return;
      }
    }

    if (cfg.showExceptionFields) {
      if (!reasonCode()) {
        setError('请选择异常原因');
        return;
      }
      if (!reasonDetail().trim()) {
        setError('请填写异常详细说明');
        return;
      }
    }

    if (cfg.showPaymentEvidence && !paymentEvidence().trim()) {
      setError('请填写付款凭证');
      return;
    }

    if (cfg.showOverdueNote) {
      const trimmed = overdueNote().trim();
      if (!trimmed) {
        setError('请填写逾期说明');
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

  return (
    <Show when={props.open}>
      <div class="modal-mask" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
        <div class="modal-content">
          <div class="modal-header">
            <span class="modal-title">
              {config().title}
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
          <div class="modal-body">
            {config().showExceptionFields && (
              <>
                <div class="form-item">
                  <label class="form-label">
                    异常原因 <span style={{ color: '#ff4d4f' }}>*</span>
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

            {config().showPaymentEvidence && (
              <div class="form-item">
                <label class="form-label">
                  付款凭证 <span style={{ color: '#ff4d4f' }}>*</span>
                </label>
                <input
                  type="text"
                  class="form-input"
                  value={paymentEvidence()}
                  onInput={(e) => setPaymentEvidence(e.target.value)}
                  placeholder="请填写付款凭证信息，如银行流水号、转账单号等"
                />
              </div>
            )}

            {config().showOverdueNote && (
              <div class="form-item">
                <label class="form-label">
                  逾期说明 <span style={{ color: '#ff4d4f' }}>*</span>
                  <span style={{ color: '#999', 'font-weight': 'normal', 'font-size': '12px' }}>
                    （至少10字）
                  </span>
                </label>
                <textarea
                  class="form-input form-textarea"
                  value={overdueNote()}
                  onInput={(e) => setOverdueNote(e.target.value)}
                  placeholder="请详细说明逾期原因和处理情况..."
                />
              </div>
            )}

            <div class="form-item">
              <label class="form-label">
                {config().requireComment ? (
                  <>
                    备注说明 <span style={{ color: '#ff4d4f' }}>*</span>
                    {config().commentMinLength && config().commentMinLength > 1 && (
                      <span style={{ color: '#999', 'font-weight': 'normal', 'font-size': '12px' }}>
                        （至少{config().commentMinLength}字）
                      </span>
                    )}
                  </>
                ) : (
                  '备注'
                )}
              </label>
              <textarea
                class="form-input form-textarea"
                value={comment()}
                onInput={(e) => setComment(e.target.value)}
                placeholder={
                  config().requireComment ? '请填写备注说明...' : '可选，填写操作备注...'
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
                {error()}
              </div>
            </Show>
          </div>
          <div class="modal-footer">
            <button class="btn" onClick={props.onClose} disabled={props.loading}>
              取消
            </button>
            <button class={submitBtnClass()} onClick={handleConfirm} disabled={props.loading}>
              {props.loading ? '处理中...' : '确认'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default FormModal;
