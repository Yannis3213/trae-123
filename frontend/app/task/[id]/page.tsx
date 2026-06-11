'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  SamplingTask,
  ProcessingRecord,
  AuditNote,
  Attachment,
  AbnormalReason,
  ROLE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  UserRole,
} from '@/types';
import { taskApi, formatDate, parseAbnormalTags } from '@/lib/api';
import { useRole } from '@/lib/roleContext';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { currentRole, setCurrentRole, currentUserName, triggerRefresh } = useRole();

  const [task, setTask] = useState<SamplingTask | null>(null);
  const [records, setRecords] = useState<ProcessingRecord[]>([]);
  const [auditNotes, setAuditNotes] = useState<AuditNote[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [abnormalReasons, setAbnormalReasons] = useState<AbnormalReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('records');
  const [showActionModal, setShowActionModal] = useState(false);
  const [currentAction, setCurrentAction] = useState('');
  const [actionForm, setActionForm] = useState({
    opinion: '',
    return_reason: '',
    audit_note: '',
    new_handler: '',
    new_deadline: '',
    has_evidence: false,
  });
  const [actionError, setActionError] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ type: string; msg: string } | null>(null);

  const fetchDetail = async () => {
    if (!id) return;

    setLoading(true);
    setError('');
    try {
      const data = await taskApi.get(id, currentRole);
      setTask(data.task);
      setRecords(data.processing_records);
      setAuditNotes(data.audit_notes);
      setAttachments(data.attachments);
      setAbnormalReasons(data.abnormal_reasons);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && currentRole) {
      fetchDetail();
    }
  }, [id, currentRole]);

  const showAlert = (type: string, msg: string) => {
    setAlertMsg({ type, msg });
    setTimeout(() => setAlertMsg(null), 3000);
  };

  const getAvailableActions = () => {
    if (!task) return [];

    const actions: { value: string; label: string; type: string }[] = [];

    if (currentRole === 'sampling_supervisor') {
      if (task.status === 'pending_assignment' || task.status === 'returned') {
        actions.push({ value: 'assign', label: '分派任务', type: 'primary' });
      }
      if (task.status === 'assigned' || task.status === 'pending_review') {
        actions.push({ value: 'review', label: '审核通过', type: 'success' });
      }
      if (task.status !== 'archived') {
        actions.push({ value: 'return', label: '退回补正', type: 'danger' });
      }
      actions.push({ value: 'reassign', label: '转办', type: 'default' });
      actions.push({ value: 'add_evidence', label: '补充证据', type: 'default' });
    }

    if (currentRole === 'factory_reviewer') {
      if (task.status === 'reviewed' || task.status === 'pending_verification') {
        actions.push({ value: 'verify', label: '复核确认', type: 'primary' });
      }
      if (task.status === 'verified' || task.status === 'pending_verification') {
        actions.push({ value: 'archive', label: '归档', type: 'success' });
      }
      if (task.status !== 'archived') {
        actions.push({ value: 'return', label: '退回', type: 'danger' });
      }
    }

    if (currentRole === 'sampling_registrar') {
      if (task.status === 'returned') {
        actions.push({ value: 'rectify', label: '补正提交', type: 'primary' });
      }
      actions.push({ value: 'add_evidence', label: '补充证据', type: 'default' });
    }

    return actions;
  };

  const handleActionClick = (action: string) => {
    setCurrentAction(action);
    setShowActionModal(true);
    setActionError('');
    setActionForm({
      opinion: '',
      return_reason: '',
      audit_note: '',
      new_handler: '',
      new_deadline: task ? new Date(task.deadline).toISOString().slice(0, 16) : '',
      has_evidence: task?.has_mass_production_evidence || false,
    });
  };

  const handleSubmitAction = async () => {
    if (!task) return;
    setActionError('');

    if (currentAction === 'return') {
      if (!actionForm.opinion?.trim()) {
        setActionError('退回任务必须填写处理意见');
        return;
      }
      if (!actionForm.return_reason?.trim()) {
        setActionError('退回任务必须填写退回原因');
        return;
      }
      if (!actionForm.audit_note?.trim()) {
        setActionError('退回任务必须填写审计备注');
        return;
      }
    }

    if (currentAction === 'reassign') {
      if (!actionForm.opinion?.trim()) {
        setActionError('转办任务必须填写处理意见');
        return;
      }
      if (!actionForm.audit_note?.trim()) {
        setActionError('转办任务必须填写审计备注');
        return;
      }
      if (!actionForm.new_handler) {
        setActionError('请选择新处理人');
        return;
      }
    }

    if (currentAction === 'assign' && !actionForm.new_handler) {
      setActionError('请选择新处理人');
      return;
    }

    try {
      await taskApi.process({
        task_id: task.id,
        action: currentAction,
        operator_role: currentRole,
        operator_name: currentUserName,
        opinion: actionForm.opinion || undefined,
        return_reason: actionForm.return_reason || undefined,
        audit_note: actionForm.audit_note || undefined,
        version: task.version,
        new_handler: actionForm.new_handler || undefined,
        new_deadline: actionForm.new_deadline
          ? new Date(actionForm.new_deadline).toISOString()
          : undefined,
        has_mass_production_evidence: actionForm.has_evidence,
      });

      showAlert('success', '操作成功');
      setShowActionModal(false);
      triggerRefresh();
      fetchDetail();
    } catch (e: any) {
      setActionError(e.message || '操作失败');
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      assign: '分派任务',
      review: '审核通过',
      verify: '复核确认',
      archive: '归档',
      return: '退回补正',
      rectify: '补正提交',
      reassign: '转办任务',
      add_evidence: '补充证据',
      create: '创建任务',
    };
    return labels[action] || action;
  };

  if (loading) {
    return (
      <div className="container">
        <div className="detail-card">
          <div className="detail-card-body">
            <div className="loading">加载中...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="container">
        <div className="alert alert-error">{error || '任务不存在'}</div>
        <Link href="/" className="back-link">
          ← 返回列表
        </Link>
      </div>
    );
  }

  const abnormalTags = parseAbnormalTags(task.abnormal_tags);
  const actions = getAvailableActions();

  return (
    <div className="container">
      {alertMsg && (
        <div className={`alert alert-${alertMsg.type}`}>
          {alertMsg.msg}
        </div>
      )}

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/" className="back-link" style={{ marginBottom: 0 }}>
            ← 返回列表
          </Link>
          <div>
            <div className="page-title">{task.task_name}</div>
            <div className="page-subtitle">订单号：{task.order_no}</div>
          </div>
        </div>
        <div className="role-selector">
          <label>当前角色：</label>
          <select
            value={currentRole}
            onChange={(e) => setCurrentRole(e.target.value as UserRole)}
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {task.status === 'returned' && task.return_reason && (
        <div className="alert alert-warning">
          <strong>退回原因：</strong>
          {task.return_reason}
        </div>
      )}

      {task.is_overdue && (
        <div className="alert alert-error">
          <strong>逾期提醒：</strong>
          该任务已逾期，请尽快处理。{task.overdue_reason && `原因：${task.overdue_reason}`}
        </div>
      )}

      {!task.has_mass_production_evidence && (
        <div className="alert alert-warning">
          <strong>资料缺失：</strong>
          缺少大货排产证据，无法完成归档/复核，请先补充证据。
        </div>
      )}

      <div className="detail-card">
        <div className="detail-card-body">
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-item-label">任务状态</div>
              <div className="detail-item-value">
                <span
                  className="tag tag-status"
                  style={{ background: STATUS_COLORS[task.status] || '#999' }}
                >
                  {STATUS_LABELS[task.status] || task.status}
                </span>
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">优先级</div>
              <div className="detail-item-value">
                <span
                  className="tag tag-priority"
                  style={{ background: PRIORITY_COLORS[task.priority] || '#999' }}
                >
                  {PRIORITY_LABELS[task.priority] || task.priority}
                </span>
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">订单号</div>
              <div className="detail-item-value">{task.order_no}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">款式号</div>
              <div className="detail-item-value">{task.style_no || '-'}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">责任人</div>
              <div className="detail-item-value">{task.responsible_person}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">当前处理人</div>
              <div className="detail-item-value">{task.current_handler}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">截止时间</div>
              <div className="detail-item-value">{formatDate(task.deadline)}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">版本号</div>
              <div className="detail-item-value">v{task.version}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">样衣确认状态</div>
              <div className="detail-item-value">
                {task.sample_confirmation_status === 'completed'
                  ? '已完成'
                  : task.sample_confirmation_status === 'confirmed'
                  ? '已确认'
                  : task.sample_confirmation_status === 'in_progress'
                  ? '进行中'
                  : '待确认'}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">大货排产证据</div>
              <div className="detail-item-value">
                {task.has_mass_production_evidence ? (
                  <span style={{ color: '#52c41a' }}>已提供</span>
                ) : (
                  <span style={{ color: '#f5222d' }}>缺失</span>
                )}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">创建人</div>
              <div className="detail-item-value">{task.created_by}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">创建时间</div>
              <div className="detail-item-value">{formatDate(task.created_at)}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">最后更新人</div>
              <div className="detail-item-value">{task.last_updated_by}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">最后更新时间</div>
              <div className="detail-item-value">{formatDate(task.updated_at)}</div>
            </div>
          </div>

          {abnormalTags.length > 0 && (
            <>
              <div className="divider" />
              <div className="section-title">异常标签</div>
              <div>
                {abnormalTags.map((tag, i) => (
                  <span key={i} className="tag tag-abnormal" style={{ padding: '4px 10px' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {actions.length > 0 && (
        <div className="action-section">
          <div className="section-title">办理操作</div>
          <div className="action-buttons">
            {actions.map((action) => (
              <button
                key={action.value}
                className={`btn btn-${action.type}`}
                onClick={() => handleActionClick(action.value)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="detail-card">
        <div className="detail-card-header">
          <div className="tab-group" style={{ marginBottom: 0, borderBottom: 'none' }}>
            <div
              className={`tab-item ${activeTab === 'records' ? 'active' : ''}`}
              onClick={() => setActiveTab('records')}
            >
              处理记录
            </div>
            <div
              className={`tab-item ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              审计备注
            </div>
            <div
              className={`tab-item ${activeTab === 'attachments' ? 'active' : ''}`}
              onClick={() => setActiveTab('attachments')}
            >
              附件
            </div>
            <div
              className={`tab-item ${activeTab === 'abnormal' ? 'active' : ''}`}
              onClick={() => setActiveTab('abnormal')}
            >
              异常原因
            </div>
          </div>
        </div>
        <div className="detail-card-body">
          {activeTab === 'records' && (
            <div className="timeline">
              {records.length === 0 ? (
                <div className="empty">暂无处理记录</div>
              ) : (
                records.map((record) => (
                  <div key={record.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="timeline-action">
                          {getActionLabel(record.action)}
                        </span>
                        <span className="timeline-time">
                          {formatDate(record.created_at)}
                        </span>
                      </div>
                      <div className="timeline-operator">
                        操作人：{record.operator_name}（
                        {ROLE_LABELS[record.operator_role as keyof typeof ROLE_LABELS] ||
                          record.operator_role}
                        ）
                        {record.handler_before && record.handler_after && (
                          <>
                            {' · '}处理人：{record.handler_before} → {record.handler_after}
                          </>
                        )}
                        {record.from_status && record.to_status && (
                          <>
                            {' · '}状态：
                            {STATUS_LABELS[record.from_status] || record.from_status} →{' '}
                            {STATUS_LABELS[record.to_status] || record.to_status}
                          </>
                        )}
                        {' · '}版本：v{record.version}
                      </div>
                      {record.opinion && (
                        <div className="timeline-desc">处理意见：{record.opinion}</div>
                      )}
                      {record.result && (
                        <div className="timeline-desc">处理结果：{record.result}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'audit' && (
            <div>
              {auditNotes.length === 0 ? (
                <div className="empty">暂无审计备注</div>
              ) : (
                auditNotes.map((note) => (
                  <div key={note.id} className="audit-note-item">
                    <div className="audit-note-header">
                      <span>
                        {note.operator_name}（
                        {ROLE_LABELS[note.operator_role as keyof typeof ROLE_LABELS] ||
                          note.operator_role}
                        ）
                      </span>
                      <span>{formatDate(note.created_at)}</span>
                    </div>
                    <div className="audit-note-content">{note.note_content}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'attachments' && (
            <div>
              {attachments.length === 0 ? (
                <div className="empty">暂无附件</div>
              ) : (
                attachments.map((att) => (
                  <div key={att.id} className="attachment-item">
                    <div className="attachment-icon">📄</div>
                    <div className="attachment-info">
                      <div className="attachment-name">{att.file_name}</div>
                      <div className="attachment-meta">
                        {att.file_type} · {Math.round(att.file_size / 1024)} KB · 上传人：
                        {att.uploaded_by} · {formatDate(att.uploaded_at)}
                        {att.evidence_type && ` · 证据类型：${att.evidence_type}`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'abnormal' && (
            <div>
              {abnormalReasons.length === 0 ? (
                <div className="empty">暂无异常记录</div>
              ) : (
                abnormalReasons.map((reason) => (
                  <div key={reason.id} className="abnormal-item">
                    <div className="abnormal-item-header">
                      <span>
                        {reason.reason_type === 'return' ? '退回原因' : reason.reason_type}
                      </span>
                      <span>{formatDate(reason.created_at)}</span>
                    </div>
                    <div className="abnormal-item-desc">{reason.description}</div>
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                      记录人：{reason.operator_name}（
                      {ROLE_LABELS[reason.operator_role as keyof typeof ROLE_LABELS] ||
                        reason.operator_role}
                      ）
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showActionModal && (
        <div className="modal-mask" onClick={() => setShowActionModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{getActionLabel(currentAction)}</div>
              <button className="modal-close" onClick={() => setShowActionModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {actionError && <div className="alert alert-error">{actionError}</div>}

              <div className="form-group">
                <label>处理意见{(currentAction === 'return' || currentAction === 'reassign') && ' *'}</label>
                <textarea
                  value={actionForm.opinion}
                  onChange={(e) =>
                    setActionForm({ ...actionForm, opinion: e.target.value })
                  }
                  placeholder={
                    currentAction === 'return' || currentAction === 'reassign'
                      ? '请输入处理意见（必填）'
                      : '请输入处理意见（可选）'
                  }
                />
              </div>

              {(currentAction === 'return') && (
                <div className="form-group">
                  <label>退回原因 *</label>
                  <textarea
                    value={actionForm.return_reason}
                    onChange={(e) =>
                      setActionForm({ ...actionForm, return_reason: e.target.value })
                    }
                    placeholder="请详细说明退回原因（必填）"
                  />
                </div>
              )}

              {(currentAction === 'assign' || currentAction === 'reassign') && (
                <div className="form-group">
                  <label>新处理人 *</label>
                  <select
                    value={actionForm.new_handler}
                    onChange={(e) =>
                      setActionForm({ ...actionForm, new_handler: e.target.value })
                    }
                  >
                    <option value="">请选择</option>
                    <option value="sampling_supervisor">打样审核主管（李主管）</option>
                    <option value="factory_reviewer">加工厂复核负责人（王厂长）</option>
                    <option value="sampling_registrar">打样登记员（张登记）</option>
                  </select>
                </div>
              )}

              {(currentAction === 'rectify' || currentAction === 'add_evidence' || currentAction === 'verify' || currentAction === 'archive') && (
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={actionForm.has_evidence}
                      onChange={(e) =>
                        setActionForm({ ...actionForm, has_evidence: e.target.checked })
                      }
                      style={{ marginRight: '8px' }}
                    />
                    已提供大货排产证据
                  </label>
                  {currentAction === 'archive' && (
                    <div className="hint" style={{ color: '#f5222d' }}>
                      归档前必须确认大货排产证据已齐全
                    </div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>调整截止时间</label>
                <input
                  type="datetime-local"
                  value={actionForm.new_deadline}
                  onChange={(e) =>
                    setActionForm({ ...actionForm, new_deadline: e.target.value })
                  }
                />
                <div className="hint">留空则不修改截止时间</div>
              </div>

              <div className="form-group">
                <label>审计备注{(currentAction === 'return' || currentAction === 'reassign') && ' *'}</label>
                <textarea
                  value={actionForm.audit_note}
                  onChange={(e) =>
                    setActionForm({ ...actionForm, audit_note: e.target.value })
                  }
                  placeholder={
                    currentAction === 'return' || currentAction === 'reassign'
                      ? '请输入审计备注（必填，将记录到审计轨迹中）'
                      : '请输入审计备注（可选，将记录到审计轨迹中）'
                  }
                />
              </div>

              <div className="alert alert-info">
                当前版本：v{task.version}，操作后版本号将自动递增
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowActionModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSubmitAction}>
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
