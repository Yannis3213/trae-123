'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { useRefresh } from '../../../lib/useRefresh';
import type {
  OrderDetailResult, Attachment, ProcessingRecord, AuditNote, ExceptionReason,
} from '../../../lib/types';
import { fmtAmount, fmtDate, fmtTime, relativeDeadline, statusBadge, urgencyBadge } from '../../../lib/format';

const EVIDENCE_LABEL: Record<string, string> = {
  id_card: '身份证凭证', registration_form: '入住登记单',
  deposit_slip: '押金收据', review_note: '核验/回访记录', other: '其他材料',
};

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const id = params.id;
  const [data, setData] = useState<OrderDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'ok' | 'err' | 'info' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    evidence_types: [] as string[], remark: '', note_content: '',
    exception_label: '', exception_desc: '', exception_severity: 'medium',
  });
  const [addAttachmentForm, setAddAttachmentForm] = useState<{ open: boolean; file_name: string; evidence_type: string; remark: string }>({
    open: false, file_name: '', evidence_type: 'id_card', remark: '',
  });
  const [addNoteForm, setAddNoteForm] = useState<{ open: boolean; note_type: string; content: string }>({
    open: false, note_type: 'normal', content: '',
  });
  const [batchResult, setBatchResult] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    setActionDialog(null);
    setForm({
      evidence_types: [] as string[], remark: '', note_content: '',
      exception_label: '', exception_desc: '', exception_severity: 'medium',
    });
    const r = await api.getOrderDetail(id);
    setLoading(false);
    if (!r.ok) {
      setMessage({ type: 'err', text: `加载详情失败：${r.message}（code=${r.code}）` });
      return;
    }
    setData(r.data!);
    if (r.data!.exceptions.some(e => !e.resolved && e.severity === 'high')) {
      setMessage({ type: 'warn', text: '该住客订单存在高优先级未解决异常，请优先处理' });
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ====== 统一事件监听：角色切换 / 订单变更 ======
  useRefresh({
    onAny: load,
  });

  if (loading) return <div className="empty">加载住客订单详情中…</div>;
  if (!data) return <div className="empty">未找到订单</div>;

  const { order, attachments, processing_records, audit_notes, exceptions, subordinate_records, permission } = data;

  const submitAction = async (action: string) => {
    if (!order) return;
    setBusy(true);
    const payload: any = {
      version: order.version,
      evidence_types: form.evidence_types,
      remark: form.remark,
      note_content: form.note_content,
      // ====== 关键修复：把页面上展示的状态带给后端（用于角色边界校验，避免静默覆盖
      page_status: order.status,
    };
    if (action === 'return') {
      payload.exception_label = form.exception_label || '退回补正';
      payload.exception_desc = form.exception_desc || form.remark;
      payload.exception_severity = form.exception_severity;
    }
    if (action === 'transfer' && order.current_role === 'supervisor') {
      payload.target_handler_role = 'reviewer';
      payload.target_handler_id = 'u_reviewer';
    }
    const res = await api.orderAction(id, action as any, payload);
    setBusy(false);
    if (!res.ok) {
      setMessage({ type: 'err', text: `操作被拦截：${res.message}（code=${res.code}）` });
      return;
    }
    setMessage({ type: 'ok', text: res.data!.message });
    setActionDialog(null);
    setForm({ evidence_types: [], remark: '', note_content: '', exception_label: '', exception_desc: '', exception_severity: 'medium' });
    setBatchResult(null);
    await load();
    setTimeout(() => router.push('/'), 1200);
  };

  const uploadAttachment = async () => {
    if (!addAttachmentForm.file_name) return;
    setBusy(true);
    const r = await api.addAttachment(id, {
      file_name: addAttachmentForm.file_name,
      file_type: 'application/octet-stream',
      evidence_type: addAttachmentForm.evidence_type,
      version: order!.version,
      remark: addAttachmentForm.remark,
    });
    setBusy(false);
    if (!r.ok) {
      setMessage({ type: 'err', text: `上传失败：${r.message}` });
      return;
    }
    setMessage({ type: 'ok', text: '证据已上传并记录到审计轨迹' });
    setAddAttachmentForm({ open: false, file_name: '', evidence_type: 'id_card', remark: '' });
    await load();
  };

  const addNote = async () => {
    if (!addNoteForm.content) return;
    setBusy(true);
    const r = await api.addNote(id, { note_type: addNoteForm.note_type, content: addNoteForm.content });
    setBusy(false);
    if (!r.ok) {
      setMessage({ type: 'err', text: `备注失败：${r.message}` });
      return;
    }
    setAddNoteForm({ open: false, note_type: 'normal', content: '' });
    await load();
  };

  const resolveEx = async (eid: string) => {
    const r = await api.resolveException(id, eid);
    if (!r.ok) { setMessage({ type: 'err', text: r.message || '解决异常失败' }); return; }
    await load();
  };

  const actions: { key: string; label: string; cls: string; permission: boolean; targetLabel: string }[] = [
    { key: 'transfer', label: order.current_role === 'registrar' ? '转办至住客审核主管' : '转办至酒店集团复核负责人',
      cls: 'btn-primary', permission: permission.can_transfer, targetLabel: '已转办' },
    { key: 'return', label: '退回住客登记员补正', cls: 'btn-warning', permission: permission.can_return, targetLabel: '已转办→登记员补正' },
    { key: 'correct', label: '补正材料后重新提交', cls: 'btn-primary', permission: permission.can_correct, targetLabel: '已转办' },
    { key: 'review', label: '集团复核通过（已回访）', cls: 'btn-success', permission: permission.can_review, targetLabel: '已回访' },
    { key: 'archive', label: '复核归档完成', cls: 'btn-success', permission: permission.can_archive, targetLabel: '已归档' },
  ];
  const visibleActions = actions.filter(a => a.permission);

  const requiredEvidence = (() => {
    switch (order.current_role) {
      case 'registrar': return ['id_card', 'registration_form'];
      case 'supervisor': return ['deposit_slip', 'review_note'];
      default: return [];
    }
  })();

  return (
    <div>
      <div className="breadcrumb">
        <Link href="/">住客订单列表</Link> / <span>{order.order_no} · {order.guest_name}</span>
        <span style={{ marginLeft: 10 }}>
          {statusBadge(order.status, order.status_label)}
          <span style={{ margin: '0 6px' }} />
          {urgencyBadge(order.deadline_urgency?.level || 'none', order.deadline_urgency?.label || '无')}
        </span>
      </div>

      {message && (
        <div className={`banner banner-${message.type === 'ok' ? 'ok' : message.type === 'err' ? 'err' : message.type === 'warn' ? 'warn' : 'info'}`}>
          {message.text}
        </div>
      )}

      <div className="action-bar">
        <span style={{ fontWeight: 600, marginRight: 8 }}>📌 可执行操作：</span>
        {visibleActions.length === 0 ? (
          <span className="action-bar-empty">您当前角色 / 处理人身份下，该订单无可操作动作。切换角色或查看审计轨迹确认当前环节。</span>
        ) : (
          visibleActions.map(a => (
            <button key={a.key} className={`btn ${a.cls}`} onClick={() => setActionDialog(a.key)}>
              {a.label} <span style={{ opacity: 0.7, fontSize: 11 }}>→ {a.targetLabel}</span>
            </button>
          ))
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setAddAttachmentForm(f => ({ ...f, open: true }))}>➕ 上传证据</button>
          <button className="btn" onClick={() => setAddNoteForm(f => ({ ...f, open: true }))}>📝 追加审计备注</button>
          <button className="btn" onClick={load}>🔄 刷新详情（同步后端）</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">住客订单基本信息 · v{order.version}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            创建：{fmtTime(order.created_at)} · 最近更新：{fmtTime(order.updated_at)}
            {order.archived_at && <span style={{ color: '#059669', marginLeft: 10 }}>✅ 归档时间：{fmtTime(order.archived_at)}</span>}
          </div>
        </div>
        <div className="card-body">
          <div className="detail-grid">
            <div className="detail-item"><div className="detail-label">订单号</div><div className="detail-value">{order.order_no}</div></div>
            <div className="detail-item"><div className="detail-label">住客姓名</div><div className="detail-value">{order.guest_name}</div></div>
            <div className="detail-item"><div className="detail-label">房号</div><div className="detail-value">{order.room_no || '—'}</div></div>
            <div className="detail-item"><div className="detail-label">订单类型</div><div className="detail-value">{order.order_type === 'vip' ? 'VIP 订单' : '普通订单'}</div></div>
            <div className="detail-item"><div className="detail-label">入住日期</div><div className="detail-value">{fmtDate(order.check_in_date)}</div></div>
            <div className="detail-item"><div className="detail-label">退房日期</div><div className="detail-value">{fmtDate(order.check_out_date)}</div></div>
            <div className="detail-item"><div className="detail-label">订单金额</div><div className="detail-value amount">{fmtAmount(order.amount)}</div></div>
            <div className="detail-item"><div className="detail-label">当前环节</div><div className="detail-value">{order.current_role_label || '—'}</div></div>
            <div className="detail-item"><div className="detail-label">当前处理人</div><div className="detail-value">{order.handler_name || order.current_handler || '—'}</div></div>
            <div className="detail-item"><div className="detail-label">处理期限</div>
              <div className="detail-value">
                {fmtTime(order.deadline)}
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{relativeDeadline(order.deadline_urgency)}</div>
              </div>
            </div>
            <div className="detail-item"><div className="detail-label">发起人</div><div className="detail-value">{order.created_by_name || order.created_by}</div></div>
            <div className="detail-item"><div className="detail-label">版本号</div><div className="detail-value">v{order.version}</div></div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="detail-label">证据 / 附件（共 {attachments.length} 项）</div>
            <div style={{ marginTop: 6 }}>
              {requiredEvidence.map(et => {
                const have = order.evidence_types.includes(et);
                return (
                  <span key={et} className={`evidence-pill ${have ? '' : 'missing'}`}>
                    {have ? '✅' : '⚠️ 缺'} {EVIDENCE_LABEL[et] || et}
                  </span>
                );
              })}
            </div>
            <div style={{ marginTop: 10 }}>
              {attachments.length === 0 && <div style={{ color: '#9ca3af', fontSize: 12 }}>暂无附件</div>}
              {attachments.map(a => (
                <div key={a.id} style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <span className={`evidence-pill`}>{a.evidence_type_label}</span>
                    <strong style={{ marginLeft: 6 }}>{a.file_name}</strong>
                    <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 8 }}>{a.file_type}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {a.uploaded_by_name} · {fmtTime(a.uploaded_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="sections-grid">
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">📜 住客订单处理记录（审计轨迹 · 时间线）</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>共 {processing_records.length} 条 · 状态与证据每次变更均在此留存</div>
            </div>
            <div className="card-body">
              <div className="timeline">
                {processing_records.map((r, idx) => (
                  <div key={r.id} className="timeline-item">
                    <div className="timeline-title">
                      {idx + 1}. {r.action_label}
                      {(r.from_status || r.to_status) && (
                        <span style={{ fontWeight: 400, fontSize: 12, color: '#6b7280', marginLeft: 6 }}>
                          {r.from_status && <>{statusBadge(r.from_status as any,
                            ({ pending: '待分派', transferred: '已转办', reviewed: '已回访', archived: '已归档' } as any)[r.from_status] || r.from_status)} →</>}
                          {' '}
                          {r.to_status && statusBadge(r.to_status as any,
                            ({ pending: '待分派', transferred: '已转办', reviewed: '已回访', archived: '已归档' } as any)[r.to_status] || r.to_status)}
                        </span>
                      )}
                    </div>
                    <div className="timeline-meta">
                      操作人：{r.operator_name} · [{({ registrar: '住客登记员', supervisor: '住客审核主管', reviewer: '酒店集团复核负责人' } as any)[r.operator_role] || r.operator_role}]
                      · {fmtTime(r.created_at)}
                      {r.version_before !== r.version_after && <span style={{ marginLeft: 8 }}>版本 v{r.version_before} → v{r.version_after}</span>}
                    </div>
                    {(r.handler_before || r.handler_after) && (
                      <div className="timeline-meta">处理人变更：{r.handler_before || '(空)'} → {r.handler_after || '(空)'}</div>
                    )}
                    {(r.evidence_required || r.evidence_provided) && (
                      <div className="timeline-meta">
                        证据：要求 [{r.evidence_required || '—'}]，已提交 [{r.evidence_provided || '—'}]
                      </div>
                    )}
                    {r.remark && <div className="timeline-body">📝 {r.remark}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {permission.can_view_subordinates && subordinate_records.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div className="card-title">🏨 前厅接待 / 客房主管核查记录（值班经理复核前可见）</div>
              </div>
              <div className="card-body">
                <div className="timeline">
                  {subordinate_records.map(r => (
                    <div key={r.id} className="timeline-item">
                      <div className="timeline-title">{r.action_label}</div>
                      <div className="timeline-meta">{r.operator_name} · {fmtTime(r.created_at)}</div>
                      {r.remark && <div className="timeline-body">{r.remark}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <div className="card-title">🗂️ 审计备注</div>
            </div>
            <div className="card-body">
              {audit_notes.length === 0 && <div style={{ color: '#9ca3af', fontSize: 12 }}>暂无备注</div>}
              {audit_notes.map(n => (
                <div key={n.id} className={`note-item note-${n.note_type}`}>
                  <div className="note-meta">
                    {({ normal: '普通', correction: '补正', exception: '异常' } as any)[n.note_type]} · {n.created_by_name} · {fmtTime(n.created_at)}
                  </div>
                  <div className="note-content">{n.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">⚠️ 异常原因登记</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>未解决：{exceptions.filter(e => !e.resolved).length} / 合计：{exceptions.length}</div>
            </div>
            <div className="card-body">
              {exceptions.length === 0 && <div style={{ color: '#9ca3af', fontSize: 12 }}>暂无异常</div>}
              {exceptions.map(e => (
                <div key={e.id} className={`exception-item ${e.severity} ${e.resolved ? 'resolved' : ''}`}>
                  <div className="exception-title">
                    {e.resolved ? '✅ ' : '🚩 '}[{({ low: '低', medium: '中', high: '高' } as any)[e.severity]}] {e.reason_label}
                  </div>
                  <div className="exception-desc">{e.description}</div>
                  <div className="exception-meta">
                    <span>{e.reported_by_name} · {fmtTime(e.created_at)}</span>
                    <span>
                      {e.resolved ? `已解决：${e.resolved_by_name || ''} ${fmtTime(e.resolved_at)}` : (
                        <button className="btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => resolveEx(e.id)}>标记已解决</button>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">🧭 状态流转说明</div></div>
            <div className="card-body" style={{ fontSize: 12, lineHeight: 1.8 }}>
              <div>页面只出现 <strong>待分派 / 已转办 / 已回访</strong> 三段状态：</div>
              <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
                <li><strong>待分派</strong>：登记员刚登记，证据齐全转 <em>已转办</em></li>
                <li><strong>已转办</strong>：审核主管办理，通过 → 集团复核；不通过 → 退回补正（仍处于已转办，处理人切换为登记员）</li>
                <li><strong>已回访</strong>：集团复核通过，等待归档</li>
                <li><em>归档后进入已归档（后台状态，页面标签不展示）</em></li>
              </ul>
              <div>当前订单：<strong>{order.status_label}</strong>，版本 v{order.version}</div>
              <div style={{ marginTop: 8, color: '#6b7280' }}>
                后端拦截：越权、重复提交、状态冲突、旧版本、缺证据均会返回明确错误，不会静默覆盖。
              </div>
            </div>
          </div>
        </div>
      </div>

      {actionDialog && (
        <ActionDialog
          action={actionDialog}
          order={order}
          form={form}
          setForm={setForm}
          requiredEvidence={requiredEvidence}
          onCancel={() => setActionDialog(null)}
          onConfirm={() => submitAction(actionDialog)}
          busy={busy}
        />
      )}

      {addAttachmentForm.open && (
        <div className="modal-mask" onClick={() => setAddAttachmentForm(f => ({ ...f, open: false }))}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">上传证据 / 附件</div>
              <button className="btn" onClick={() => setAddAttachmentForm(f => ({ ...f, open: false }))}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="form-label">证据类型</label>
                <select className="select" value={addAttachmentForm.evidence_type}
                  onChange={e => setAddAttachmentForm(f => ({ ...f, evidence_type: e.target.value }))}>
                  {Object.entries(EVIDENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">文件名（演示环境直接填写模拟文件名）</label>
                <input className="input" placeholder="如：身份证正面_张三.jpg"
                  value={addAttachmentForm.file_name}
                  onChange={e => setAddAttachmentForm(f => ({ ...f, file_name: e.target.value }))} />
              </div>
              <div className="form-row">
                <label className="form-label">备注（选填）</label>
                <textarea className="textarea"
                  value={addAttachmentForm.remark}
                  onChange={e => setAddAttachmentForm(f => ({ ...f, remark: e.target.value }))} />
              </div>
              <div className="banner banner-warn">提示：提交时将校验您是当前订单处理人，且版本号 v{order.version} 与后端一致，否则会被拦截。</div>
            </div>
            <div className="modal-footer">
              <button className="btn" disabled={busy} onClick={() => setAddAttachmentForm(f => ({ ...f, open: false }))}>取消</button>
              <button className="btn btn-primary" disabled={busy || !addAttachmentForm.file_name} onClick={uploadAttachment}>
                {busy ? '提交中…' : '确认上传'}
              </button>
            </div>
          </div>
        </div>
      )}

      {addNoteForm.open && (
        <div className="modal-mask" onClick={() => setAddNoteForm(f => ({ ...f, open: false }))}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">追加审计备注</div>
              <button className="btn" onClick={() => setAddNoteForm(f => ({ ...f, open: false }))}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="form-label">备注类型</label>
                <select className="select" value={addNoteForm.note_type}
                  onChange={e => setAddNoteForm(f => ({ ...f, note_type: e.target.value }))}>
                  <option value="normal">普通备注</option>
                  <option value="correction">补正说明</option>
                  <option value="exception">异常说明</option>
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">内容</label>
                <textarea className="textarea" placeholder="请输入备注内容，会进入审计轨迹永久留存"
                  value={addNoteForm.content}
                  onChange={e => setAddNoteForm(f => ({ ...f, content: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setAddNoteForm(f => ({ ...f, open: false }))}>取消</button>
              <button className="btn btn-primary" disabled={!addNoteForm.content} onClick={addNote}>确认提交</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionDialog({
  action, order, form, setForm, requiredEvidence, onCancel, onConfirm, busy,
}: {
  action: string; order: any; form: any; setForm: (f: any) => void;
  requiredEvidence: string[]; onCancel: () => void; onConfirm: () => void; busy: boolean;
}) {
  const labelMap: Record<string, { title: string; hint: string }> = {
    transfer: {
      title: order.current_role === 'registrar' ? '转办至住客审核主管' : '转办至酒店集团复核负责人',
      hint: order.current_role === 'registrar'
        ? '转办后状态变更为【已转办】，处理人切换为住客审核主管，同时要求登记阶段证据齐全。'
        : '转办后状态仍为【已转办】，处理人切换为酒店集团复核负责人，要求主管阶段证据齐全。',
    },
    return: {
      title: '退回住客登记员补正',
      hint: '退回后状态仍为【已转办】，但处理人切换为登记员，记录异常原因并进入补正流程。',
    },
    correct: {
      title: '补正材料后重新提交',
      hint: '补正后状态回到【已转办】，处理人切换为住客审核主管，登记阶段证据须齐全。',
    },
    review: {
      title: '集团复核通过（已回访）',
      hint: '复核后状态变更为【已回访】，等待归档。',
    },
    archive: {
      title: '复核归档完成',
      hint: '归档后状态进入已归档，订单不再出现在可处理队列，请确认所有材料齐全后再提交。',
    },
  };
  const info = labelMap[action] || { title: action, hint: '' };

  const toggleEvidence = (et: string) => {
    setForm({
      ...form,
      evidence_types: form.evidence_types.includes(et)
        ? form.evidence_types.filter((x: string) => x !== et)
        : [...form.evidence_types, et],
    });
  };

  return (
    <div className="modal-mask" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{info.title}</div>
          <button className="btn" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body">
          <div className="banner banner-info">{info.hint}</div>
          <div className="banner banner-warn">
            提交将校验：<strong>角色 · 当前处理人 · 状态 · 版本 v{order.version} · 证据</strong>，任一不匹配将被拦截并返回明确错误，不会静默写入。
          </div>

          {(action === 'transfer' || action === 'correct') && requiredEvidence.length > 0 && (
            <div className="form-row" style={{ marginTop: 10 }}>
              <label className="form-label">本阶段必填证据（请勾选已备齐的）：</label>
              <div className="checkbox-group">
                {requiredEvidence.map(et => (
                  <label key={et}>
                    <input type="checkbox"
                      checked={form.evidence_types.includes(et)}
                      onChange={() => toggleEvidence(et)} />
                    {EVIDENCE_LABEL[et] || et}
                    {order.evidence_types.includes(et) && <span style={{ color: '#059669', fontSize: 11 }}>（系统已有）</span>}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                后端会以订单实际附件表为准再次校验，仅勾选无法绕过缺证据拦截。
              </div>
            </div>
          )}

          {action === 'return' && (
            <>
              <div className="form-row">
                <label className="form-label">补正/异常标题</label>
                <input className="input" placeholder="如：入住登记单客人签名缺失"
                  value={form.exception_label}
                  onChange={e => setForm({ ...form, exception_label: e.target.value })} />
              </div>
              <div className="form-row">
                <label className="form-label">严重程度</label>
                <select className="select" value={form.exception_severity}
                  onChange={e => setForm({ ...form, exception_severity: e.target.value })}>
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">详细补正要求（异常原因）</label>
                <textarea className="textarea" placeholder="请说明需要补正的内容，登记员端将看到此信息"
                  value={form.exception_desc}
                  onChange={e => setForm({ ...form, exception_desc: e.target.value })} />
              </div>
            </>
          )}

          <div className="form-row">
            <label className="form-label">处理备注（进入审计轨迹 · 选填）</label>
            <textarea className="textarea" placeholder="可记录办理过程中的关键信息"
              value={form.remark}
              onChange={e => setForm({ ...form, remark: e.target.value })} />
          </div>
          <div className="form-row">
            <label className="form-label">追加审计备注（选填）</label>
            <textarea className="textarea" placeholder="需要永久留存的文字备注"
              value={form.note_content}
              onChange={e => setForm({ ...form, note_content: e.target.value })} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" disabled={busy} onClick={onCancel}>取消</button>
          <button className={`btn ${action === 'archive' || action === 'review' ? 'btn-success' : action === 'return' ? 'btn-warning' : 'btn-primary'}`}
            disabled={busy}
            onClick={onConfirm}>
            {busy ? '提交中…' : `确认提交（当前版本 v${order.version}）`}
          </button>
        </div>
      </div>
    </div>
  );
}
