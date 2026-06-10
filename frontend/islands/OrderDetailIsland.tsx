import { useState, useEffect } from "preact/hooks";
import { useSignal, useSignalEffect } from "@preact/signals";
import { currentUser, isLoggedIn } from "../utils/store.ts";
import { apiFetch, type ApiError } from "../utils/api.ts";
import {
  STATUS_LABELS, STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
  WARNING_LABELS, WARNING_COLORS,
  ROLE_LABELS, AUDIT_NOTE_TYPES, AUDIT_NOTE_TYPE_COLORS,
  EXCEPTION_TYPE_LABELS, EXCEPTION_TYPE_COLORS,
  type FreshPurchaseOrder,
  type PurchaseStatus,
  type PriorityLevel,
  type BatchActionResult,
  type ProcessingRecord,
  type AuditNote,
  type AuditNoteType,
  type StatusTransitionRequest,
  type AuditNoteCreate,
} from "../utils/types.ts";

interface Props {
  orderId: number;
}

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleString("zh-CN", { hour12: false });
  } catch {
    return s;
  }
}

export default function OrderDetailIsland({ orderId }: Props) {
  const [order, setOrder] = useState<FreshPurchaseOrder | null>(null);
  const [records, setRecords] = useState<ProcessingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{
    type: "success" | "error";
    text: string;
    errorBody?: {
      order_no?: string;
      current_status?: string;
      exception_type?: string;
      exception_label?: string;
    } | null;
  } | null>(null);
  const [showTransition, setShowTransition] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);

  const targetStatus = useSignal<PurchaseStatus>("processing");
  const transitionAction = useSignal("派发处理");
  const transitionComment = useSignal("");
  const transitionAuditNote = useSignal("");
  const newAuditNote = useSignal("");
  const auditNoteType = useSignal("人工备注");
  const processing = useSignal(false);

  const editing = useSignal(false);
  const form_title = useSignal("");
  const form_supplier = useSignal("");
  const form_store = useSignal("");
  const form_category = useSignal("");
  const form_amount = useSignal("");
  const form_priority = useSignal<PriorityLevel>("medium");
  const form_deadline = useSignal("");
  const form_quotation = useSignal("");
  const form_purchase = useSignal("");
  const form_arrival = useSignal("");
  const form_has_quotation_ev = useSignal(false);
  const form_has_purchase_ev = useSignal(false);
  const form_has_arrival_ev = useSignal(false);

  async function loadDetail() {
    setLoading(true);
    try {
      const o = await apiFetch<FreshPurchaseOrder>(`/orders/${orderId}`);
      setOrder(o);
      setRecords(o.processing_records);
      if (o) {
        form_title.value = o.title;
        form_supplier.value = o.supplier_name;
        form_store.value = o.store;
        form_category.value = o.category || "";
        form_amount.value = o.amount || "";
        form_priority.value = o.priority;
        try {
          const d = new Date(o.deadline);
          const pad = (n: number) => String(n).padStart(2, "0");
          form_deadline.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch {}
        form_quotation.value = o.supplier_quotation || "";
        form_purchase.value = o.purchase_order_content || "";
        form_arrival.value = o.arrival_verification || "";
        form_has_quotation_ev.value = o.has_quotation_evidence;
        form_has_purchase_ev.value = o.has_purchase_evidence;
        form_has_arrival_ev.value = o.has_arrival_evidence;
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn.value) {
      loadDetail();
    }
  }, [isLoggedIn.value, orderId]);

  if (!isLoggedIn.value || !currentUser.value) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return <div class="loading-state">跳转中...</div>;
  }

  if (loading || !order) {
    return <div class="loading-state">加载中...</div>;
  }

  const user = currentUser.value;
  const canEdit = (
    order.status !== "closed" &&
    (
      user.role === "reviewer" ||
      (user.role === "registrar" && order.status === "pending_dispatch" &&
        (order.creator_id === user.id || order.current_handler_id === user.id)) ||
      (user.role === "supervisor" && order.status === "processing" &&
        (order.current_handler_id === user.id || order.store === user.store))
    )
  );

  async function handleSaveEdit() {
    processing.value = true;
    try {
      const payload: any = {
        title: form_title.value,
        supplier_name: form_supplier.value,
        store: form_store.value,
        category: form_category.value || undefined,
        amount: form_amount.value || undefined,
        priority: form_priority.value,
        deadline: new Date(form_deadline.value).toISOString(),
        supplier_quotation: form_quotation.value || undefined,
        purchase_order_content: form_purchase.value || undefined,
        arrival_verification: form_arrival.value || undefined,
        has_quotation_evidence: form_has_quotation_ev.value,
        has_purchase_evidence: form_has_purchase_ev.value,
        has_arrival_evidence: form_has_arrival_ev.value,
      };
      await apiFetch(`/orders/${order.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setMsg({ type: "success", text: "保存成功" });
      editing.value = false;
      loadDetail();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      processing.value = false;
    }
  }

  function determineDefaultAction(from: string, to: string) {
    if (from === "pending_dispatch" && to === "processing") return "派发处理";
    if (from === "processing" && to === "pending_dispatch") return "退回补正";
    if (from === "processing" && to === "closed") return "复核归档";
    return "状态变更";
  }

  async function handleTransition() {
    processing.value = true;
    setMsg(null);
    try {
      const req: StatusTransitionRequest = {
        target_status: targetStatus.value as PurchaseStatus,
        comment: transitionComment.value || undefined,
        audit_note: transitionAuditNote.value || undefined,
        expected_version: order!.version,
        action: transitionAction.value,
      };
      const result = await apiFetch<FreshPurchaseOrder>(`/orders/${order!.id}/transition`, {
        method: "POST",
        body: JSON.stringify(req),
      });
      setMsg({ type: "success", text: "状态变更成功" });
      setShowTransition(false);
      setOrder(result);
    } catch (err: any) {
      const apiErr = err as ApiError;
      setMsg({
        type: "error",
        text: err.message,
        errorBody: apiErr.errorBody ? {
          order_no: apiErr.errorBody.order_no,
          current_status: apiErr.errorBody.current_status,
          exception_type: apiErr.errorBody.exception_type,
          exception_label: apiErr.errorBody.exception_label,
        } : null,
      });
    } finally {
      processing.value = false;
    }
  }

  async function handleAddAuditNote() {
    if (!newAuditNote.value.trim()) return;
    processing.value = true;
    try {
      const req: AuditNoteCreate = {
        note: newAuditNote.value,
        note_type: auditNoteType.value,
      };
      await apiFetch<AuditNote>(`/orders/${order!.id}/audit-notes`, {
        method: "POST",
        body: JSON.stringify(req),
      });
      newAuditNote.value = "";
      setShowAuditModal(false);
      setMsg({ type: "success", text: "备注添加成功" });
      loadDetail();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      processing.value = false;
    }
  }

  const allowedTransitions: PurchaseStatus[] = [];
  if (user.role === "registrar" && order.status === "pending_dispatch") {
    allowedTransitions.push("processing");
  }
  if (user.role === "supervisor") {
    if (order.status === "processing") {
      allowedTransitions.push("closed", "pending_dispatch");
    }
  }
  if (user.role === "reviewer") {
    if (order.status === "processing") allowedTransitions.push("closed");
    if (order.status === "pending_dispatch") allowedTransitions.push("processing");
  }

  return (
    <div class="page-container">
      <div class="page-header">
        <div>
          <a href="/" class="btn-ghost" style="margin-right:8px">← 返回列表</a>
          <h2 class="page-title" style="display:inline-block;margin-left:8px">
            📝 生鲜采购单详情
          </h2>
          <p class="page-desc" style="margin-top:8px">
            <span class="tag" style={`background:${STATUS_COLORS[order.status]}20;color:${STATUS_COLORS[order.status]};margin-right:8px`}>
              {STATUS_LABELS[order.status]}
            </span>
            <b style="font-size:16px;margin-right:12px">{order.order_no}</b>
            <span class="muted">版本 v{order.version}</span>
          </p>
        </div>
        <div class="header-actions">
          <button class="btn-secondary" onClick={loadDetail}>🔄 刷新</button>
          {canEdit && !editing.value && (
            <button class="btn-secondary" onClick={() => (editing.value = true)}>✏️ 编辑补正</button>
          )}
          {allowedTransitions.length > 0 && order.status !== "closed" && (
            <button class="btn-primary" onClick={() => setShowTransition(true)}>
              🔄 状态流转
            </button>
          )}
          <button class="btn-secondary" onClick={() => setShowAuditModal(true)}>📝 添加备注</button>
        </div>
      </div>

      {msg && (
        <div class={`alert alert-${msg.type}`} style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              {msg.errorBody?.exception_type && (
                <span
                  class="tag"
                  style={`background:${EXCEPTION_TYPE_COLORS[msg.errorBody.exception_type] || "#be123c"}20;color:${EXCEPTION_TYPE_COLORS[msg.errorBody.exception_type] || "#be123c"};font-weight:600`}
                >
                  🔴 {msg.errorBody.exception_label || EXCEPTION_TYPE_LABELS[msg.errorBody.exception_type] || msg.errorBody.exception_type}
                </span>
              )}
              {msg.errorBody?.order_no && (
                <span class="muted" style="font-size:12px">单号：{msg.errorBody.order_no}</span>
              )}
              {msg.errorBody?.current_status && (
                <span class="tag" style="font-size:12px">
                  当前状态：{STATUS_LABELS[msg.errorBody.current_status as PurchaseStatus] || msg.errorBody.current_status}
                </span>
              )}
            </div>
            <span class="close" onClick={() => setMsg(null)}>×</span>
          </div>
          <div>{msg.text}</div>
        </div>
      )}

      <div class="detail-grid">
        <div class="detail-main">
          {!editing.value ? (
            <div class="detail-section">
              <h3 class="section-title">📋 基本信息</h3>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">标题</span>
                  <span class="info-value">{order.title}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">供应商</span>
                  <span class="info-value">🏭 {order.supplier_name}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">门店</span>
                  <span class="info-value">🏬 {order.store}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">品类</span>
                  <span class="info-value">📦 {order.category || "-"}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">金额</span>
                  <span class="info-value" style="color:#065f46">💰 {order.amount || "-"}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">优先级</span>
                  <span class="tag" style={`background:${PRIORITY_COLORS[order.priority]}20;color:${PRIORITY_COLORS[order.priority]}`}>
                    {PRIORITY_LABELS[order.priority]}
                  </span>
                </div>
                <div class="info-item">
                  <span class="info-label">预警状态</span>
                  <span class="tag" style={`background:${WARNING_COLORS[order.warning_level]}20;color:${WARNING_COLORS[order.warning_level]}`}>
                    {WARNING_LABELS[order.warning_level]}
                  </span>
                  {order.is_overdue && <span class="muted" style="margin-left:8px;color:#ef4444">⚠️ 已逾期</span>}
                </div>
                <div class="info-item">
                  <span class="info-label">截止时间</span>
                  <span class="info-value">{formatDate(order.deadline)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">创建人</span>
                  <span class="info-value">{order.creator?.full_name || "-"} ({order.creator?.role ? ROLE_LABELS[order.creator.role] : ""})</span>
                </div>
                <div class="info-item">
                  <span class="info-label">当前处理人</span>
                  <span class="info-value">{order.current_handler?.full_name || "-"} ({order.current_handler?.role ? ROLE_LABELS[order.current_handler.role] : ""})</span>
                </div>
                <div class="info-item">
                  <span class="info-label">创建时间</span>
                  <span class="info-value">{formatDate(order.created_at)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">更新时间</span>
                  <span class="info-value">{formatDate(order.updated_at)}</span>
                </div>
              </div>

              <h3 class="section-title" style="margin-top:24px">🏭 供应商报价</h3>
              <div class="content-block">
                <div style="margin-bottom:8px">
                  <span class="evidence-tag" style={order.has_quotation_evidence ? "background:#d1fae5;color:#065f46" : "background:#fee2e2;color:#991b1b"}>
                    {order.has_quotation_evidence ? "✓ 材料齐全" : "✗ 材料缺失"}
                  </span>
                </div>
                <pre class="content-text">{order.supplier_quotation || "（暂无内容）"}</pre>
              </div>

              <h3 class="section-title" style="margin-top:24px">📝 采购下单</h3>
              <div class="content-block">
                <div style="margin-bottom:8px">
                  <span class="evidence-tag" style={order.has_purchase_evidence ? "background:#d1fae5;color:#065f46" : "background:#fee2e2;color:#991b1b"}>
                    {order.has_purchase_evidence ? "✓ 材料齐全" : "✗ 材料缺失"}
                  </span>
                </div>
                <pre class="content-text">{order.purchase_order_content || "（暂无内容）"}</pre>
              </div>

              <h3 class="section-title" style="margin-top:24px">✅ 到货验收</h3>
              <div class="content-block">
                <div style="margin-bottom:8px">
                  <span class="evidence-tag" style={order.has_arrival_evidence ? "background:#d1fae5;color:#065f46" : "background:#fee2e2;color:#991b1b"}>
                    {order.has_arrival_evidence ? "✓ 材料齐全" : "✗ 材料缺失"}
                  </span>
                </div>
                <pre class="content-text">{order.arrival_verification || "（暂无内容）"}</pre>
              </div>

              {((order.has_exception || order.reject_reason || order.exception_reason)
                || (order.exception_types && order.exception_types.length > 0)) && (
                <>
                  <h3 class="section-title" style="margin-top:24px;color:#991b1b">⚠️ 异常 / 退回原因</h3>
                  <div class="alert alert-error">
                    {order.exception_types && order.exception_types.length > 0 && (
                      <div style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:6px">
                        {order.exception_types.map((et) => (
                          <span
                            key={et}
                            class="tag"
                            style={`background:${EXCEPTION_TYPE_COLORS[et] || "#be123c"}25;color:${EXCEPTION_TYPE_COLORS[et] || "#be123c"}`}
                          >
                            {EXCEPTION_TYPE_LABELS[et] || et}
                          </span>
                        ))}
                      </div>
                    )}
                    {order.reject_reason && (
                      <div style="margin-bottom:8px">
                        <b>退回原因：</b>{order.reject_reason}
                      </div>
                    )}
                    {order.exception_reason && (
                      <div>
                        <b>异常说明：</b>{order.exception_reason}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div class="detail-section">
              <h3 class="section-title">✏️ 编辑补正</h3>
              <div class="form-grid">
                <div class="form-group">
                  <label>标题 *</label>
                  <input type="text" value={form_title} onInput={(e: any) => (form_title.value = e.target.value)} />
                </div>
                <div class="form-group">
                  <label>供应商 *</label>
                  <input type="text" value={form_supplier} onInput={(e: any) => (form_supplier.value = e.target.value)} />
                </div>
                <div class="form-group">
                  <label>门店 *</label>
                  <input type="text" value={form_store} onInput={(e: any) => (form_store.value = e.target.value)} />
                </div>
                <div class="form-group">
                  <label>品类</label>
                  <input type="text" value={form_category} onInput={(e: any) => (form_category.value = e.target.value)} />
                </div>
                <div class="form-group">
                  <label>金额</label>
                  <input type="text" value={form_amount} onInput={(e: any) => (form_amount.value = e.target.value)} placeholder="如 ¥10,000" />
                </div>
                <div class="form-group">
                  <label>优先级</label>
                  <select value={form_priority} onInput={(e: any) => (form_priority.value = e.target.value)}>
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="urgent">紧急</option>
                  </select>
                </div>
                <div class="form-group" style="grid-column: span 2">
                  <label>截止时间 *</label>
                  <input type="datetime-local" value={form_deadline} onInput={(e: any) => (form_deadline.value = e.target.value)} />
                </div>
                <div class="form-group" style="grid-column: span 2">
                  <label>
                    <input type="checkbox" checked={form_has_quotation_ev} onChange={(e: any) => (form_has_quotation_ev.value = e.target.checked)} />
                     供应商报价材料已齐全
                  </label>
                  <textarea rows="3" value={form_quotation} onInput={(e: any) => (form_quotation.value = e.target.value)} placeholder="供应商报价内容..."></textarea>
                </div>
                <div class="form-group" style="grid-column: span 2">
                  <label>
                    <input type="checkbox" checked={form_has_purchase_ev} onChange={(e: any) => (form_has_purchase_ev.value = e.target.checked)} />
                     采购下单凭证已齐全
                  </label>
                  <textarea rows="3" value={form_purchase} onInput={(e: any) => (form_purchase.value = e.target.value)} placeholder="采购下单详情..."></textarea>
                </div>
                <div class="form-group" style="grid-column: span 2">
                  <label>
                    <input type="checkbox" checked={form_has_arrival_ev} onChange={(e: any) => (form_has_arrival_ev.value = e.target.checked)} />
                     到货验收凭证已齐全
                  </label>
                  <textarea rows="3" value={form_arrival} onInput={(e: any) => (form_arrival.value = e.target.value)} placeholder="到货验收情况..."></textarea>
                </div>
              </div>
              <div style="margin-top:16px;text-align:right">
                <button class="btn-ghost" onClick={() => (editing.value = false)} style="margin-right:8px">取消</button>
                <button class="btn-primary" onClick={handleSaveEdit} disabled={processing.value}>
                  {processing.value ? "保存中..." : "💾 保存"}
                </button>
              </div>
            </div>
          )}

          <div class="detail-section" style="margin-top:24px">
            <h3 class="section-title">📎 附件列表</h3>
            {order.attachments.length === 0 ? (
              <div class="empty-state">暂无附件</div>
            ) : (
              <div class="attachment-list">
                {order.attachments.map(a => (
                  <div class="attachment-item" key={a.id}>
                    <span class="attach-icon">📄</span>
                    <div class="attach-info">
                      <div class="attach-name">{a.filename}</div>
                      <div class="attach-meta muted">
                        {a.category || "未分类"} · {formatDate(a.uploaded_at)}
                        {a.description && ` · ${a.description}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div class="detail-side">
          <div class="detail-section">
            <h3 class="section-title">⏱️ 处理记录 / 审计轨迹</h3>
            <div class="timeline">
              {order.processing_records.length === 0 && <div class="empty-state">暂无处理记录</div>}
              {order.processing_records.map(r => (
                <div class="timeline-item" key={r.id}>
                  <div class={`timeline-dot ${r.result === "success" ? "dot-success" : r.result === "failed" ? "dot-error" : "dot-warn"}`}></div>
                  <div class="timeline-content">
                    <div class="timeline-header">
                      <span class="timeline-action">{r.action}</span>
                      <span class={`timeline-result result-${r.result || "info"}`}>
                        {r.result === "success" ? "✓ 成功" : r.result === "failed" ? "✗ 失败" : r.result === "reject" ? "↩ 退回" : "ℹ 信息"}
                      </span>
                    </div>
                    {(r.from_status || r.to_status) && (
                      <div class="timeline-status muted">
                        {r.from_status && STATUS_LABELS[r.from_status as PurchaseStatus]}
                        {r.from_status && r.to_status && " → "}
                        {r.to_status && STATUS_LABELS[r.to_status as PurchaseStatus]}
                      </div>
                    )}
                    {r.comment && <div class="timeline-comment">💬 {r.comment}</div>}
                    {r.exception_type && (
                      <div style="margin:4px 0">
                        <span class="tag" style={`background:${EXCEPTION_TYPE_COLORS[r.exception_type] || "#be123c"}20;color:${EXCEPTION_TYPE_COLORS[r.exception_type] || "#be123c"}`}>
                          🔴 {EXCEPTION_TYPE_LABELS[r.exception_type] || r.exception_type}
                        </span>
                      </div>
                    )}
                    {r.exception_reason && <div class="timeline-exception">⚠️ {r.exception_reason}</div>}
                    {r.evidence_checked && <div class="timeline-evidence muted">📋 核验材料：{r.evidence_checked}</div>}
                    <div class="timeline-meta muted">
                      {r.handler_name}
                      {r.handler_role && `（${ROLE_LABELS[r.handler_role as any]}）`}
                      {" · "}{formatDate(r.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div class="detail-section" style="margin-top:16px">
            <h3 class="section-title">📝 审计备注</h3>
            {order.audit_notes.length === 0 ? (
              <div class="empty-state">暂无备注</div>
            ) : (
              <div class="audit-list">
                {order.audit_notes.map(n => (
                  <div class="audit-item" key={n.id}>
                    <div class="audit-header">
                      <span class="audit-tag" style={`background:${AUDIT_NOTE_TYPE_COLORS[(n.note_type || "人工备注") as AuditNoteType]}20;color:${AUDIT_NOTE_TYPE_COLORS[(n.note_type || "人工备注") as AuditNoteType]}`}>
                        {n.note_type || "人工备注"}
                      </span>
                      <span class="muted">{n.author_name} · {formatDate(n.created_at)}</span>
                    </div>
                    <div class="audit-content">{n.note}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showTransition && (
        <div class="modal-overlay" onClick={() => setShowTransition(false)}>
          <div class="modal" onClick={e => e.stopPropagation()}>
            <div class="modal-header">
              <h3>🔄 状态流转</h3>
              <span class="close" onClick={() => setShowTransition(false)}>×</span>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>目标状态 *</label>
                <select
                  value={targetStatus}
                  onInput={(e: any) => {
                    targetStatus.value = e.target.value;
                    transitionAction.value = determineDefaultAction(order.status, e.target.value);
                  }}
                >
                  {allowedTransitions.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div class="form-group">
                <label>动作名称 *</label>
                <input type="text" value={transitionAction} onInput={(e: any) => (transitionAction.value = e.target.value)} />
              </div>
              <div class="form-group">
                <label>处理意见 / 退回原因</label>
                <textarea
                  rows="3"
                  value={transitionComment}
                  onInput={(e: any) => (transitionComment.value = e.target.value)}
                  placeholder={targetStatus.value === "pending_dispatch" ? "请填写退回补正的具体原因..." : "请填写处理意见..."}
                ></textarea>
              </div>
              <div class="form-group">
                <label>审计备注</label>
                <textarea
                  rows="2"
                  value={transitionAuditNote}
                  onInput={(e: any) => (transitionAuditNote.value = e.target.value)}
                  placeholder="可选，将写入审计备注"
                ></textarea>
              </div>
              <div class="alert alert-info">
                当前版本 v{order.version}，系统将自动校验版本号、权限和必填证据材料。
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-ghost" onClick={() => setShowTransition(false)}>取消</button>
              <button class="btn-primary" onClick={handleTransition} disabled={processing.value}>
                {processing.value ? "处理中..." : "✓ 确认提交"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAuditModal && (
        <div class="modal-overlay" onClick={() => setShowAuditModal(false)}>
          <div class="modal" onClick={e => e.stopPropagation()}>
            <div class="modal-header">
              <h3>📝 添加审计备注</h3>
              <span class="close" onClick={() => setShowAuditModal(false)}>×</span>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>备注类型</label>
                <select value={auditNoteType} onInput={(e: any) => (auditNoteType.value = e.target.value)}>
                  {AUDIT_NOTE_TYPES.filter(t => t !== "系统记录").map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div class="form-group">
                <label>备注内容 *</label>
                <textarea rows="4" value={newAuditNote} onInput={(e: any) => (newAuditNote.value = e.target.value)}></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-ghost" onClick={() => setShowAuditModal(false)}>取消</button>
              <button class="btn-primary" onClick={handleAddAuditNote} disabled={processing.value}>
                {processing.value ? "提交中..." : "✓ 添加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
