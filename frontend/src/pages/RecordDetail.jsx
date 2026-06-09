import { h, useState, useEffect } from 'preact';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api.js';
import HandleModal from '../components/HandleModal.jsx';

const DEADLINE_LABEL = { normal: '正常', warning: '临期', overdue: '逾期' };
const ACTION_LABEL = {
  submit: '提交',
  accept: '接单审核通过',
  reject: '退回',
  correction_submit: '补正提交',
  correction_accept: '补正通过',
  verify: '复核归档'
};

export default function RecordDetail({ user, showToast }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [showHandle, setShowHandle] = useState(false);
  const [handleAction, setHandleAction] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const r = await api.getRecord(id);
      setRecord(r);
    } catch (err) {
      showToast(err.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const canHandle = record && !record.archived && record.current_handler === user.username;

  const availableActions = (() => {
    if (!canHandle) return [];
    const acts = [];
    if (record.status === 'pending_review' || record.status === 'pending_supervisor_correction') {
      if (record.health_status !== 'abnormal') {
        acts.push({ key: 'accept', label: '接单通过', className: 'btn btn-success' });
      }
      acts.push({ key: 'reject', label: '退回登记员', className: 'btn btn-danger' });
    } else if (record.status === 'pending_registrar_correction' || record.status === 'pending_registration') {
      acts.push({ key: 'correction_submit', label: '补正并提交', className: 'btn btn-warning' });
    } else if (record.status === 'accepted') {
      if (record.health_status !== 'abnormal') {
        acts.push({ key: 'verify', label: '复核通过并归档', className: 'btn btn-success' });
      }
      acts.push({ key: 'reject', label: '退回主管补正', className: 'btn btn-danger' });
    }
    return acts;
  })();

  const handleActionClick = (action) => {
    setHandleAction(action);
    setShowHandle(true);
  };

  const handleDone = () => {
    setShowHandle(false);
    setHandleAction(null);
    loadData();
  };

  if (loading) return <div class="main"><div class="content"><div class="empty">加载中...</div></div></div>;
  if (!record) return <div class="main"><div class="content"><div class="empty">记录不存在或无权访问</div></div></div>;

  return (
    <div class="main">
      <div class="content">
        <div class="detail-page">
          <div class="detail-main">
            <div class="card">
              <span class="back-link" onClick={() => navigate('/')}>← 返回列表</span>
              <div class="detail-header">
                <div class="title-row">
                  <h2>晨检记录详情</h2>
                  <div class="meta">
                    单据编号：{record.id.slice(0, 8)} | 创建时间：{new Date(record.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span class={`badge badge-${record.status}`} style={{ fontSize: 14, padding: '4px 12px' }}>{record.status_name}</span>
                  <div style={{ marginTop: 8 }}>
                    <span class="version-tag">版本 v{record.version}</span>
                    {!record.archived && record.deadline && (
                      <span class={`deadline-badge deadline-${record.deadline_status}`} style={{ marginLeft: 8 }}>
                        {DEADLINE_LABEL[record.deadline_status]} | 截止：{new Date(record.deadline).toLocaleString('zh-CN')}
                      </span>
                    )}
                    {record.archived && <span class="deadline-badge deadline-normal" style={{ marginLeft: 8 }}>已归档</span>}
                  </div>
                </div>
              </div>

              <h3 style={{ marginTop: 8 }}>幼儿信息</h3>
              {record.child && (
                <div class="info-grid">
                  <div class="item"><span class="label">姓名：</span>{record.child.name}</div>
                  <div class="item"><span class="label">班级：</span>{record.child.class_name}</div>
                  <div class="item"><span class="label">出生日期：</span>{record.child.birth_date || '-'}</div>
                  <div class="item"><span class="label">家长电话：</span>{record.child.parent_phone || '-'}</div>
                  <div class="item"><span class="label">过敏史：</span>{record.child.allergies || '无'}</div>
                </div>
              )}
            </div>

            <div class="card">
              <h3>晨检信息</h3>
              <div class="info-grid">
                <div class="item"><span class="label">晨检日期：</span>{record.check_date}</div>
                <div class="item"><span class="label">体温：</span>{record.temperature ? `${record.temperature}℃` : '-'}</div>
                <div class="item">
                  <span class="label">健康状态：</span>
                  {record.health_status === 'abnormal'
                    ? <span class="tag-abnormal">异常</span>
                    : <span class="tag-normal">正常</span>}
                </div>
                {record.abnormal_type && <div class="item"><span class="label">异常类型：</span>{record.abnormal_type}</div>}
                {record.abnormal_reason && <div class="item"><span class="label">异常说明：</span>{record.abnormal_reason}</div>}
                <div class="item"><span class="label">当前处理人：</span>{record.current_handler ? `${record.current_handler_role_name || ''}·${record.current_handler}` : '（已完成）'}</div>
              </div>
              {record.health_status === 'abnormal' && (
                <div style={{ marginTop: 12, padding: 10, background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 4, fontSize: 13, color: '#cf1322' }}>
                  ⚠️ 此记录为异常记录，仅允许补正或退回，不可直接推进到下一环节
                </div>
              )}
            </div>

            <div class="card">
              <h3>证据附件（{record.attachments ? record.attachments.length : 0}）</h3>
              {record.attachments && record.attachments.length > 0 ? (
                <ul class="attachment-list">
                  {record.attachments.map(a => (
                    <li key={a.id}>
                      <span class="name">
                        <span class="type-tag">
                          {a.type === 'registration' ? '晨检登记' :
                           a.type === 'child_profile' ? '幼儿档案' :
                           a.type === 'abnormal_notice' ? '异常通知' : a.type}
                        </span>
                        {a.name}
                        {a.content && <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>— {a.content}</span>}
                      </span>
                      <span class="uploader">{a.uploaded_by} | {new Date(a.uploaded_at).toLocaleString('zh-CN')}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div class="empty">暂无附件</div>
              )}
            </div>

            <div class="card">
              <h3>处理操作</h3>
              {record.archived ? (
                <div style={{ padding: 16, textAlign: 'center', color: '#52c41a', background: '#f6ffed', borderRadius: 4 }}>
                  ✓ 此记录已完成处理并归档
                </div>
              ) : canHandle ? (
                <div>
                  <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
                    由 <strong>{record.current_handler_role_name}</strong>（{record.current_handler}）处理，您可选择以下操作：
                  </p>
                  <div class="action-bar">
                    {availableActions.map(a => (
                      <button key={a.key} class={a.className} onClick={() => handleActionClick(a.key)}>{a.label}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: 16, textAlign: 'center', color: '#999', background: '#fafafa', borderRadius: 4 }}>
                  非当前处理人，仅可查看
                </div>
              )}
            </div>
          </div>

          <div class="detail-side">
            <div class="card">
              <h3>审计备注</h3>
              {record.audit_notes && record.audit_notes.length > 0 ? (
                <ul style={{ listStyle: 'none' }}>
                  {record.audit_notes.map(n => (
                    <li key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                      <div style={{ color: '#333' }}>{n.note}</div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{n.noted_by} · {new Date(n.created_at).toLocaleString('zh-CN')}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div class="empty">暂无备注</div>
              )}
            </div>

            <div class="card">
              <h3>处理流水</h3>
              {record.logs && record.logs.length > 0 ? (
                <ul class="timeline">
                  {record.logs.map(l => (
                    <li key={l.id}>
                      <div class="time">{new Date(l.created_at).toLocaleString('zh-CN')}</div>
                      <div>
                        <span class="user">{l.action_by_name}</span>
                        <span class="role-tag">{l.action_by_role}</span>
                      </div>
                      <div class="action-text">
                        <strong>{ACTION_LABEL[l.action] || l.action}</strong>
                        {l.previous_status && `: ${l.previous_status} → ${l.new_status}`}
                      </div>
                      {l.remark && <div class="remark">备注：{l.remark}</div>}
                      {l.reject_reason && <div class="reject-reason">退回意见：{l.reject_reason}</div>}
                      {l.correction_reason && <div class="correction">补正原因：{l.correction_reason}</div>}
                      {l.evidence_summary && <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{l.evidence_summary}</div>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div class="empty">暂无处理记录</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showHandle && record && (
        <HandleModal
          record={record}
          action={handleAction}
          user={user}
          onClose={() => setShowHandle(false)}
          onSuccess={handleDone}
          showToast={showToast}
        />
      )}
    </div>
  );
}
