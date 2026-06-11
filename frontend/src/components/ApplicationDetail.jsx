import { createSignal, createEffect, For } from 'solid-js';
import { api } from '../api';

const actionLabels = {
  accept: '接单',
  process: '处理流转',
  verify: '核实流转',
  return: '退回补正',
  correct: '补正提交',
  submit: '提交申请',
  approve: '审批通过',
  reject: '不予通过',
  confirm: '确认通过',
};

const statusLabels = {
  pending: '待接单',
  accepted: '已接单',
  passed: '验收通过',
  returned: '退回补正',
  rejected: '不予通过',
};

const evidenceTypeOptions = [
  { value: 'identity_proof', label: '身份证明' },
  { value: 'difficulty_proof', label: '困难证明' },
  { value: 'visit_record', label: '走访记录' },
  { value: 'photo_evidence', label: '照片证据' },
  { value: 'approval_document', label: '审批文件' },
  { value: 'amount_calculation', label: '金额计算表' },
];

export default function ApplicationDetail({ applicationId, onClose, onUpdated }) {
  const [application, setApplication] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [action, setAction] = createSignal('');
  const [comment, setComment] = createSignal('');
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [processing, setProcessing] = createSignal(false);

  const [showUploadArea, setShowUploadArea] = createSignal(false);
  const [uploadFileName, setUploadFileName] = createSignal('');
  const [uploadFileType, setUploadFileType] = createSignal('');
  const [uploading, setUploading] = createSignal(false);

  const [exceptionLogs, setExceptionLogs] = createSignal([]);

  const loadDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getApplication(applicationId);
      setApplication(data);
      try {
        const logs = await api.getExceptionLogs(applicationId);
        setExceptionLogs(logs);
      } catch (e) {
        setExceptionLogs([]);
      }
    } catch (err) {
      setError(err.error_message || '加载详情失败');
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (applicationId) {
      loadDetail();
    }
  }, [applicationId]);

  const getAvailableActions = () => {
    const app = application();
    if (!app) return [];

    const actions = [];
    const role = app.current_handler_id === app.creator_id ? 'community_worker' :
                 app.current_handler_id === app.street_clerk_id ? 'street_clerk' :
                 app.current_handler_id === app.leader_id ? 'leader' : '';

    if (app.status === 'pending' || app.status === 'returned') {
      if (role === 'community_worker') {
        if (app.status === 'returned') {
          actions.push('correct');
        } else {
          actions.push('submit');
        }
      } else if (role === 'street_clerk' || role === 'leader') {
        actions.push('accept');
      }
    }

    if (app.status === 'accepted') {
      if (role === 'street_clerk') {
        actions.push('process', 'return');
      } else if (role === 'leader') {
        actions.push('approve', 'reject', 'return');
      }
    }

    return actions;
  };

  const handleAction = async () => {
    if (!action()) {
      setError('请选择操作');
      return;
    }

    setProcessing(true);
    setError('');
    setSuccess('');

    try {
      const result = await api.processApplication({
        application_id: applicationId,
        version: application().version,
        action: action(),
        comment: comment(),
      });
      setApplication(result);
      setSuccess(`${actionLabels[action()] || action()}操作成功`);
      setAction('');
      setComment('');
      onUpdated && onUpdated();
    } catch (err) {
      setError(`${err.error_code}: ${err.error_message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleUploadAttachment = async () => {
    if (!uploadFileName() || !uploadFileType()) {
      setError('请填写材料名称和选择材料类型');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const result = await api.uploadAttachment({
        application_id: applicationId,
        file_name: uploadFileName(),
        evidence_type: uploadFileType(),
        is_required: true,
      });
      setApplication(result);
      setUploadFileName('');
      setUploadFileType('');
      setSuccess('材料上传成功');
    } catch (err) {
      setError(`${err.error_code}: ${err.error_message}`);
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const app = application();

  return (
    <div class="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal" style={{ maxWidth: '900px' }}>
        <div class="modal-header">
          <h3>帮扶申请详情</h3>
          <button class="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div class="modal-body">
          {loading() ? (
            <div class="loading">加载中...</div>
          ) : !app ? (
            <div class="error-message">{error() || '加载失败'}</div>
          ) : (
            <>
              {error() && <div class="error-message">{error()}</div>}
              {success() && <div class="success-message">{success()}</div>}

              <div class="detail-section">
                <h4>基本信息</h4>
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="detail-label">申请编号：</span>
                    <span class="detail-value">{app.application_no}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">申请人：</span>
                    <span class="detail-value">{app.applicant_name}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">身份证号：</span>
                    <span class="detail-value">{app.applicant_id_card}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">联系电话：</span>
                    <span class="detail-value">{app.applicant_phone}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">所属社区：</span>
                    <span class="detail-value">{app.community}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">家庭住址：</span>
                    <span class="detail-value">{app.address}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">困难类型：</span>
                    <span class="detail-value">{app.difficulty_type}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">申请金额：</span>
                    <span class="detail-value">{app.apply_amount ? `¥${app.apply_amount.toFixed(2)}` : '-'}</span>
                  </div>
                </div>
              </div>

              <div class="detail-section">
                <h4>家庭情况</h4>
                <p style={{ fontSize: '14px', lineHeight: '1.8' }}>{app.family_situation}</p>
              </div>

              <div class="detail-section">
                <h4>申请理由</h4>
                <p style={{ fontSize: '14px', lineHeight: '1.8' }}>{app.application_reason}</p>
              </div>

              <div class="detail-section">
                <h4>办理状态</h4>
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="detail-label">当前节点：</span>
                    <span class="detail-value">{app.current_node_name}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">当前状态：</span>
                    <span class="detail-value">
                      <span class={`badge badge-${app.status}`}>
                        {statusLabels[app.status] || app.status}
                      </span>
                    </span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">预警状态：</span>
                    <span class="detail-value">
                      <span class={`badge badge-${app.warning_status}`}>
                        {app.warning_status_name}
                      </span>
                    </span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">当前处理人：</span>
                    <span class="detail-value">{app.current_handler || '-'}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">街道科员：</span>
                    <span class="detail-value">{app.street_clerk || '-'}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">分管领导：</span>
                    <span class="detail-value">{app.leader || '-'}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">截止时间：</span>
                    <span class="detail-value">{formatDate(app.node_deadline)}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">当前版本：</span>
                    <span class="detail-value">v{app.version}</span>
                  </div>
                </div>
              </div>

              {app.missing_evidence && app.missing_evidence.length > 0 && (
                <div class="detail-section" style={{ borderLeft: '3px solid #fa8c16', paddingLeft: '12px' }}>
                  <h4 style={{ color: '#fa8c16' }}>缺少必填材料</h4>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {app.missing_evidence.map((e) => (
                      <span class="badge badge-returned" style={{ fontSize: '13px' }}>
                        {evidenceTypeOptions.find(o => o.value === e)?.label || e}
                      </span>
                    ))}
                  </div>
                  {(app.status === 'returned' || app.status === 'pending') && (
                    <button
                      class="btn btn-primary btn-sm"
                      style={{ marginTop: '8px' }}
                      onClick={() => setShowUploadArea(!showUploadArea())}
                    >
                      {showUploadArea() ? '收起上传' : '上传补正材料'}
                    </button>
                  )}
                  {showUploadArea() && (
                    <div style={{ marginTop: '12px', padding: '12px', background: '#fafafa', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                        <div class="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label>材料名称</label>
                          <input
                            type="text"
                            value={uploadFileName()}
                            onInput={(e) => setUploadFileName(e.target.value)}
                            placeholder="如：走访记录.docx"
                          />
                        </div>
                        <div class="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label>材料类型</label>
                          <select value={uploadFileType()} onChange={(e) => setUploadFileType(e.target.value)}>
                            <option value="">请选择</option>
                            {evidenceTypeOptions.map((opt) => (
                              <option value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        <button class="btn btn-primary btn-sm" onClick={handleUploadAttachment} disabled={uploading()}>
                          {uploading() ? '上传中...' : '上传'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div class="detail-section">
                <h4>附件材料</h4>
                {app.attachments.length === 0 ? (
                  <div class="empty-state">暂无附件</div>
                ) : (
                  <table class="table">
                    <thead>
                      <tr>
                        <th>文件名</th>
                        <th>证据类型</th>
                        <th>是否必填</th>
                        <th>上传人</th>
                        <th>上传时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={app.attachments}>
                        {(att) => (
                          <tr>
                            <td>{att.file_name}</td>
                            <td>{evidenceTypeOptions.find(o => o.value === att.evidence_type)?.label || att.evidence_type}</td>
                            <td>{att.is_required ? '是' : '否'}</td>
                            <td>{att.uploaded_by}</td>
                            <td>{formatDate(att.created_at)}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                )}
              </div>

              {app.processing_records.length > 0 && (
                <div class="detail-section">
                  <h4>处理记录</h4>
                  <div class="timeline">
                    <For each={app.processing_records}>
                      {(record) => (
                        <div class="timeline-item">
                          <div class="timeline-date">
                            {formatDate(record.processing_time)} | 版本：v{record.version}
                          </div>
                          <div class="timeline-content">
                            <span class="timeline-action">{record.action}</span>
                            <span> - {record.node_name}</span>
                            <div style={{ fontSize: '13px', color: '#595959', marginTop: '4px' }}>
                              操作人：{record.operator}
                              {record.previous_status && ` | ${statusLabels[record.previous_status] || record.previous_status} → ${statusLabels[record.new_status] || record.new_status}`}
                            </div>
                            {record.comment && (
                              <div style={{ fontSize: '13px', color: '#8c8c8c', marginTop: '4px' }}>
                                备注：{record.comment}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}

              {app.audit_notes.length > 0 && (
                <div class="detail-section">
                  <h4>审计备注</h4>
                  <For each={app.audit_notes}>
                    {(note) => (
                      <div style={{
                        padding: '12px',
                        background: note.note_type === 'return_reason' ? '#fff7e6' :
                                    note.note_type === 'correction' ? '#e6fffb' :
                                    note.note_type === 'evidence_upload' ? '#f0f5ff' : '#fafafa',
                        borderRadius: '6px',
                        marginBottom: '8px',
                        borderLeft: note.note_type === 'return_reason' ? '3px solid #fa8c16' :
                                    note.note_type === 'correction' ? '3px solid #13c2c2' :
                                    note.note_type === 'evidence_upload' ? '3px solid #1890ff' : '3px solid #d9d9d9'
                      }}>
                        <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>
                          {formatDate(note.created_at)} | {note.node_name} | {note.operator} |
                          {note.note_type === 'return_reason' ? ' 退回原因' :
                           note.note_type === 'correction' ? ' 补正记录' :
                           note.note_type === 'evidence_upload' ? ' 材料上传' : ` ${note.note_type}`}
                        </div>
                        <div style={{ fontSize: '14px' }}>{note.content}</div>
                      </div>
                    )}
                  </For>
                </div>
              )}

              {exceptionLogs().length > 0 && (
                <div class="detail-section" style={{ borderLeft: '3px solid #ff4d4f', paddingLeft: '12px' }}>
                  <h4 style={{ color: '#ff4d4f' }}>异常记录</h4>
                  <For each={exceptionLogs()}>
                    {(log) => (
                      <div style={{
                        padding: '10px',
                        background: log.resolved ? '#f6ffed' : '#fff2f0',
                        borderRadius: '6px',
                        marginBottom: '6px',
                        border: '1px solid ' + (log.resolved ? '#b7eb8f' : '#ffccc7')
                      }}>
                        <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>
                          {formatDate(log.created_at)} | {log.exception_type} | {log.operator}
                          {log.resolved && <span style={{ color: '#52c41a', marginLeft: '8px' }}>已解决</span>}
                        </div>
                        <div style={{ fontSize: '14px' }}>
                          <span style={{ color: '#ff4d4f', fontWeight: 500 }}>[{log.error_code}]</span> {log.error_message}
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              )}

              {getAvailableActions().length > 0 && (
                <div class="detail-section">
                  <h4>办理操作</h4>
                  <div class="form-group">
                    <label>选择操作</label>
                    <select value={action()} onChange={(e) => setAction(e.target.value)}>
                      <option value="">请选择操作</option>
                      {getAvailableActions().map((a) => (
                        <option value={a}>{actionLabels[a] || a}</option>
                      ))}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>处理意见</label>
                    <textarea
                      value={comment()}
                      onInput={(e) => setComment(e.target.value)}
                      placeholder={action() === 'return' ? '请填写退回补正的具体原因' : '请输入处理意见（可选）'}
                    />
                  </div>
                  <button
                    class="btn btn-primary"
                    onClick={handleAction}
                    disabled={processing() || !action() || (action() === 'return' && !comment())}
                  >
                    {processing() ? '处理中...' : '提交处理'}
                  </button>
                  {action() === 'return' && !comment() && (
                    <span style={{ color: '#fa8c16', fontSize: '12px', marginLeft: '8px' }}>退回补正必须填写原因</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
