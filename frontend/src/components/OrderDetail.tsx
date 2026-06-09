import React, { useState, useEffect } from 'react';
import { api, type User, type DictItem, type OrderDetail as IOrderDetail, type Attachment } from '../lib/api';

interface Props {
  orderId: string;
  user: User;
  dict: {
    roles: DictItem[];
    statuses: DictItem[];
    abnormalTypes: DictItem[];
    warningLevels: DictItem[];
    transitions: Record<string, string[]>;
  } | null;
  onClose: () => void;
  onMessage: (type: string, text: string) => void;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { hour12: false });
};

const EVIDENCE_LABEL: Record<string, string> = {
  prescription: '处方单',
  id_card: '身份证明',
  sign_off: '签收确认',
  other: '其他'
};

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  view: '查看',
  update_status: '状态变更',
  batch_update: '批量处理',
  upload_attachment: '上传附件',
  review: '复核通过',
  return_correction: '退回补正'
};

const OrderDetail: React.FC<Props> = ({ orderId, user, dict, onClose, onMessage }) => {
  const [order, setOrder] = useState<IOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'basic' | 'evidence' | 'records' | 'audit'>('basic');
  const [toStatus, setToStatus] = useState('');
  const [note, setNote] = useState('');
  const [abnormalReason, setAbnormalReason] = useState('');
  const [abnormalType, setAbnormalType] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newAtt, setNewAtt] = useState({ file_name: '', evidence_type: 'prescription' });

  const load = async () => {
    setLoading(true);
    const r = await api.getOrder(orderId);
    setLoading(false);
    if (r.code === 0 && r.data) {
      setOrder(r.data);
      if (r.data.correction_note) setCorrectionNote(r.data.correction_note);
    } else {
      onMessage('error', r.message || '加载失败');
      onClose();
    }
  };

  useEffect(() => { load(); }, [orderId]);

  if (loading || !order) {
    return (
      <div className="modal-backdrop"><div className="modal small">
        <div className="modal-header"><h3>加载中...</h3></div>
      </div></div>
    );
  }

  const allowedTargets = dict?.transitions?.[order.status] || [];
  const canReviewSigned = allowedTargets.includes('signed') && order.status === 'signed';

  const isHandler = order.handler_role === user.role &&
    (!order.handler_id || order.handler_id === user.id);

  const handleAction = async () => {
    if (!toStatus && !canReviewSigned) { setError('请选择目标状态'); return; }
    const target = toStatus || (canReviewSigned ? 'signed' : '');
    if (!target) return;

    setSubmitting(true);
    setError(null);
    const r = await api.updateStatus(order.id, {
      to_status: target,
      version: order.version,
      note,
      abnormal_reason: abnormalReason || undefined,
      abnormal_type: abnormalType || undefined,
      correction_note: correctionNote || undefined
    });
    setSubmitting(false);
    if (r.code === 0 && r.data) {
      onMessage('success', `已将订单状态变更为「${r.data.statusName}」`);
      onClose();
    } else {
      let msg = r.message || '处理失败';
      const detailParts: string[] = [];
      if (r.current_status_name) detailParts.push(`当前状态：${r.current_status_name}`);
      if (r.current_version !== undefined) detailParts.push(`版本：v${r.current_version}`);
      if (r.handler_name) detailParts.push(`当前处理人：${r.handler_name}`);
      if (detailParts.length > 0) msg += `（${detailParts.join('，')}）`;
      if (r.correction_note) msg += `\n💡 补正提示：${r.correction_note}`;
      setError(msg);
      if (r.code === 400 || r.code === 409) {
        onMessage('warning', msg);
      }
    }
  };

  const handleUpload = async () => {
    if (!newAtt.file_name.trim()) { onMessage('error', '请输入文件名'); return; }
    const r = await api.uploadAttachment(order.id, {
      file_name: newAtt.file_name.trim(),
      evidence_type: newAtt.evidence_type,
      file_type: 'application/octet-stream',
      file_url: '#'
    });
    if (r.code === 0 && r.data) {
      onMessage('success', '附件已上传');
      setNewAtt({ file_name: '', evidence_type: 'prescription' });
      load();
    } else {
      onMessage('error', r.message || '上传失败');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            处方订单详情：{order.order_no}
            <span className={`tag status-${order.status}`} style={{ marginLeft: 10 }}>{order.statusName}</span>
            <span className={`tag warning-${order.warningLevel}`} style={{ marginLeft: 6 }}>{order.warningName}</span>
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert error">{error}</div>}
          {(order.abnormal_reason || order.abnormal_type) && (
            <div className="alert warning">
              <b>异常原因：</b>
              {order.abnormal_type && (
                <span className="tag" style={{ marginRight: 6, background: '#fee2e2', color: '#991b1b' }}>
                  {dict?.abnormalTypes.find(t => t.value === order.abnormal_type)?.label || order.abnormal_type}
                </span>
              )}
              {order.abnormal_reason}
            </div>
          )}
          {order.correction_note && (
            <div className="alert info"><b>补正要求：</b>{order.correction_note}</div>
          )}

          <div className="detail-grid">
            <div className="detail-item"><div className="label">患者姓名</div><div className="value">{order.patient_name}</div></div>
            <div className="detail-item"><div className="label">身份证号</div><div className="value">{order.patient_id_card || '-'}</div></div>
            <div className="detail-item"><div className="label">门店</div><div className="value">{order.store_name}</div></div>
            <div className="detail-item"><div className="label">区域</div><div className="value">{order.area_name}</div></div>
            <div className="detail-item"><div className="label">药品数 / 金额</div><div className="value">{order.drugs_count} 种 / ¥{order.total_amount.toFixed(2)}</div></div>
            <div className="detail-item"><div className="label">当前版本</div><div className="value">v{order.version}</div></div>
            <div className="detail-item"><div className="label">创建人</div><div className="value">{order.created_by_name}</div></div>
            <div className="detail-item"><div className="label">创建时间</div><div className="value">{formatTime(order.created_at)}</div></div>
            <div className="detail-item"><div className="label">到期时间</div><div className="value">{formatTime(order.due_at)}</div></div>
            <div className="detail-item">
              <div className="label">当前处理人</div>
              <div className="value">
                {order.handler_name ? (
                  <span className={`tag role-${order.handler_role}`}>
                    {order.handler_name}（{dict?.roles.find(r => r.value === order.handler_role)?.label}）
                  </span>
                ) : '未分配'}
              </div>
            </div>
          </div>

          <div className="tabs">
            <div className={`tab ${activeTab === 'basic' ? 'active' : ''}`} onClick={() => setActiveTab('basic')}>办理操作</div>
            <div className={`tab ${activeTab === 'evidence' ? 'active' : ''}`} onClick={() => setActiveTab('evidence')}>证据附件（{order.attachments.length}）</div>
            <div className={`tab ${activeTab === 'records' ? 'active' : ''}`} onClick={() => setActiveTab('records')}>处理记录（{order.records.length}）</div>
            <div className={`tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>审计轨迹（{order.audits.length}）</div>
          </div>

          {activeTab === 'basic' && (
            <div>
              {isHandler ? (
                <div className="card" style={{ background: '#f7f9fc' }}>
                  <h3 style={{ marginBottom: 10 }}>办理操作</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label><span className="required">*</span>目标状态</label>
                      <select value={toStatus} onChange={e => setToStatus(e.target.value)}>
                        <option value="">请选择目标状态{canReviewSigned ? '（当前已签收，可选择「签收完成」完成复核归档）' : ''}</option>
                        {dict?.statuses.filter(s => allowedTargets.includes(s.value)).map(s => (
                          <option key={s.value} value={s.value}>{s.label}{canReviewSigned && s.value === 'signed' ? '（复核归档）' : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>异常类型（异常时必填）</label>
                      <select value={abnormalType} onChange={e => setAbnormalType(e.target.value)}>
                        <option value="">无（正常流转）</option>
                        {dict?.abnormalTypes.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {(['material_shortage', 'overdue', 'abnormal_return', 'returned_correction'].includes(toStatus) || abnormalType) && (
                    <div className="form-group">
                      <label>异常原因 / 说明</label>
                      <textarea value={abnormalReason} onChange={e => setAbnormalReason(e.target.value)} placeholder="请说明异常或补正原因" />
                    </div>
                  )}
                  {toStatus === 'returned_correction' && (
                    <div className="form-group">
                      <label>补正要求</label>
                      <textarea value={correctionNote} onChange={e => setCorrectionNote(e.target.value)} placeholder="请描述需要补正的具体要求" />
                    </div>
                  )}
                  <div className="form-group">
                    <label>备注</label>
                    <input value={note} onChange={e => setNote(e.target.value)} placeholder="可选备注" />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <button className="btn" onClick={handleAction} disabled={submitting}>
                      {submitting ? '提交中...' : '提交办理'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="alert warning">
                  您（{user.name}，{user.roleName}）非当前处理人，无权办理。当前处理人为 <b>{order.handler_name || '未分配'}</b>
                </div>
              )}

              {order.abnormals.length > 0 && (
                <div className="card">
                  <h3>异常原因登记（{order.abnormals.length}）</h3>
                  <table className="data-table">
                    <thead>
                      <tr><th>类型</th><th>说明</th><th>责任人</th><th>登记人</th><th>登记时间</th><th>状态</th></tr>
                    </thead>
                    <tbody>
                      {order.abnormals.map(a => (
                        <tr key={a.id}>
                          <td><span className="tag">{a.abnormal_type_name}</span></td>
                          <td>{a.description}</td>
                          <td>{a.responsible_person || '-'}</td>
                          <td>{a.reported_by_name}</td>
                          <td>{formatTime(a.reported_at)}</td>
                          <td>{a.resolved ? <span className="tag warning-normal">已解决</span> : <span className="tag warning-overdue">未解决</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="card">
              <h3>证据附件</h3>
              <div className="evidence-list">
                {order.attachments.length === 0 ? (
                  <div className="empty">暂无证据附件</div>
                ) : (
                  order.attachments.map(a => (
                    <div key={a.id} className="evidence-item">
                      <span>
                        <span className="evidence-type">{EVIDENCE_LABEL[a.evidence_type] || a.evidence_type}</span>
                        {a.file_name}
                        <span style={{ color: '#9ca3af', fontSize: 12, marginLeft: 8 }}>
                          — {a.uploaded_by_name}，{formatTime(a.uploaded_at)}
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </div>
              {isHandler && (
                <div style={{ marginTop: 14 }}>
                  <h3 style={{ marginBottom: 10 }}>补充证据</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>文件名</label>
                      <input value={newAtt.file_name} onChange={e => setNewAtt({ ...newAtt, file_name: e.target.value })} placeholder="例：处方_患者名.jpg" />
                    </div>
                    <div className="form-group">
                      <label>证据类型</label>
                      <select value={newAtt.evidence_type} onChange={e => setNewAtt({ ...newAtt, evidence_type: e.target.value })}>
                        <option value="prescription">处方单</option>
                        <option value="id_card">身份证明</option>
                        <option value="sign_off">签收确认</option>
                        <option value="other">其他</option>
                      </select>
                    </div>
                  </div>
                  <button className="btn secondary" onClick={handleUpload}>上传证据</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'records' && (
            <div className="card">
              <h3>处理记录（状态流转轨迹）</h3>
              <ul className="timeline">
                {order.records.map(r => (
                  <li key={r.id}>
                    <div className="time">{formatTime(r.created_at)}</div>
                    <div className="title">
                      <span className={`tag role-${r.handler_role}`}>{r.handler_name}</span>
                      <span style={{ margin: '0 6px' }}>
                        {r.from_status_name ? `${r.from_status_name} → ` : ''}
                        <b>{r.to_status_name}</b>
                      </span>
                      <span style={{ color: '#6b7280', fontSize: 12 }}>（v{r.order_version}）</span>
                    </div>
                    {r.note && <div className="note">{r.note}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="card">
              <h3>审计轨迹</h3>
              <ul className="timeline">
                {order.audits.map(a => (
                  <li key={a.id}>
                    <div className="time">{formatTime(a.created_at)}</div>
                    <div className="title">
                      <span className={`tag role-${a.operator_role}`}>{a.operator_name}</span>
                      <span style={{ marginLeft: 6 }}>
                        <b>{ACTION_LABELS[a.action] || a.action}</b>
                      </span>
                      <span style={{ color: '#6b7280', fontSize: 12 }}>（v{a.order_version}）</span>
                    </div>
                    {a.content && <div className="note">{a.content}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn secondary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;
