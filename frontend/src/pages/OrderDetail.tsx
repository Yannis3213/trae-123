import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { request, ServiceOrder, User, DEADLINE_LABEL } from '../api';
import { showToast } from '../App';

export default function OrderDetail({ user }: { user: User }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showDispatch, setShowDispatch] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showNote, setShowNote] = useState(false);

  const load = async () => {
    const res = await request<{ code: number; data: ServiceOrder }>(`/orders/${id}`);
    if (res.code === 0) setOrder(res.data);
    else {
      showToast(res.msg || '加载失败', 'error');
      navigate('/');
    }
  };

  useEffect(() => {
    load();
    request<{ code: number; data: User[] }>('/users').then(r => { if (r.code === 0) setUsers(r.data); });
  }, [id]);

  if (!order) return <div className="container"><div className="empty">加载中...</div></div>;

  const evidenceTypes = (order.attachments || []).map(a => a.evidence_type);
  const needForTransferred = ['课程排班'].filter(e => !evidenceTypes.includes(e));
  const needForReviewed = ['课后反馈', '回访记录', '家长确认'].filter(e => !evidenceTypes.includes(e));

  const canDispatch = user.role === 'jiaowu' && order.status === '待分派';
  const canReview = user.role === 'banzhuren' && order.status === '已转办';
  const canArchive = user.role === 'xiaozhang' && order.status === '已回访';
  const canReturn = (user.role === 'banzhuren' && order.status === '已转办') ||
                   (user.role === 'xiaozhang' && (order.status === '已转办' || order.status === '已回访'));

  const doDispatch = async (handlerId: number, remark: string) => {
    const res = await request(`/orders/${order.id}/process`, {
      method: 'POST',
      body: JSON.stringify({ action: '转办班主任', handler_id: handlerId, remark }),
    });
    if (res.code === 0) { showToast('转办成功', 'success'); setShowDispatch(false); load(); }
    else showToast(res.msg || '操作失败', 'error');
  };

  const doReview = async () => {
    const res = await request(`/orders/${order.id}/process`, {
      method: 'POST',
      body: JSON.stringify({ action: '完成回访转校长' }),
    });
    if (res.code === 0) { showToast('已提交校长确认', 'success'); load(); }
    else showToast(res.msg || '操作失败', 'error');
  };

  const doArchive = async () => {
    const res = await request(`/orders/${order.id}/process`, {
      method: 'POST',
      body: JSON.stringify({ action: '复核归档' }),
    });
    if (res.code === 0) { showToast('复核归档完成', 'success'); load(); }
    else showToast(res.msg || '操作失败', 'error');
  };

  const doReturn = async (action: string, reason: string, remark: string) => {
    const res = await request(`/orders/${order.id}/process`, {
      method: 'POST',
      body: JSON.stringify({ action: '退回补正', correction_action: action, exception_reason: reason, remark }),
    });
    if (res.code === 0) { showToast('已退回补正', 'success'); setShowReturn(false); load(); }
    else showToast(res.msg || '操作失败', 'error');
  };

  const doUpload = async (formData: FormData) => {
    const res = await request(`/orders/${order.id}/attachments`, {
      method: 'POST',
      body: formData,
    });
    if (res.code === 0) { showToast('上传成功', 'success'); setShowUpload(false); load(); }
    else showToast(res.msg || '上传失败', 'error');
  };

  const doNote = async (content: string) => {
    const res = await request(`/orders/${order.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    if (res.code === 0) { showToast('备注已添加', 'success'); setShowNote(false); load(); }
    else showToast(res.msg || '失败', 'error');
  };

  return (
    <div className="container detail-page">
      <button className="btn btn-default back-btn" onClick={() => navigate('/')}>← 返回列表</button>

      <div className="detail-grid">
        <div>
          <div className="detail-card">
            <h3>
              <span>课程服务单详情</span>
              <span>
                <span className={`status-tag status-${order.status}`} style={{ marginRight: 8 }}>{order.status}</span>
                <span className={`deadline-tag deadline-${order.deadline_status}`}>{DEADLINE_LABEL[order.deadline_status]}</span>
                {order.is_exception && <span className="exception-tag">异常</span>}
              </span>
            </h3>
            <div className="info-row"><div className="k">服务单号</div><div className="v">{order.order_no}（版本 v{order.version}）</div></div>
            <div className="info-row"><div className="k">学员姓名</div><div className="v">{order.student_name} {order.student_id && `(${order.student_id})`}</div></div>
            <div className="info-row"><div className="k">课程名称</div><div className="v">{order.course_name}</div></div>
            <div className="info-row"><div className="k">服务类型</div><div className="v">{order.service_type}</div></div>
            <div className="info-row"><div className="k">情况描述</div><div className="v">{order.description || '-'}</div></div>
            <div className="info-row"><div className="k">创建人</div><div className="v">{order.created_by_name || '-'}</div></div>
            <div className="info-row"><div className="k">当前处理人</div><div className="v">{order.current_handler_name || '-'}</div></div>
            <div className="info-row"><div className="k">截止时间</div><div className="v">{order.deadline || '-'}</div></div>
            <div className="info-row"><div className="k">完成时间</div><div className="v">{order.completed_at || '-'}</div></div>
            <div className="info-row"><div className="k">创建时间</div><div className="v">{order.created_at}</div></div>
            <div className="info-row"><div className="k">更新时间</div><div className="v">{order.updated_at}</div></div>
            {order.exception_reason && (
              <div className="info-row"><div className="k" style={{ color: '#dc2626' }}>异常原因</div><div className="v" style={{ color: '#dc2626' }}>{order.exception_reason}</div></div>
            )}
          </div>

          <div className="detail-card">
            <h3>
              <span>证据材料 / 附件</span>
              <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setShowUpload(true)}>+ 上传证据</button>
            </h3>
            {needForTransferred.length > 0 && (
              <div style={{ marginBottom: 10, padding: '8px 12px', background: '#fffbeb', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
                转办班主任还缺证据：{needForTransferred.join('、')}
              </div>
            )}
            {needForReviewed.length > 0 && (
              <div style={{ marginBottom: 10, padding: '8px 12px', background: '#fef2f2', borderRadius: 6, fontSize: 12, color: '#991b1b' }}>
                ⚠️ 课后反馈缺记录或材料，不能悄悄放行，还需上传：{needForReviewed.join('、')}
              </div>
            )}
            <ul className="evidence-list">
              {(order.attachments || []).length === 0 && <li style={{ color: '#9ca3af' }}>暂无证据材料</li>}
              {(order.attachments || []).map(a => (
                <li key={a.id}>
                  <div>📎 {a.filename} <span className="status-tag status-已转办" style={{ marginLeft: 8 }}>{a.evidence_type}</span></div>
                  <div className="meta">{a.uploaded_by_name} 上传于 {a.uploaded_at}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="detail-card">
            <h3>
              <span>补正动作记录</span>
              {(order.correction_actions || []).length > 0 && (
                <span className="exception-tag">{order.correction_actions?.length} 条</span>
              )}
            </h3>
            <ul className="correction-list">
              {(order.correction_actions || []).length === 0 && <li style={{ color: '#9ca3af' }}>暂无补正记录</li>}
              {(order.correction_actions || []).map(c => (
                <li key={c.id}>
                  <div><b>{c.action}</b>{c.reason && ` · 原因：${c.reason}`}</div>
                  <div className="meta">{c.operator_name} 操作于 {c.created_at}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="detail-card">
            <h3>
              <span>处理记录 / 操作流水</span>
              <button className="btn btn-default" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setShowNote(true)}>+ 添加备注</button>
            </h3>
            <ul className="record-list">
              {(order.processing_records || []).map(r => (
                <li key={r.id}>
                  <div>
                    <span className="action">{r.action}</span>
                    {r.from_status && `：${r.from_status} → `}
                    {r.to_status}
                    {r.handler_name && `，处理人：${r.handler_name}`}
                    {r.remark && <div style={{ color: '#374151', marginTop: 4 }}>备注：{r.remark}</div>}
                  </div>
                  <div className="meta">{r.operator_name} 操作于 {r.created_at}（版本 v{r.version}）</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="detail-card">
            <h3>审计备注</h3>
            <ul className="note-list">
              {(order.audit_notes || []).length === 0 && <li style={{ color: '#9ca3af' }}>暂无备注</li>}
              {(order.audit_notes || []).map(n => (
                <li key={n.id}>
                  <div>{n.content}</div>
                  <div className="meta">{n.user_name} · {n.created_at}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <div className="action-panel">
            <h3>办理操作</h3>
            <div className="action-btns">
              {canDispatch && <button className="btn btn-primary" onClick={() => setShowDispatch(true)}>转办班主任</button>}
              {canReview && <button className="btn btn-success" onClick={doReview}>完成回访并提交校长确认</button>}
              {canArchive && <button className="btn btn-success" onClick={doArchive}>复核归档</button>}
              {canReturn && <button className="btn btn-warning" onClick={() => setShowReturn(true)}>退回补正</button>}
              {!canDispatch && !canReview && !canArchive && !canReturn && (
                <div style={{ color: '#6b7280', fontSize: 13, padding: '8px 0' }}>
                  当前角色：{user.name}（{user.role === 'jiaowu' ? '教务老师' : user.role === 'banzhuren' ? '班主任' : '校区校长'}）
                  <br />在单据当前状态下暂无办理权限
                </div>
              )}
            </div>
          </div>

          <div className="detail-card">
            <h3>后端校验提示</h3>
            <ul style={{ paddingLeft: 18, fontSize: 12, color: '#6b7280', lineHeight: 2, margin: 0 }}>
              <li>角色校验：越权操作将被拦截</li>
              <li>处理人校验：非当前处理人不可操作</li>
              <li>状态校验：不符合顺序的变更被拒绝</li>
              <li>版本校验：旧版本提交冲突被拦</li>
              <li>证据校验：缺课后反馈等不能放行</li>
              <li>重复提交：同一状态多次提交拦截</li>
            </ul>
          </div>
        </div>
      </div>

      {showDispatch && <DispatchDialog users={users} onClose={() => setShowDispatch(false)} onOk={doDispatch} />}
      {showReturn && <ReturnDialog onClose={() => setShowReturn(false)} onOk={doReturn} />}
      {showUpload && <UploadDialog onClose={() => setShowUpload(false)} onOk={doUpload} />}
      {showNote && <NoteDialog onClose={() => setShowNote(false)} onOk={doNote} />}
    </div>
  );
}

function DispatchDialog({ users, onClose, onOk }: { users: User[]; onClose: () => void; onOk: (h: number, remark: string) => void }) {
  const banzhurens = users.filter(u => u.role === 'banzhuren');
  const [handlerId, setHandlerId] = useState(banzhurens[0]?.id || 0);
  const [remark, setRemark] = useState('');
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>转办班主任</h3>
        <div className="form-item">
          <label>指派处理人</label>
          <select value={handlerId} onChange={e => setHandlerId(Number(e.target.value))}>
            {banzhurens.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="form-item"><label>备注</label><textarea rows={3} value={remark} onChange={e => setRemark(e.target.value)} /></div>
        <div className="footer">
          <button className="btn btn-default" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={() => onOk(handlerId, remark)}>确认转办</button>
        </div>
      </div>
    </div>
  );
}

function ReturnDialog({ onClose, onOk }: { onClose: () => void; onOk: (a: string, r: string, m: string) => void }) {
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>退回补正</h3>
        <div className="form-item"><label>补正动作 *</label><input value={action} onChange={e => setAction(e.target.value)} placeholder="例如：重新录制回访录音" /></div>
        <div className="form-item"><label>异常原因 *</label><textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="例如：回访录音不清晰" /></div>
        <div className="form-item"><label>备注</label><textarea rows={2} value={remark} onChange={e => setRemark(e.target.value)} /></div>
        <div className="footer">
          <button className="btn btn-default" onClick={onClose}>取消</button>
          <button className="btn btn-warning" onClick={() => {
            if (!action || !reason) { showToast('请填写补正动作和异常原因', 'error'); return; }
            onOk(action, reason, remark);
          }}>确认退回</button>
        </div>
      </div>
    </div>
  );
}

function UploadDialog({ onClose, onOk }: { onClose: () => void; onOk: (f: FormData) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [evidenceType, setEvidenceType] = useState('课后反馈');
  const submit = () => {
    if (!file) { showToast('请选择文件', 'error'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('evidence_type', evidenceType);
    onOk(fd);
  };
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>上传证据材料</h3>
        <div className="form-item">
          <label>证据类型</label>
          <select value={evidenceType} onChange={e => setEvidenceType(e.target.value)}>
            <option>课后反馈</option>
            <option>回访记录</option>
            <option>家长确认</option>
            <option>课程排班</option>
            <option>学员档案</option>
            <option>其他</option>
          </select>
        </div>
        <div className="form-item"><label>选择文件</label><input type="file" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
        <div className="footer">
          <button className="btn btn-default" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={submit}>上传</button>
        </div>
      </div>
    </div>
  );
}

function NoteDialog({ onClose, onOk }: { onClose: () => void; onOk: (c: string) => void }) {
  const [content, setContent] = useState('');
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>添加审计备注</h3>
        <div className="form-item"><label>备注内容</label><textarea rows={4} value={content} onChange={e => setContent(e.target.value)} /></div>
        <div className="footer">
          <button className="btn btn-default" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={() => { if (!content.trim()) { showToast('内容不能为空', 'error'); return; } onOk(content); }}>保存</button>
        </div>
      </div>
    </div>
  );
}
