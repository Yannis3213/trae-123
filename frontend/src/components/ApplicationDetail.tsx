import { useEffect, useState } from 'react';
import { applicationApi } from '../api/client';
import type { ReplenishmentApplication, User, ApplicationDetail as AppDetail } from '../types';
import { STATUS_DISPLAY, STATUS_COLOR, PRIORITY_DISPLAY, PRIORITY_COLOR, ACTION_LABELS, ROLE_DISPLAY } from '../types';
import { useAuthStore } from '../store/auth';
import AttachmentUploader from './AttachmentUploader';

interface ApplicationDetailProps {
  application: ReplenishmentApplication;
  users: User[];
  onUpdated: () => void;
}

type ActionKey = 'submit' | 'sign' | 'complete' | 'return' | 'correct' | 'recheck' | 'archive';

const AVAILABLE_ACTIONS: Record<string, ActionKey[]> = {
  draft: ['submit'],
  pending_signature: ['sign', 'complete', 'return'],
  exception_returned: ['correct'],
  correction_pending: ['recheck', 'return'],
  signature_complete: ['archive'],
  archived: [],
};

export default function ApplicationDetail({ application, users, onUpdated }: ApplicationDetailProps) {
  const { user, visibleScope } = useAuthStore();
  const [detail, setDetail] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionKey | null>(null);
  const [resultText, setResultText] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [noteText, setNoteText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadDetail = () => {
    setLoading(true);
    applicationApi
      .getDetail(application.id)
      .then((d) => setDetail(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDetail();
  }, [application.id]);

  if (!detail || !user) return <div>加载中...</div>;

  const app = detail.application;
  const stateActions = AVAILABLE_ACTIONS[app.status] || [];
  const scopeAllowed = visibleScope?.allowed_actions || [];
  const availableActions = stateActions.filter((a) => scopeAllowed.includes(a));
  const canAct = user.id === app.current_handler && app.status !== 'archived' && visibleScope?.can_process;
  const getUserName = (id: string) => users.find((u) => u.id === id)?.display_name || id;
  const getUserRole = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? ROLE_DISPLAY[u.role] : '';
  };
  const formatDate = (d: string) => new Date(d).toLocaleString('zh-CN');

  const deadlineClass = app.is_overdue ? 'warning-overdue' : app.is_near_deadline ? 'warning-near' : 'warning-normal';

  const handleAction = async () => {
    if (!selectedAction) return;
    setErrorMsg('');
    setSuccessMsg('');
    setProcessing(true);

    try {
      await applicationApi.process({
        application_id: app.id,
        action: selectedAction,
        result: selectedAction === 'return' ? null : resultText || null,
        return_reason: selectedAction === 'return' ? returnReason || null : null,
        current_version: app.version,
      });
      setSuccessMsg(`操作「${ACTION_LABELS[selectedAction]}」成功`);
      setSelectedAction(null);
      setResultText('');
      setReturnReason('');
      loadDetail();
      onUpdated();
    } catch (e: any) {
      setErrorMsg(e.response?.data?.message || e.message || '操作失败');
    } finally {
      setProcessing(false);
    }
  };

  const addAuditNote = async () => {
    if (!noteText.trim()) return;
    try {
      await applicationApi.addAuditNote(app.id, noteText.trim());
      setNoteText('');
      loadDetail();
    } catch (e: any) {
      setErrorMsg(e.response?.data?.message || '添加备注失败');
    }
  };

  const needsResult = selectedAction === 'sign' || selectedAction === 'complete' || selectedAction === 'archive';
  const needsReturnReason = selectedAction === 'return';

  const evidenceAttachments = detail.attachments.filter((a) => a.is_evidence);
  const hasValidEvidence = evidenceAttachments.length > 0;
  const isCorrectionStatus = app.status === 'exception_returned' || app.status === 'correction_pending';
  const canCorrect = hasValidEvidence;
  const needsEvidenceAlert = selectedAction === 'correct' && !canCorrect;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          补货申请详情 — <strong>{app.application_no}</strong>
        </div>
        <div className="page-subtitle">
          {app.store_name} · 创建于 {formatDate(app.created_at)} · 版本 v{app.version}
        </div>
      </div>

      <div className="card">
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">标题</div>
            <div className="detail-value">{app.title}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">状态</div>
            <div>
              <span className="status-badge" style={{ background: STATUS_COLOR[app.status] }}>
                {STATUS_DISPLAY[app.status]}
              </span>
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">描述</div>
            <div className="detail-value">{app.description}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">优先级</div>
            <div className="detail-value">
              <span className="priority-dot" style={{ background: PRIORITY_COLOR[app.priority] }} />
              {PRIORITY_DISPLAY[app.priority]}
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">责任人</div>
            <div className="detail-value">
              {getUserName(app.responsible_person)} <span style={{ color: '#6b7280' }}>({getUserRole(app.responsible_person)})</span>
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">当前处理人</div>
            <div className="detail-value">
              {getUserName(app.current_handler)} <span style={{ color: '#6b7280' }}>({getUserRole(app.current_handler)})</span>
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">截止时间</div>
            <div className={`detail-value ${deadlineClass}`}>
              {formatDate(app.deadline)}
              {app.is_overdue && ' (已逾期)'}
              {app.is_near_deadline && !app.is_overdue && ' (临近)'}
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">异常标签</div>
            <div>
              {app.exception_tags.length === 0 ? (
                <span style={{ color: '#9ca3af' }}>无</span>
              ) : (
                app.exception_tags.map((t, i) => (
                  <span key={i} className={`tag ${t.includes('逾期') || t.includes('异常') ? 'tag-red' : 'tag-blue'}`}>
                    {t}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {isCorrectionStatus && (
          <div
            style={{
              marginTop: '16px',
              padding: '14px 18px',
              borderRadius: '8px',
              background: hasValidEvidence ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${hasValidEvidence ? '#10b981' : '#ef4444'}`,
              fontSize: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {hasValidEvidence ? (
                <>
                  <span style={{ fontSize: '20px' }}>✅</span>
                  <strong style={{ color: '#065f46' }}>
                    已具备 {evidenceAttachments.length} 份有效补正证据（is_evidence=true，已持久化至 SQLite 可追溯）
                  </strong>
                  <span style={{ color: '#059669' }}>
                    — 可提交补正，所有证据、处理记录、异常原因将写回同一申请轨迹
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '20px' }}>❌</span>
                  <strong style={{ color: '#991b1b' }}>
                    缺少有效补正证据 — 请先在下方「附件」区上传补正文件
                  </strong>
                  <span style={{ color: '#b91c1c' }}>
                    (异常回传/待补正状态下上传的附件会自动标记 is_evidence=true)
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="section-title">附件（办理证据）</div>
        {detail.attachments.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '16px' }}>暂无附件</div>
        ) : (
          <div style={{ marginBottom: '16px' }}>
            {detail.attachments.map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  background: a.is_evidence ? '#fef3c7' : '#f9fafb',
                  borderRadius: '6px',
                  marginBottom: '6px',
                  fontSize: '14px',
                }}
              >
                📎 <strong>{a.file_name}</strong>
                {a.is_evidence && (
                  <span
                    className="tag tag-red"
                    style={{ background: '#b45309', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}
                  >
                    补正证据(SQLite可追溯)
                  </span>
                )}
                <span style={{ color: '#6b7280', fontSize: '12px' }}>
                  由 {getUserName(a.uploaded_by)} 于 {formatDate(a.uploaded_at)} 上传
                </span>
              </div>
            ))}
          </div>
        )}
        <AttachmentUploader
          applicationId={app.id}
          applicationStatus={app.status}
          currentHandler={app.current_handler}
          currentUserId={user.id}
          onUploaded={loadDetail}
        />

        <div className="section-title" style={{ marginTop: '24px' }}>处理结果 / 退回原因（办理表单）</div>
        {!canAct ? (
          <div style={{ padding: '12px', background: '#fef3c7', color: '#92400e', borderRadius: '6px', fontSize: '14px', marginBottom: '16px' }}>
            ⚠️ 当前处理人为 <strong>{getUserName(app.current_handler)}</strong>（{getUserRole(app.current_handler)}），您无权办理此单据。
            已归档单据不可再操作。
          </div>
        ) : availableActions.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>当前状态无可执行操作</div>
        ) : (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
              {availableActions.map((act) => {
                const actDisabled = act === 'correct' && !canCorrect;
                return (
                  <button
                    key={act}
                    className={`btn ${act === 'return' ? 'btn-warning' : act === 'correct' ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => setSelectedAction(selectedAction === act ? null : act)}
                    disabled={actDisabled}
                    title={actDisabled ? '请先上传 is_evidence=true 的补正证据附件' : ''}
                    style={actDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                  >
                    {ACTION_LABELS[act] || act}
                    {actDisabled && ' (缺证据)'}
                  </button>
                );
              })}
            </div>

            {selectedAction && (
              <div style={{ padding: '16px', background: '#f3f4f6', borderRadius: '6px' }}>
                {needsResult && (
                  <div className="form-group">
                    <label>办理结果 <span style={{ color: '#dc2626' }}>*</span></label>
                    <textarea
                      value={resultText}
                      onChange={(e) => setResultText(e.target.value)}
                      placeholder="请填写办理结果，作为必填证据"
                    />
                  </div>
                )}
                {needsReturnReason && (
                  <div className="form-group">
                    <label>退回原因 <span style={{ color: '#dc2626' }}>*</span></label>
                    <div
                      style={{
                        padding: '8px 12px',
                        background: '#fef2f2',
                        color: '#b91c1c',
                        borderRadius: '6px',
                        fontSize: '12px',
                        marginBottom: '8px',
                      }}
                    >
                      ⚠️ 退回原因将同时写入「处理记录时间线」和「异常日志」统一轨迹，作为该补货申请的永久审计证据，不可删除。
                    </div>
                    <textarea
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="请填写退回补正原因，必填证据（将记入申请轨迹）"
                    />
                  </div>
                )}
                {needsEvidenceAlert && (
                  <div style={{ padding: '10px', background: '#fef2f2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px', marginBottom: '10px' }}>
                    ⚠️ 补正操作必须具备 <strong>is_evidence=true</strong> 的有效附件。
                    当前共有 {detail.attachments.length} 份附件，其中 {evidenceAttachments.length} 份为有效补正证据。
                    请在「异常回传 / 待补正」状态下通过上方附件上传区上传补正文件（系统将自动标记为补正证据并持久化至 SQLite）。
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleAction}
                    disabled={processing || (selectedAction === 'correct' && !canCorrect)}
                  >
                    {processing ? <><span className="spinner" /> 处理中</> : '确认办理'}
                  </button>
                  <button className="btn" onClick={() => setSelectedAction(null)} disabled={processing}>
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div style={{ marginTop: '10px', padding: '10px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '13px' }}>
            ❌ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ marginTop: '10px', padding: '10px', background: '#dcfce7', color: '#166534', borderRadius: '6px', fontSize: '13px' }}>
            ✅ {successMsg}
          </div>
        )}

        <div className="section-title" style={{ marginTop: '24px' }}>审计备注</div>
        <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="添加审计备注（记录在审计轨迹）"
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={addAuditNote}>添加</button>
        </div>
        {detail.audit_notes.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '16px' }}>暂无审计备注</div>
        ) : (
          <div style={{ marginBottom: '16px' }}>
            {detail.audit_notes.map((n) => (
              <div key={n.id} style={{ padding: '8px 12px', background: '#f0f9ff', borderRadius: '6px', marginBottom: '6px', fontSize: '13px' }}>
                <strong>{n.author_name}</strong>
                <span style={{ color: '#6b7280', marginLeft: '8px', fontSize: '12px' }}>{formatDate(n.created_at)}</span>
                <div style={{ marginTop: '4px', color: '#374151' }}>{n.note}</div>
              </div>
            ))}
          </div>
        )}

        <div className="section-title" style={{ marginTop: '24px' }}>处理记录（审计轨迹）</div>
        <div className="timeline">
          {detail.processing_records.map((r) => (
            <div key={r.id} className="timeline-item">
              <div className="timeline-header">
                {r.operator_name}
                <span style={{ marginLeft: '8px', display: 'inline-block' }}>
                  <span className="status-badge" style={{ background: STATUS_COLOR[r.to_status] }}>
                    {ACTION_LABELS[r.action] || r.action}
                  </span>
                </span>
                <span className="timeline-time">{formatDate(r.processed_at)}</span>
              </div>
              <div className="timeline-body">
                {r.from_status && (
                  <div>
                    <strong>状态流转：</strong>
                    {STATUS_DISPLAY[r.from_status]} → {STATUS_DISPLAY[r.to_status]}
                  </div>
                )}
                {r.result && (
                  <div>
                    <strong>结果：</strong>
                    {r.result}
                  </div>
                )}
                {r.return_reason && (
                  <div style={{ color: '#b91c1c' }}>
                    <strong>退回原因：</strong>
                    {r.return_reason}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {(detail.exception_logs.length > 0 || true) && (
          <>
            <div className="section-title" style={{ marginTop: '24px' }}>异常日志（统一轨迹）</div>
            <div style={{ padding: '10px', background: '#fff7ed', borderRadius: '6px', marginBottom: '10px', fontSize: '12px', color: '#92400e' }}>
              ⚠️ 缺材料、逾期、退回补正、旧版本状态冲突、越权、批量拦截等所有异常均记录于此，
              与上方「处理记录时间线」同属该补货申请的<strong>统一审计轨迹</strong>，不可删除。
            </div>
            {detail.exception_logs.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '16px' }}>暂无异常记录</div>
            ) : (
              detail.exception_logs.map((l) => (
                <div key={l.id} style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: '6px', marginBottom: '6px', fontSize: '13px' }}>
                  <strong style={{ color: '#b91c1c' }}>[{l.exception_type}]</strong>
                  {l.operator_id && <span style={{ marginLeft: '6px' }}>by {getUserName(l.operator_id)}</span>}
                  <span style={{ color: '#6b7280', marginLeft: '8px', fontSize: '12px' }}>{formatDate(l.created_at)}</span>
                  <div style={{ marginTop: '4px', color: '#374151' }}>{l.description}</div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
