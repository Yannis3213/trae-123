import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useUser } from '../hooks/useUser';
import Toast, { type ToastType } from '../components/Toast';
import ProcessModal from '../components/ProcessModal';
import type {
  AppointmentDetail,
  UserRole,
  ProcessAppointmentRequest,
  AttachmentInput,
} from '../types';

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

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: userLoading } = useUser();
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType; key: number } | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [remark, setRemark] = useState('');
  const [exceptionType, setExceptionType] = useState('normal');
  const [exceptionReason, setExceptionReason] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [newAttachments, setNewAttachments] = useState<AttachmentInput[]>([]);
  const [newEvidenceType, setNewEvidenceType] = useState('customer_appointment');
  const [newFileName, setNewFileName] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, key: Date.now() });
  };

  const loadDetail = async () => {
    if (!id) return;
    setLoading(true);
    const resp = await api.getAppointment(id);
    if (resp.success && resp.data) {
      setDetail(resp.data);
      setExceptionType(resp.data.appointment.exception_type || 'normal');
    } else {
      showToast(resp.message, 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  const availableActions = useMemo(() => {
    if (!user || !detail) return [];
    return getAvailableActions(user.role, detail.appointment.status, detail.appointment.exception_type);
  }, [user, detail]);

  const currentAction = availableActions.find((a) => a.key === selectedAction);

  useEffect(() => {
    if (selectedAction && currentAction?.requireEvidence?.[0]) {
      setNewEvidenceType(currentAction.requireEvidence[0]);
    }
    setNewAttachments([]);
    setNewFileName('');
  }, [selectedAction, currentAction]);

  const deadlineClass = detail?.deadline_status === 'overdue'
    ? 'overdue'
    : detail?.deadline_status === 'approaching'
    ? 'approaching'
    : 'normal';

  const deadlineLabel = detail?.deadline_status === 'overdue'
    ? '已逾期'
    : detail?.deadline_status === 'approaching'
    ? '临期预警'
    : '正常';

  const handleSubmit = async () => {
    if (!currentAction || !detail || !id) return;

    if (currentAction.key === 'return_to_correct' && !exceptionReason.trim()) {
      showToast('退回补正必须填写退回原因', 'error');
      return;
    }

    if (currentAction.key === 'correction_submit' && !correctionNote.trim()) {
      showToast('补正提交必须填写补正说明', 'error');
      return;
    }

    if (currentAction.needException && exceptionType !== 'normal' && !exceptionReason.trim()) {
      showToast('请填写异常/退回原因', 'error');
      return;
    }

    const invalidAtts = newAttachments.filter(
      (a) => !currentAction.requireEvidence.includes(a.evidence_type)
    );
    if (invalidAtts.length > 0) {
      showToast('存在当前动作不支持的证据类型，请删除后重试', 'error');
      return;
    }

    setSubmitting(true);

    const body: ProcessAppointmentRequest = {
      action: currentAction.key,
      remark: remark || null,
      exception_type: exceptionType === 'normal' ? (detail.appointment.exception_type || null) : exceptionType,
      exception_reason: exceptionReason || null,
      correction_note: correctionNote || null,
      version: detail.appointment.version,
      evidence_required: currentAction.requireEvidence,
      attachments: newAttachments,
    };

    const resp = await api.processAppointment(id, body);
    setSubmitting(false);

    if (resp.success) {
      showToast('操作成功', 'success');
      sessionStorage.setItem('listNeedRefresh', 'true');
      setSelectedAction(null);
      setRemark('');
      setExceptionReason('');
      setCorrectionNote('');
      setNewAttachments([]);
      setNewFileName('');
      setRefreshKey((k) => k + 1);
      loadDetail();
    } else {
      showToast(resp.message, 'error');
    }
  };

  const handleAddAttachment = () => {
    if (!newFileName.trim()) {
      showToast('请输入文件名', 'info');
      return;
    }
    const newAtt: AttachmentInput = {
      evidence_type: newEvidenceType,
      file_name: newFileName.trim(),
      file_url: `/static/evidence/uploaded_${Date.now()}.jpg`,
    };
    setNewAttachments([...newAttachments, newAtt]);
    setNewFileName('');
  };

  const handleRemoveAttachment = (index: number) => {
    setNewAttachments(newAttachments.filter((_, i) => i !== index));
  };

  if (loading || userLoading) {
    return (
      <div className="layout">
        <div className="header"><h1>美容连锁门店预约单系统</h1></div>
        <div className="container"><div className="loading">加载中...</div></div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="layout">
        <div className="header"><h1>美容连锁门店预约单系统</h1></div>
        <div className="container"><div className="empty">预约单不存在</div></div>
      </div>
    );
  }

  const apt = detail.appointment;

  return (
    <div className="layout">
      <header className="header">
        <h1>🌸 美容连锁门店 · 预约单详情</h1>
        <div className="header-actions">
          <div className="user-label">{user?.username}（{user?.role_label}）</div>
        </div>
      </header>

      <div className="container">
        <div className="back-link" onClick={() => navigate('/')}>
          ← 返回预约单列表
        </div>

        <div className="detail-page">
          <div className="detail-main">
            <div className="panel">
              <div className="panel-title">预约单基本信息</div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <span className={`card-status ${apt.status}`}>{detail.status_label}</span>
                {detail.exception_type_label && (
                  <span className="card-exception">{detail.exception_type_label}</span>
                )}
                <span className={`card-status ${deadlineClass === 'overdue' ? 'pending_review' : deadlineClass === 'approaching' ? 'archived' : 'draft'}`}
                  style={{
                    background: deadlineClass === 'overdue' ? '#fef0f0' : deadlineClass === 'approaching' ? '#fdf6ec' : '#f0f9eb',
                    color: deadlineClass === 'overdue' ? '#f56c6c' : deadlineClass === 'approaching' ? '#e6a23c' : '#67c23a',
                  }}
                >
                  {deadlineLabel}
                </span>
                <span style={{ fontSize: 12, color: '#909399' }}>版本 v{apt.version}</span>
              </div>
              <div className="appointment-info-grid">
                <div className="info-item">
                  <span className="info-label">预约单号：</span>
                  <span className="info-value">{apt.order_no}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">顾客姓名：</span>
                  <span className="info-value">{apt.customer_name}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">联系电话：</span>
                  <span className="info-value">{apt.customer_phone}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">服务项目：</span>
                  <span className="info-value">{apt.service_item}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">预约时间：</span>
                  <span className="info-value">{apt.appointment_time}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">处理期限：</span>
                  <span className="info-value" style={{
                    color: deadlineClass === 'overdue' ? '#f56c6c' : deadlineClass === 'approaching' ? '#e6a23c' : '#303133',
                    fontWeight: 600,
                  }}>{apt.deadline}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">护理师：</span>
                  <span className="info-value">{apt.beautician}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">美容顾问：</span>
                  <span className="info-value">{apt.consultant}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">门店店长：</span>
                  <span className="info-value">{apt.store_manager}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">当前处理人：</span>
                  <span className="info-value" style={{ color: '#ff6b9d', fontWeight: 600 }}>
                    {apt.current_handler}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">创建时间：</span>
                  <span className="info-value">{apt.created_at}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">更新时间：</span>
                  <span className="info-value">{apt.updated_at}</span>
                </div>
              </div>
            </div>

            {apt.exception_reason && (
              <div className="exception-box">
                <div className="exception-title">⚠ 异常原因</div>
                <div className="exception-desc">{apt.exception_reason}</div>
              </div>
            )}

            {apt.correction_note && (
              <div className="correction-box">
                <div className="correction-title">✓ 补正说明</div>
                <div className="correction-desc">{apt.correction_note}</div>
              </div>
            )}

            <div className="panel">
              <div className="panel-title">证据摘要</div>
              {(['customer_appointment', 'project_confirmation', 'service_followup'] as const).map((type) => {
                const list = detail.evidence_summary[type] || [];
                return (
                  <div key={type} className="evidence-section">
                    <div className="evidence-label">
                      📎 {EVIDENCE_LABELS[type]}
                      <span className="evidence-count">{list.length} 份</span>
                      {list.length === 0 && (
                        <span style={{ fontSize: 12, color: '#f56c6c', marginLeft: 8 }}>（未上传）</span>
                      )}
                    </div>
                    <div className="evidence-list">
                      {list.length === 0 ? (
                        <span className="evidence-item missing">缺少证据</span>
                      ) : (
                        list.map((att) => (
                          <span key={att.id} className="evidence-item" title={`上传人：${att.uploaded_by} · ${att.uploaded_at}`}>
                            📄 {att.file_name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {detail.processing_records.length > 0 && (
              <div className="panel">
                <div className="panel-title">补正/处理记录</div>
                {detail.processing_records.map((r) => (
                  <div key={r.id} style={{
                    padding: 12,
                    background: '#f5f7fa',
                    borderRadius: 6,
                    marginBottom: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                      <div>
                        <strong>{r.handler}（{r.handler_role === 'beautician' ? '护理师' : r.handler_role === 'consultant' ? '美容顾问' : r.handler_role === 'store_manager' ? '店长' : r.handler_role === 'system' ? '系统' : r.handler_role}）</strong>
                        {(r.from_version != null || r.to_version != null) && (
                          <span style={{ fontSize: 10, color: '#ff6b9d', marginLeft: 8, background: '#fff5f8', padding: '1px 5px', borderRadius: 3 }}>
                            v{r.from_version ?? '-'} → v{r.to_version ?? '-'}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 12, color: '#909399' }}>{r.created_at}</span>
                    </div>
                    {r.action && (
                      <div style={{ fontSize: 12, color: '#67c23a', marginBottom: 4 }}>
                        {r.action === 'correction' ? '补正处理' : r.action === 'return_to_correct' ? '退回补正' : r.action === 'batch_fail' ? '批量处理失败' : r.action === 'mark_overdue' ? '标记逾期' : r.action}
                      </div>
                    )}
                    {r.detail && <div style={{ fontSize: 13, color: '#606266', marginTop: 4 }}>处理详情：{r.detail}</div>}
                    {r.exception_reason && <div style={{ fontSize: 13, color: '#f56c6c', marginTop: 4 }}>异常原因：{r.exception_reason}</div>}
                    {r.correction_note && <div style={{ fontSize: 13, color: '#67c23a', marginTop: 4 }}>补正内容：{r.correction_note}</div>}
                    {r.batch_fail_reason && <div style={{ fontSize: 13, color: '#e6a23c', marginTop: 4 }}>失败原因：{r.batch_fail_reason}</div>}
                    {r.audit_remark && <div style={{ fontSize: 13, color: '#909399', marginTop: 4, fontStyle: 'italic' }}>审计备注：{r.audit_remark}</div>}
                  </div>
                ))}
              </div>
            )}

            <div className="panel">
              <div className="panel-title">审计轨迹</div>
              <div className="audit-timeline">
                {detail.audit_trails.map((t) => (
                  <div key={t.id} className="audit-item">
                    <div className="audit-action">
                      {t.action_label}
                      {t.from_status && t.to_status && t.from_status !== t.to_status && (
                        <span style={{ fontSize: 12, color: '#909399', fontWeight: 'normal', marginLeft: 8 }}>
                          {t.from_status === 'draft' ? '草稿' : t.from_status === 'pending_review' ? '待复核' : t.from_status} → {t.to_status === 'draft' ? '草稿' : t.to_status === 'pending_review' ? '待复核' : t.to_status === 'archived' ? '已归档' : t.to_status}
                        </span>
                      )}
                      {(t.from_version != null || t.to_version != null) && (
                        <span style={{ fontSize: 11, color: '#ff6b9d', fontWeight: 'normal', marginLeft: 8, background: '#fff5f8', padding: '2px 6px', borderRadius: 3 }}>
                          v{t.from_version ?? '-'} → v{t.to_version ?? '-'}
                        </span>
                      )}
                    </div>
                    <div className="audit-operator">
                      {t.operator} · {t.operator_role_label} · {t.created_at}
                    </div>
                    {t.remark && <div className="audit-remark">{t.remark}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="detail-side">
            <div className="panel action-panel">
              <div className="panel-title">处理操作</div>
              {!selectedAction ? (
                <div className="action-buttons">
                  {availableActions.length === 0 ? (
                    <div className="empty">当前角色在该状态下无可用操作</div>
                  ) : (
                    availableActions.map((a) => (
                      <button
                        key={a.key}
                        className={`btn ${a.className} action-button`}
                        onClick={() => setSelectedAction(a.key)}
                      >
                        {a.label}
                      </button>
                    ))
                  )}
                  <button
                    className="btn btn-secondary action-button"
                    onClick={() => navigate('/')}
                    style={{ marginTop: 8 }}
                  >
                    返回列表
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    className="btn btn-secondary"
                    style={{ marginBottom: 16, width: '100%' }}
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
                          <label className="form-label required">异常原因</label>
                          <textarea
                            className="form-textarea"
                            value={exceptionReason}
                            onChange={(e) => setExceptionReason(e.target.value)}
                            placeholder="请详细描述异常原因..."
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
                        placeholder="请说明补正内容..."
                      />
                    </div>
                  )}

                  {currentAction && currentAction.requireEvidence.length > 0 && (
                    <div className="form-group">
                      <div className="form-label">证据材料（可补传）</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        {currentAction.requireEvidence.map((e) => {
                          const existingCount = (detail.evidence_summary[e as keyof typeof detail.evidence_summary] || []).length;
                          const newCount = newAttachments.filter((a) => a.evidence_type === e).length;
                          const total = existingCount + newCount;
                          return (
                            <span key={e} className={`evidence-item ${total > 0 ? '' : 'missing'}`}>
                              {total > 0 ? '✓' : '⚠'} {EVIDENCE_LABELS[e] || e}
                              {total > 0 && <span style={{ marginLeft: 4, fontSize: 11 }}>({total}份)</span>}
                            </span>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        <select
                          className="form-select"
                          style={{ flex: 1 }}
                          value={newEvidenceType}
                          onChange={(e) => setNewEvidenceType(e.target.value)}
                        >
                          {currentAction.requireEvidence.map((e) => (
                            <option key={e} value={e}>{EVIDENCE_LABELS[e] || e}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        <input
                          className="form-input"
                          style={{ flex: 1 }}
                          placeholder="输入文件名（模拟上传）"
                          value={newFileName}
                          onChange={(e) => setNewFileName(e.target.value)}
                        />
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0 12px', fontSize: 12 }}
                          onClick={handleAddAttachment}
                        >
                          + 添加
                        </button>
                      </div>

                      {newAttachments.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 12, color: '#606266', marginBottom: 6 }}>本次新增证据：</div>
                          {newAttachments.map((att, idx) => (
                            <div key={idx} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '6px 8px',
                              background: '#f5f7fa',
                              borderRadius: 4,
                              marginBottom: 4,
                              fontSize: 12,
                            }}>
                              <span>📄 {att.file_name}
                                <span style={{ fontSize: 11, color: '#909399', marginLeft: 6 }}>
                                  （{EVIDENCE_LABELS[att.evidence_type] || att.evidence_type}）
                                </span>
                              </span>
                              <span
                                style={{ color: '#f56c6c', cursor: 'pointer' }}
                                onClick={() => handleRemoveAttachment(idx)}
                              >
                                删除
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => setSelectedAction(null)}
                      disabled={submitting}
                    >
                      取消
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? '处理中...' : '确认提交'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-title">当前用户权限</div>
              <div style={{ fontSize: 13, color: '#606266', lineHeight: 2 }}>
                <div><strong>角色：</strong>{user?.role_label}</div>
                <div><strong>姓名：</strong>{user?.username}</div>
                <div style={{ marginTop: 12, padding: 12, background: '#f5f7fa', borderRadius: 6 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>角色职责说明：</div>
                  {user?.role === 'beautician' && (
                    <div>• 新建预约单（草稿）<br/>• 填写服务项目、上传预约凭证和项目确认单<br/>• 提交复核或补正后重新提交</div>
                  )}
                  {user?.role === 'consultant' && (
                    <div>• 对护理师提交的预约单进行复核<br/>• 检查服务回访记录是否齐全<br/>• 复核通过后转店长归档，或退回补正</div>
                  )}
                  {user?.role === 'store_manager' && (
                    <div>• 对复核通过的预约单进行最终归档<br/>• 可退回任意环节要求补正<br/>• 批量操作所有预约单</div>
                  )}
                </div>
              </div>
            </div>
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
    </div>
  );
}
