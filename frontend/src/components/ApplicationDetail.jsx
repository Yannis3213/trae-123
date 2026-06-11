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

export default function ApplicationDetail({ applicationId, onClose, onUpdated }) {
  const [application, setApplication] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [action, setAction] = createSignal('');
  const [comment, setComment] = createSignal('');
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [processing, setProcessing] = createSignal(false);

  const loadDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getApplication(applicationId);
      setApplication(data);
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
        actions.push('approve', 'reject');
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
                            <td>{att.evidence_type || '-'}</td>
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
                      <div style={{ padding: '12px', background: '#fafafa', borderRadius: '6px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>
                          {formatDate(note.created_at)} | {note.node_name} | {note.operator}
                        </div>
                        <div style={{ fontSize: '14px' }}>{note.content}</div>
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
                      placeholder="请输入处理意见（可选）"
                    />
                  </div>
                  <button
                    class="btn btn-primary"
                    onClick={handleAction}
                    disabled={processing() || !action()}
                  >
                    {processing() ? '处理中...' : '提交处理'}
                  </button>
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
