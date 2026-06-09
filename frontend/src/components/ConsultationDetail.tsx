import { useState, useEffect } from 'react';
import { api, statusLabels, stageLabels, roleLabels, urgencyLabels, formatDateTime } from '../lib/api';
import type { User, Consultation, ProcessRecord, AbnormalRecord, Attachment, AuditNote, ProcessResult } from '../types';

interface Props {
  id: string;
  user: User;
  onBack: () => void;
  onRefresh: () => void;
}

const actionLabels: Record<string, string> = {
  create: '创建',
  submit: '提交审核',
  correct: '补正提交',
  withdraw: '撤回',
  verify_pass: '核验通过',
  verify_fail: '核验异常',
  mark_abnormal: '标记异常',
  return: '退回补正',
  review_pass: '复核通过',
  review_fail: '复核退回',
  archive: '归档',
};

export default function ConsultationDetail({ id, user, onBack, onRefresh }: Props) {
  const [data, setData] = useState<{
    consultation: Consultation;
    process_records: ProcessRecord[];
    abnormal_records: AbnormalRecord[];
    attachments: Attachment[];
    audit_notes: AuditNote[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [action, setAction] = useState('');
  const [remark, setRemark] = useState('');
  const [evidenceUsed, setEvidenceUsed] = useState('');
  const [abnormalType, setAbnormalType] = useState('');
  const [abnormalReason, setAbnormalReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<ProcessResult | null>(null);

  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const d: any = await api.getConsultation(id);
      setData(d);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div>加载中...</div>;
  if (!data) return <div className="alert error">{error || '加载失败'} <button onClick={onBack}>返回</button></div>;

  const c = data.consultation;
  const evidences = c.evidence_list ? c.evidence_list.split(',').map(s => s.trim()).filter(Boolean) : [];

  const getAvailableActions = () => {
    if (c.is_archived) return [];
    const acts: { key: string; label: string; cls?: string; needEvidence?: boolean; needAbnormalReason?: boolean }[] = [];
    if (user.role === 'registrar' && c.current_stage === 'registration') {
      acts.push({ key: 'submit', label: '提交审核', cls: 'primary', needEvidence: true });
      if (c.status === 'abnormal') {
        acts.push({ key: 'correct', label: '补正提交', cls: 'primary', needEvidence: true, needAbnormalReason: true });
      }
    }
    if (user.role === 'auditor' && c.current_stage === 'verification') {
      acts.push({ key: 'verify_pass', label: '核验通过', cls: 'success', needEvidence: true });
      acts.push({ key: 'verify_fail', label: '核验异常', cls: 'warning', needAbnormalReason: true });
      acts.push({ key: 'return', label: '退回补正', cls: 'danger', needAbnormalReason: true });
    }
    if (user.role === 'reviewer' && c.current_stage === 'review') {
      acts.push({ key: 'review_pass', label: '复核通过', cls: 'success', needEvidence: true });
      acts.push({ key: 'review_fail', label: '复核退回', cls: 'warning', needAbnormalReason: true });
      if (c.status === 'rechecked') {
        acts.push({ key: 'archive', label: '最终归档', cls: 'primary', needEvidence: true });
      }
    }
    return acts;
  };

  const availableActions = getAvailableActions();
  const selectedActionCfg = availableActions.find(a => a.key === action);

  const handleAction = async () => {
    if (!action) return;
    setActionLoading(true);
    setActionResult(null);
    try {
      const result: any = await api.processAction(id, {
        action,
        remark,
        evidence_used: evidenceUsed,
        expected_version: c.version,
        abnormal_type: abnormalType,
        abnormal_reason: abnormalReason,
      });
      setActionResult(result);
      if (result.success) {
        setAction('');
        setRemark('');
        setEvidenceUsed('');
        setAbnormalType('');
        setAbnormalReason('');
        setTimeout(load, 500);
      }
    } catch (err: any) {
      setActionResult({ success: false, message: err.message || '操作失败' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setNoteLoading(true);
    try {
      await api.addNote(id, noteText);
      setNoteText('');
      load();
    } catch (err: any) {
      alert(err.message || '添加备注失败');
    } finally {
      setNoteLoading(false);
    }
  };

  const stageOrder = ['registration', 'verification', 'review'];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={onBack}>← 返回列表</button>
        <button style={{ marginLeft: 8 }} onClick={load}>刷新</button>
      </div>

      {actionResult && (
        <div className={`alert ${actionResult.success ? 'success' : 'error'}`}>
          {actionResult.success ? '✓ ' : '✗ '}{actionResult.message}
          {!actionResult.success && actionResult.id && ` (单据: ${actionResult.id})`}
        </div>
      )}

      <div className="alert info" style={{ marginBottom: 12 }}>
        当前视图按「{roleLabels[user.role]}」角色权限展示，后端已严格校验可见范围。
        {user.role === 'registrar' && ' 仅可查看/办理您本人创建的会诊申请单。'}
        {user.role === 'auditor' && ' 仅可查看/办理核验阶段（分配给您或待认领）的会诊申请单。'}
        {user.role === 'reviewer' && ' 仅可查看/办理复核阶段的会诊申请单。'}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              {c.patient_name} <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: 14 }}>({c.patient_id})</span>
            </span>
            <span style={{ marginLeft: 16 }}>
              <span className={`badge ${c.status}`} style={{ marginRight: 8 }}>{statusLabels[c.status]}</span>
              <span className={`badge ${c.urgency}`} style={{ marginRight: 8 }}>{urgencyLabels[c.urgency]}</span>
              <span className="badge pending">{stageLabels[c.current_stage]}</span>
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            版本 v{c.version} · 创建于 {formatDateTime(c.created_at)}
          </div>
        </div>

        {user.role !== 'registrar' && (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f8f9fa', borderRadius: 6, fontSize: 14 }}>
            <strong>当前处理人：</strong>
            {!c.current_handler ? (
              <span className="badge pending" style={{ marginLeft: 8 }}>未分配（共享池，可认领）</span>
            ) : c.current_handler === user.id ? (
              <span className="badge success" style={{ marginLeft: 8 }}>我处理</span>
            ) : (
              <span className="badge warning" style={{ marginLeft: 8 }}>其他处理人处理中（ID: {c.current_handler}）</span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {stageOrder.map((s, i) => {
            const done = stageOrder.indexOf(c.current_stage) > i || (c.current_stage === s && c.status !== 'pending');
            const current = c.current_stage === s;
            return (
              <div key={s} style={{
                padding: '8px 16px',
                borderRadius: 6,
                background: current ? '#e8f0fe' : (done ? '#e6f4ea' : '#f1f3f4'),
                color: current ? 'var(--primary)' : (done ? 'var(--success)' : 'var(--text-secondary)'),
                fontWeight: current ? 600 : 400,
                border: current ? '1px solid var(--primary)' : 'none',
              }}>
                {i + 1}. {stageLabels[s]} {done && '✓'}
              </div>
            );
          })}
        </div>

        <div className="details-grid">
          <div className="detail-item"><label>年龄/性别</label><div className="value">{c.age}岁 / {c.gender}</div></div>
          <div className="detail-item"><label>申请科室</label><div className="value">{c.department}</div></div>
          <div className="detail-item"><label>主治医师</label><div className="value">{c.attending_physician}</div></div>
          <div className="detail-item"><label>会诊类型</label><div className="value">{c.consultation_type}</div></div>
          <div className="detail-item"><label>拟会诊科室</label><div className="value">{c.consultation_dept}</div></div>
          <div className="detail-item"><label>拟邀请医生</label><div className="value">{c.requested_doctor}</div></div>
          <div className="detail-item"><label>预约时间</label><div className="value">{formatDateTime(c.appointment_time)}</div></div>
          <div className="detail-item"><label>处理截止时间</label><div className="value">{formatDateTime(c.deadline)}</div></div>
          <div className="detail-item"><label>科室排班核验</label><div className="value">{c.schedule_verified ? '✓ 已核验' : '○ 未核验'}</div></div>
          <div className="detail-item"><label>结果反馈核验</label><div className="value">{c.feedback_verified ? '✓ 已核验' : '○ 未核验'}</div></div>
          <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
            <label>会诊申请原因</label>
            <div className="value" style={{ whiteSpace: 'pre-wrap', background: '#f8f9fa', padding: 12, borderRadius: 6 }}>
              {c.consultation_reason}
            </div>
          </div>
          <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
            <label>已登记证据材料</label>
            <div className="value">
              {evidences.length === 0 ? '无' : evidences.map(e => (
                <span key={e} style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  background: '#e8f0fe',
                  color: 'var(--primary)',
                  borderRadius: 4,
                  marginRight: 8,
                  fontSize: 13,
                }}>{e}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {availableActions.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginTop: 0 }}>处理操作（{roleLabels[user.role]}）</div>
          <div style={{ marginBottom: 16 }}>
            <label>选择操作 *</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {availableActions.map(a => (
                <button
                  key={a.key}
                  className={action === a.key ? a.cls || 'primary' : ''}
                  onClick={() => { setAction(a.key); setActionResult(null); }}
                  style={action === a.key ? {} : {}}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {action && (
            <div>
              {selectedActionCfg?.needEvidence && (
                <div className="form-row">
                  <div className="form-item" style={{ gridColumn: '1 / -1' }}>
                    <label>使用证据（从已登记证据中选择，用英文逗号分隔）*</label>
                    <input
                      value={evidenceUsed}
                      onChange={(e) => setEvidenceUsed(e.target.value)}
                      placeholder={`可选项：${c.evidence_list}`}
                    />
                    <small style={{ color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
                      必须从已登记的证据中选择，提交时后端会校验
                    </small>
                  </div>
                </div>
              )}
              {selectedActionCfg?.needAbnormalReason && (
                <div className="form-row">
                  <div className="form-item">
                    <label>异常类型</label>
                    <input
                      value={abnormalType}
                      onChange={(e) => setAbnormalType(e.target.value)}
                      placeholder="如：缺材料、超时、状态冲突"
                    />
                  </div>
                  <div className="form-item" style={{ gridColumn: '1 / -1' }}>
                    <label>异常/退回原因 *</label>
                    <textarea
                      value={abnormalReason}
                      onChange={(e) => setAbnormalReason(e.target.value)}
                      placeholder="请详细说明异常原因或退回补正要求"
                    />
                  </div>
                </div>
              )}
              <div className="form-row">
                <div className="form-item" style={{ gridColumn: '1 / -1' }}>
                  <label>处理备注</label>
                  <textarea value={remark} onChange={(e) => setRemark(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="primary" onClick={handleAction} disabled={actionLoading}>
                  {actionLoading ? '处理中...' : '确认提交（将基于版本 v' + c.version + '）'}
                </button>
                <button onClick={() => { setAction(''); setActionResult(null); }}>取消</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="section-title">处理记录（按时间顺序）</div>
      <div className="card" style={{ marginBottom: 16 }}>
        {data.process_records.length === 0 && <div style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>暂无处理记录</div>}
        <div className="timeline">
          {data.process_records.map((r, idx) => (
            <div key={r.id} className="timeline-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong>{idx + 1}. {actionLabels[r.action] || r.action}</strong>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                    {stageLabels[r.stage]} · {r.handler_name}（{roleLabels[r.handler_role]}）
                  </span>
                  {r.from_status && (
                    <span style={{ marginLeft: 8 }}>
                      <span className={`badge ${r.from_status}`}>{statusLabels[r.from_status]}</span>
                      {' → '}
                      <span className={`badge ${r.to_status}`}>{statusLabels[r.to_status]}</span>
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {formatDateTime(r.created_at)} · v{r.version}
                </div>
              </div>
              {r.remark && (
                <div style={{ marginTop: 4, fontSize: 14, background: '#f8f9fa', padding: 8, borderRadius: 4 }}>
                  备注：{r.remark}
                </div>
              )}
              {r.evidence_used && (
                <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                  使用证据：{r.evidence_used}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {data.abnormal_records.length > 0 && (
        <>
          <div className="section-title">异常记录</div>
          <div className="card" style={{ marginBottom: 16 }}>
            {data.abnormal_records.map(a => (
              <div key={a.id} className="alert warning" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <strong>[{a.abnormal_type}]</strong>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {a.is_resolved ? '✓ 已解决' : '○ 未解决'} · {formatDateTime(a.created_at)}
                  </span>
                </div>
                <div style={{ marginTop: 4 }}>{a.reason}</div>
                {a.is_resolved && a.resolution && (
                  <div style={{ marginTop: 4, fontSize: 13, color: 'var(--success)' }}>
                    解决：{a.resolution}（{formatDateTime(a.resolved_at)}）
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">审计备注</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            placeholder="添加审计备注..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="primary" onClick={handleAddNote} disabled={noteLoading || !noteText.trim()}>
            {noteLoading ? '添加中...' : '添加'}
          </button>
        </div>
        {data.audit_notes.length === 0 && <div style={{ color: 'var(--text-secondary)' }}>暂无备注</div>}
        {data.audit_notes.map(n => (
          <div key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              {n.created_by} · {formatDateTime(n.created_at)}
            </div>
            <div style={{ marginTop: 4 }}>{n.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
