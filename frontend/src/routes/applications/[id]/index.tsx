import { component$, useStore, useTask$, $ } from "@builder.io/qwik";
import { type DocumentHead, useNavigate, routeLoader$ } from "@builder.io/qwik-city";
import { api } from "~/services/api";
import {
  statusColors,
  statusNames,
  warningLevelColors,
  warningLevelNames,
  actionNames,
  roleNames,
  queueNames,
} from "~/config";
import type {
  ApplicationDetailResponse,
  Application,
  ProcessingRecord,
  AuditNote,
  PendingCorrectionAction,
  EvidenceItem,
} from "~/types";

export const useApplicationId = routeLoader$(({ params }) => {
  return parseInt(params.id);
});

export default component$(() => {
  const nav = useNavigate();
  const appId = useApplicationId();

  const state = useStore({
    loading: true,
    data: null as ApplicationDetailResponse | null,
    activeTab: "info",
    actionForm: {
      action: "",
      comment: "",
      correction_reason: "",
      reject_reason: "",
      evidence_required: "",
      booth_confirmation_evidence: "",
    },
    showActionModal: false,
    actionLoading: false,
    error: "",
    newNote: "",
    noteLoading: false,
  });

  const loadData = $(async () => {
    state.loading = true;
    state.error = "";
    try {
      const data = await api.applications.get(appId.value);
      state.data = data;
    } catch (e: any) {
      state.error = e.message || "加载失败";
    } finally {
      state.loading = false;
    }
  });

  useTask$(async () => {
    await loadData();
  });

  const getAvailableActions = () => {
    if (!state.data) return [];
    const app = state.data.application;
    const user = api.auth.getCurrentUser();
    if (!user) return [];

    const actions: { value: string; label: string; type: string; required?: string[] }[] = [];

    const canSubmit = ["draft", "pending_submit"].includes(app.status) && user.role === "registrar";
    const canCorrect = ["pending_audit", "correction_required"].includes(app.status) && user.role === "registrar";
    const canAuditApprove = app.status === "pending_audit" && user.role === "audit_supervisor";
    const canAuditReject = app.status === "pending_audit" && user.role === "audit_supervisor";
    const canReturnCorrection = ["pending_audit", "pending_review", "pending_booth_confirm"].includes(app.status) && 
      (user.role === "audit_supervisor" || user.role === "review_leader");
    const canReviewApprove = app.status === "pending_review" && user.role === "review_leader";
    const canConfirmBooth = ["pending_booth_confirm", "audit_passed"].includes(app.status) && user.role === "review_leader";
    const canArchive = app.status === "booth_confirmed" && user.role === "review_leader";
    const canSync = app.status === "archived" && user.role === "review_leader";

    if (canSubmit) {
      actions.push({ value: "submit", label: "提交审核", type: "primary" });
    }
    if (canCorrect) {
      actions.push({ value: "correct", label: "补正材料", type: "primary" });
    }
    if (canAuditApprove) {
      actions.push({ value: "approve_audit", label: "审核通过", type: "success" });
    }
    if (canReturnCorrection) {
      actions.push({ 
        value: "return_for_correction", 
        label: "退回补正", 
        type: "warning",
        required: ["correction_reason"]
      });
    }
    if (canAuditReject) {
      actions.push({ 
        value: "reject_audit", 
        label: "拒绝申请", 
        type: "danger",
        required: ["reject_reason"]
      });
    }
    if (canReviewApprove) {
      actions.push({ value: "approve_review", label: "复核通过", type: "success" });
    }
    if (canConfirmBooth) {
      actions.push({ 
        value: "confirm_booth", 
        label: "确认展位", 
        type: "success",
        required: ["booth_confirmation_evidence"]
      });
    }
    if (canArchive) {
      actions.push({ value: "archive", label: "归档", type: "primary" });
    }
    if (canSync) {
      actions.push({ value: "sync", label: "同步", type: "success" });
    }

    return actions;
  };

  const openActionModal = $((action: string) => {
    state.actionForm = {
      action,
      comment: "",
      correction_reason: "",
      reject_reason: "",
      evidence_required: "",
      booth_confirmation_evidence: "",
    };
    state.showActionModal = true;
  });

  const handleAction = $(async () => {
    if (!state.data) return;

    const actionConfig = getAvailableActions().find((a) => a.value === state.actionForm.action);
    if (actionConfig?.required) {
      for (const field of actionConfig.required) {
        const value = state.actionForm[field as keyof typeof state.actionForm];
        if (!value || !value.toString().trim()) {
          state.error = `请填写必填项：${field === "correction_reason" ? "补正原因" : field === "reject_reason" ? "退回意见" : "展位确认证据"}`;
          return;
        }
      }
    }

    state.actionLoading = true;
    state.error = "";

    try {
      const result = await api.applications.action(appId.value, {
        application_id: appId.value,
        action: state.actionForm.action,
        comment: state.actionForm.comment,
        correction_reason: state.actionForm.correction_reason,
        reject_reason: state.actionForm.reject_reason,
        evidence_required: state.actionForm.evidence_required,
        booth_confirmation_evidence: state.actionForm.booth_confirmation_evidence,
        version: state.data.application.version,
      });
      state.data = result;
      state.showActionModal = false;
    } catch (e: any) {
      state.error = e.message || "操作失败";
    } finally {
      state.actionLoading = false;
    }
  });

  const handleAddNote = $(async () => {
    if (!state.newNote.trim()) return;

    state.noteLoading = true;
    try {
      const result = await api.applications.addNote(appId.value, state.newNote.trim());
      if (state.data) {
        state.data.audit_notes = result.audit_notes;
      }
      state.newNote = "";
    } catch (e: any) {
      state.error = e.message || "添加备注失败";
    } finally {
      state.noteLoading = false;
    }
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateEvidenceStats = (items?: EvidenceItem[]) => {
    if (!items || items.length === 0) return null;
    const required = items.filter(i => i.required);
    const optional = items.filter(i => !i.required);
    const requiredDone = required.filter(i => i.has_evidence).length;
    const optionalDone = optional.filter(i => i.has_evidence).length;
    return {
      total: items.length,
      requiredCount: required.length,
      requiredDone,
      optionalCount: optional.length,
      optionalDone,
      allRequiredDone: required.length > 0 && requiredDone === required.length,
    };
  };

  const groupEvidenceByCategory = (items?: EvidenceItem[]) => {
    if (!items) return {};
    const groups: Record<string, EvidenceItem[]> = {};
    for (const item of items) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  };

  if (state.loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
        加载中...
      </div>
    );
  }

  if (state.error && !state.data) {
    return (
      <div class="card">
        <div class="alert alert-error">{state.error}</div>
        <button class="btn btn-primary" onClick$={() => nav("/")}>
          返回列表
        </button>
      </div>
    );
  }

  if (!state.data) {
    return null;
  }

  const app = state.data.application;
  const evidenceStats = calculateEvidenceStats(app.evidence_checklist);
  const evidenceByCategory = groupEvidenceByCategory(app.evidence_checklist);

  return (
    <div>
      <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button class="btn btn-default" onClick$={() => nav("/")}>
          ← 返回列表
        </button>
        <h1 style={{ margin: 0, fontSize: "20px" }}>
          展商申请详情
        </h1>
        {app.deadline_info && (
          <span
            style={{
              marginLeft: "auto",
              display: "inline-block",
              padding: "3px 10px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "600",
              background: `${app.deadline_info.color}15`,
              color: app.deadline_info.color,
              border: `1px solid ${app.deadline_info.color}30`
            }}
          >
            {app.deadline_info.status === "overdue" && "🚨 逾期："}
            {app.deadline_info.status === "approaching" && "⏰ 临期："}
            {app.deadline_info.status === "normal" && "✅ 正常："}
            {app.deadline_info.text}
          </span>
        )}
      </div>

      {state.error && (
        <div class="alert alert-error" style={{ marginBottom: "16px" }}>
          {state.error}
          <button
            style={{ float: "right", background: "none", border: "none", color: "inherit", cursor: "pointer" }}
            onClick$={() => {
              state.error = "";
            }}
          >
            ✕
          </button>
        </div>
      )}

      {app.is_overdue && app.overdue_exception && (
        <div
          class="card"
          style={{
            marginBottom: "16px",
            background: "linear-gradient(135deg, #fff7ed 0%, #fef2f2 100%)",
            border: "1px solid #fdba74",
          }}
        >
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px"
          }}>
            <div style={{ flex: 1, minWidth: "280px" }}>
              <div style={{
                fontSize: "15px",
                fontWeight: "700",
                color: "#b91c1c",
                marginBottom: "10px",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                🚨 逾期异常提醒
                <span style={{
                  fontSize: "11px",
                  padding: "1px 8px",
                  borderRadius: "10px",
                  background: "#b91c1c",
                  color: "white",
                  fontWeight: "500",
                }}>
                  {app.overdue_exception.handling_status === "pending" ? "待处理" : "已处理"}
                </span>
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "10px 20px",
                fontSize: "13px",
                lineHeight: "1.8"
              }}>
                <div>
                  <span style={{ color: "#78350f", fontWeight: "600" }}>逾期时长：</span>
                  <span style={{ color: "#92400e" }}>
                    {app.overdue_exception.overdue_days}天{app.overdue_exception.overdue_hours % 24}小时
                  </span>
                </div>
                <div>
                  <span style={{ color: "#78350f", fontWeight: "600" }}>到期时间：</span>
                  <span style={{ color: "#92400e" }}>
                    {formatDate(app.overdue_exception.deadline)}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#78350f", fontWeight: "600" }}>责任人：</span>
                  <span style={{ color: "#92400e", fontWeight: "600" }}>
                    {app.overdue_exception.responsible_person_name || app.responsible_person_name || "-"}
                    ({roleNames[app.overdue_exception.responsible_person_role || ""] || ""})
                  </span>
                </div>
                <div>
                  <span style={{ color: "#78350f", fontWeight: "600" }}>状态节点：</span>
                  <span style={{ color: "#92400e" }}>
                    {statusNames[app.overdue_exception.status_at_overdue || ""] || app.status_name}
                  </span>
                </div>
              </div>
              {app.overdue_exception.correction_action_required && (
                <div style={{
                  marginTop: "12px",
                  padding: "10px 12px",
                  background: "white",
                  borderRadius: "6px",
                  border: "1px solid #fed7aa",
                  fontSize: "13px",
                  color: "#7c2d12",
                  lineHeight: "1.7"
                }}>
                  <div style={{ fontWeight: "600", marginBottom: "4px" }}>📋 要求处理动作：</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    {app.overdue_exception.correction_action_required}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {app.last_error_message && (
        <div
          class="card"
          style={{
            marginBottom: "16px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
          }}
        >
          <div style={{
            fontSize: "14px",
            fontWeight: "700",
            color: "#b91c1c",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            ⚠️ 最近一次异常拦截记录
          </div>
          <div style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            fontSize: "13px"
          }}>
            <div style={{
              fontFamily: "monospace",
              padding: "2px 10px",
              borderRadius: "4px",
              background: "#fee2e2",
              color: "#991b1b",
              fontWeight: "600",
            }}>
              {app.last_error_code}
            </div>
            <div style={{ color: "#7f1d1d", flex: 1, minWidth: "250px" }}>
              {app.last_error_message}
            </div>
            <button
              class="btn btn-primary"
              style={{ padding: "3px 12px", fontSize: "12px" }}
              onClick$={() => (state.activeTab = "records")}
            >
              查看处理记录 →
            </button>
          </div>
        </div>
      )}

      {app.pending_correction_actions && app.pending_correction_actions.length > 0 && (
        <div
          class="card"
          style={{
            marginBottom: "16px",
            background: "#fffbeb",
            border: "1px solid #fcd34d",
          }}
        >
          <div style={{
            fontSize: "14px",
            fontWeight: "700",
            color: "#92400e",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            📝 待补正事项（共 {app.pending_correction_actions.length} 项）
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {app.pending_correction_actions.map((item: PendingCorrectionAction, idx: number) => (
              <div
                key={idx}
                style={{
                  padding: "12px",
                  background: "white",
                  borderRadius: "6px",
                  border: "1px solid #fde68a",
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "8px"
                }}>
                  <div style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#b45309"
                  }}>
                    第 {idx + 1} 项 · 退回补正原因
                  </div>
                  <div style={{ fontSize: "12px", color: "#92400e" }}>
                    {item.returned_by_name} 于 {item.returned_at ? formatDate(item.returned_at) : ""} 退回
                  </div>
                </div>
                <div style={{
                  background: "#fff7ed",
                  padding: "8px 10px",
                  borderRadius: "4px",
                  fontSize: "13px",
                  color: "#7c2d12",
                  lineHeight: "1.6",
                  marginBottom: "8px"
                }}>
                  {item.reason}
                </div>
                {item.evidence_required && (
                  <div style={{
                    background: "#eff6ff",
                    padding: "8px 10px",
                    borderRadius: "4px",
                    fontSize: "13px",
                    color: "#1e40af",
                    lineHeight: "1.6"
                  }}>
                    <strong>需补充证据：</strong>
                    <div style={{ whiteSpace: "pre-wrap", marginTop: "4px" }}>
                      {item.evidence_required}
                    </div>
                  </div>
                )}
                {item.deadline_hours && (
                  <div style={{
                    marginTop: "6px",
                    fontSize: "12px",
                    color: "#6b7280"
                  }}>
                    补正期限：{item.deadline_hours}小时内
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div class="card" style={{ marginBottom: "16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <div>
            <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>
              申请编号
            </div>
            <div style={{ fontFamily: "monospace", fontSize: "20px", fontWeight: "700", color: "#1f2937" }}>
              {app.application_no}
            </div>
          </div>

          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                当前状态
              </div>
              <span
                class="badge"
                style={{
                  background: `${statusColors[app.status]}20`,
                  color: statusColors[app.status],
                  fontSize: "14px",
                  padding: "4px 12px",
                }}
              >
                {app.status_name}
              </span>
            </div>

            <div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                预警级别
              </div>
              <span
                class="tag"
                style={{
                  background: `${warningLevelColors[app.warning_level]}20`,
                  color: warningLevelColors[app.warning_level],
                  fontSize: "14px",
                }}
              >
                {app.warning_level_name}
              </span>
            </div>

            <div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                所在队列
              </div>
              <div style={{ fontWeight: "500" }}>
                {queueNames[app.queue] || app.queue}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                逾期责任人
              </div>
              <div style={{ fontWeight: "600", color: app.is_overdue ? "#b91c1c" : "#1f2937" }}>
                {app.responsible_person_name || "-"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        {getAvailableActions().map((action) => (
          <button
            key={action.value}
            class={`btn btn-${action.type}`}
            onClick$={() => openActionModal(action.value)}
            title={app.is_overdue ? "逾期单据操作将在处理记录中留下异常说明" : undefined}
          >
            {action.label}
          </button>
        ))}
      </div>

      <div class="tabs" style={{ marginBottom: "16px" }}>
        <div
          class={`tab ${state.activeTab === "info" ? "active" : ""}`}
          onClick$={() => (state.activeTab = "info")}
        >
          基本信息
        </div>
        <div
          class={`tab ${state.activeTab === "evidence" ? "active" : ""}`}
          onClick$={() => (state.activeTab = "evidence")}
        >
          证据清单
          {evidenceStats && (
            <span style={{
              marginLeft: "6px",
              fontSize: "11px",
              padding: "1px 7px",
              borderRadius: "10px",
              background: evidenceStats.allRequiredDone ? "#bbf7d0" : "#fde68a",
              color: evidenceStats.allRequiredDone ? "#166534" : "#92400e",
              fontWeight: "600"
            }}>
              {evidenceStats.requiredDone}/{evidenceStats.requiredCount}必填
            </span>
          )}
        </div>
        <div
          class={`tab ${state.activeTab === "records" ? "active" : ""}`}
          onClick$={() => (state.activeTab = "records")}
        >
          处理记录 ({state.data.processing_records.length})
        </div>
        <div
          class={`tab ${state.activeTab === "notes" ? "active" : ""}`}
          onClick$={() => (state.activeTab = "notes")}
        >
          审计备注 ({state.data.audit_notes.length})
        </div>
        <div
          class={`tab ${state.activeTab === "attachments" ? "active" : ""}`}
          onClick$={() => (state.activeTab = "attachments")}
        >
          附件 ({state.data.attachments.length})
        </div>
      </div>

      {state.activeTab === "info" && (
        <div class="card">
          <div class="section-title">基本信息</div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">公司名称</label>
              <div style={{ padding: "10px 0", fontSize: "14px" }}>
                {app.company_name}
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">参展类型</label>
              <div style={{ padding: "10px 0", fontSize: "14px" }}>
                {app.exhibition_type}
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">联系人</label>
              <div style={{ padding: "10px 0", fontSize: "14px" }}>
                {app.contact_person}
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">联系电话</label>
              <div style={{ padding: "10px 0", fontSize: "14px" }}>
                {app.contact_phone}
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">邮箱</label>
              <div style={{ padding: "10px 0", fontSize: "14px" }}>
                {app.contact_email || "-"}
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">展位面积</label>
              <div style={{ padding: "10px 0", fontSize: "14px" }}>
                {app.booth_area ? `${app.booth_area} ㎡` : "-"}
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">版本号</label>
              <div style={{ padding: "10px 0", fontSize: "14px" }}>
                v{app.version}
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">创建人 / 当前处理人</label>
              <div style={{ padding: "10px 0", fontSize: "14px" }}>
                {app.created_by} → {app.current_handler_name || app.current_handler || "-"}
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">展位偏好</label>
            <div style={{ padding: "10px 0", fontSize: "14px" }}>
              {app.booth_preference || "-"}
            </div>
          </div>
          {app.booth_confirmation_evidence && (
            <div class="form-group">
              <label class="form-label">✅ 展位确认证据（已闭环）</label>
              <div style={{
                padding: "12px",
                background: "#f0fdf4",
                borderRadius: "8px",
                fontSize: "14px",
                border: "1px solid #bbf7d0",
                color: "#166534",
                lineHeight: "1.6"
              }}>
                {app.booth_confirmation_evidence}
              </div>
            </div>
          )}
          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              flexWrap: "wrap",
              gap: "16px 24px",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            <div>提交时间：{formatDate(app.submitted_at)}</div>
            <div>最后更新：{formatDate(app.last_updated_at)}</div>
            <div>同步状态：{app.sync_status === "synced" ? "✅ 已同步" : "⏳ 待同步"}</div>
          </div>
        </div>
      )}

      {state.activeTab === "evidence" && (
        <div class="card">
          <div class="section-title">证据闭环清单</div>
          {!app.evidence_checklist || app.evidence_checklist.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#6b7280" }}>
              暂无证据要求
            </div>
          ) : (
            <>
              {evidenceStats && (
                <div style={{
                  marginBottom: "16px",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background: evidenceStats.allRequiredDone
                    ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
                    : "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                  border: `1px solid ${evidenceStats.allRequiredDone ? "#bbf7d0" : "#fde68a"}`,
                  fontSize: "13px",
                  display: "flex",
                  gap: "24px",
                  flexWrap: "wrap",
                  color: evidenceStats.allRequiredDone ? "#166534" : "#92400e"
                }}>
                  <div>
                    <strong>必填项进度：</strong>
                    {evidenceStats.requiredDone} / {evidenceStats.requiredCount} 已完成
                    {evidenceStats.allRequiredDone && " ✅ 闭环完成"}
                    {!evidenceStats.allRequiredDone && " ⚠️ 尚未闭环"}
                  </div>
                  <div>
                    <strong>选填项进度：</strong>
                    {evidenceStats.optionalDone} / {evidenceStats.optionalCount} 已完成
                  </div>
                </div>
              )}
              {Object.entries(evidenceByCategory).map(([category, items]) => (
                <div key={category} style={{ marginBottom: "16px" }}>
                  <div style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#374151",
                    marginBottom: "8px",
                    paddingBottom: "6px",
                    borderBottom: "1px solid #e5e7eb"
                  }}>
                    📂 {category}类
                  </div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "10px"
                  }}>
                    {items.map((it: EvidenceItem, i: number) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 12px",
                          borderRadius: "6px",
                          border: `1px solid ${it.has_evidence ? "#bbf7d0" : it.required ? "#fecaca" : "#e5e7eb"}`,
                          background: it.has_evidence ? "#f0fdf4" : it.required ? "#fff7f7" : "white"
                        }}
                      >
                        <div style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "4px",
                          border: `2px solid ${it.has_evidence ? "#10b981" : it.required ? "#ef4444" : "#d1d5db"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: it.has_evidence ? "#10b981" : "white",
                          color: "white",
                          fontSize: "14px",
                          flexShrink: 0
                        }}>
                          {it.has_evidence && "✓"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: "500", color: "#1f2937" }}>
                            {it.name}
                            {it.required && (
                              <span style={{
                                marginLeft: "6px",
                                fontSize: "10px",
                                padding: "1px 5px",
                                borderRadius: "3px",
                                background: "#fee2e2",
                                color: "#b91c1c",
                                fontWeight: "600"
                              }}>
                                必填
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: "11px",
                            marginTop: "2px",
                            color: it.has_evidence ? "#10b981" : it.required ? "#ef4444" : "#6b7280"
                          }}>
                            {it.has_evidence ? "✅ 已具备" : it.required ? "⚠️ 未提供（必填）" : "○ 可选"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {state.activeTab === "records" && (
        <div class="card">
          <div class="section-title">处理记录（含异常留痕）</div>
          {state.data.processing_records.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#6b7280" }}>
              暂无处理记录
            </div>
          ) : (
            <div class="timeline">
              {state.data.processing_records.map((record: ProcessingRecord) => {
                const isError = record.action === "error_record";
                return (
                  <div
                    key={record.id}
                    class="timeline-item"
                    style={{
                      borderLeft: isError ? "3px solid #ef4444" : undefined,
                      background: isError ? "#fff7f7" : undefined,
                      borderRadius: isError ? "0 6px 6px 0" : undefined,
                      padding: isError ? "10px 12px 10px 15px" : undefined,
                      marginLeft: isError ? "8px" : undefined,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "4px",
                        flexWrap: "wrap",
                        gap: "6px"
                      }}
                    >
                      <div>
                        <span style={{
                          fontWeight: "600",
                          color: isError ? "#b91c1c" : "#1f2937"
                        }}>
                          {record.action_name || actionNames[record.action] || record.action}
                        </span>
                        {isError && record.error_code && (
                          <span style={{
                            fontFamily: "monospace",
                            fontSize: "11px",
                            padding: "1px 7px",
                            borderRadius: "3px",
                            background: "#fecaca",
                            color: "#991b1b",
                            marginLeft: "8px",
                            fontWeight: "600"
                          }}>
                            {record.error_code}
                          </span>
                        )}
                        {(record.from_status_name || record.from_status) && (record.to_status_name || record.to_status) && (
                          <span style={{ marginLeft: "8px", fontSize: "13px", color: "#6b7280" }}>
                            {record.from_status_name || statusNames[record.from_status || ""]} 
                            → 
                            {record.to_status_name || statusNames[record.to_status || ""]}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        {formatDate(record.created_at)}
                      </div>
                    </div>
                    <div style={{ fontSize: "13px", color: "#4b5563", marginBottom: "4px" }}>
                      处理人：{record.handler_name} ({record.role_name || roleNames[record.handler_role] || record.handler_role})
                      {record.previous_handler_name && (
                        <span style={{ marginLeft: "12px", color: "#6b7280" }}>
                          ← 上一处理：{record.previous_handler_name}
                          {record.previous_handler_role_name ? ` (${record.previous_handler_role_name})` : ""}
                        </span>
                      )}
                      {record.version && (
                        <span style={{ marginLeft: "12px" }}>版本：v{record.version}</span>
                      )}
                    </div>
                    {record.previous_result && (
                      <div style={{
                        fontSize: "12px",
                        color: "#4b5563",
                        padding: "4px 8px",
                        background: "#f3f4f6",
                        borderRadius: "4px",
                        display: "inline-block",
                        marginTop: "2px"
                      }}>
                        📌 上一环节结果：{record.previous_result}
                      </div>
                    )}
                    {record.comment && (
                      <div style={{ fontSize: "13px", color: "#374151", marginTop: "4px" }}>
                        备注：{record.comment}
                      </div>
                    )}
                    {record.correction_reason && (
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#b45309",
                          marginTop: "4px",
                          padding: "8px",
                          background: "#fef3c7",
                          borderRadius: "4px",
                        }}
                      >
                        📝 补正原因：{record.correction_reason}
                      </div>
                    )}
                    {record.reject_reason && (
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#b91c1c",
                          marginTop: "4px",
                          padding: "8px",
                          background: "#fee2e2",
                          borderRadius: "4px",
                        }}
                      >
                        ❌ 退回意见：{record.reject_reason}
                      </div>
                    )}
                    {record.evidence_required && (
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#1d4ed8",
                          marginTop: "4px",
                          padding: "8px",
                          background: "#dbeafe",
                          borderRadius: "4px",
                        }}
                      >
                        📋 需补充证据：{record.evidence_required}
                      </div>
                    )}
                    {record.booth_confirmation_evidence && (
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#166534",
                          marginTop: "4px",
                          padding: "8px",
                          background: "#dcfce7",
                          borderRadius: "4px",
                        }}
                      >
                        ✅ 展位确认证据：{record.booth_confirmation_evidence}
                      </div>
                    )}
                    {record.correction_action && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#0c4a6e",
                          marginTop: "4px",
                          padding: "8px",
                          background: "#e0f2fe",
                          borderRadius: "4px",
                          lineHeight: "1.6"
                        }}
                      >
                        🔧 补正动作 / 流程上下文：
                        <div style={{ marginTop: "2px", whiteSpace: "pre-wrap" }}>
                          {record.correction_action}
                        </div>
                      </div>
                    )}
                    {isError && record.error_message && (
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#b91c1c",
                          marginTop: "4px",
                          padding: "8px",
                          background: "#fee2e2",
                          borderRadius: "4px",
                          fontWeight: "500"
                        }}>
                        ⚠️ 异常说明：{record.error_message}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {state.activeTab === "notes" && (
        <div class="card">
          <div class="section-title">审计备注</div>
          <div style={{ marginBottom: "16px", display: "flex", gap: "10px" }}>
            <input
              class="form-input"
              placeholder="添加备注信息..."
              value={state.newNote}
              onInput$={(e) => {
                state.newNote = (e.target as HTMLInputElement).value;
              }}
              onKeyDown$={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
            />
            <button
              class="btn btn-primary"
              disabled={state.noteLoading || !state.newNote.trim()}
              onClick$={handleAddNote}
            >
              添加
            </button>
          </div>
          {state.data.audit_notes.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#6b7280" }}>
              暂无审计备注
            </div>
          ) : (
            <div>
              {state.data.audit_notes.map((note: AuditNote) => (
                <div
                  key={note.id}
                  style={{
                    padding: "12px",
                    background: "#f9fafb",
                    borderRadius: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>
                    {note.created_by} · {formatDate(note.created_at)}
                  </div>
                  <div style={{ fontSize: "14px", color: "#1f2937", whiteSpace: "pre-wrap" }}>
                    {note.note}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {state.activeTab === "attachments" && (
        <div class="card">
          <div class="section-title">附件</div>
          {state.data.attachments.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#6b7280" }}>
              暂无附件
            </div>
          ) : (
            <table class="table">
              <thead>
                <tr>
                  <th>文件名</th>
                  <th>类型</th>
                  <th>大小</th>
                  <th>上传人</th>
                  <th>上传时间</th>
                </tr>
              </thead>
              <tbody>
                {state.data.attachments.map((att: any) => (
                  <tr key={att.id}>
                    <td>{att.file_name}</td>
                    <td>{att.file_type || "-"}</td>
                    <td>{att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : "-"}</td>
                    <td>{att.uploaded_by}</td>
                    <td>{formatDate(att.uploaded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {state.showActionModal && (
        <div class="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <h3 style={{ margin: 0, fontSize: "18px" }}>
                {actionNames[state.actionForm.action] || state.actionForm.action}
              </h3>
              <button
                class="btn btn-default"
                style={{ padding: "4px 12px" }}
                onClick$={() => {
                  state.showActionModal = false;
                  state.error = "";
                }}
              >
                关闭
              </button>
            </div>
            <div class="modal-body">
              <div class="alert alert-info">
                <div style={{ marginBottom: "4px" }}>
                  <strong>申请编号：</strong> {app.application_no}
                </div>
                <div style={{ marginBottom: "4px" }}>
                  <strong>公司名称：</strong> {app.company_name}
                </div>
                <div>
                  <strong>当前状态：</strong> {app.status_name}
                </div>
              </div>

              {app.is_overdue && (
                <div class="alert alert-error">
                  ⚠️ 该申请已逾期，操作后将在处理记录中留下逾期异常原因记录和责任人标注
                </div>
              )}

              {state.actionForm.action === "return_for_correction" && (
                <div class="form-group">
                  <label class="form-label">补正原因 *</label>
                  <textarea
                    class="form-textarea"
                    value={state.actionForm.correction_reason}
                    onInput$={(e) => {
                      state.actionForm.correction_reason = (e.target as HTMLTextAreaElement).value;
                    }}
                    placeholder="请详细说明需要补正的内容（退回时必录，会形成待办事项给前序处理人）"
                  />
                </div>
              )}

              {state.actionForm.action === "reject_audit" && (
                <div class="form-group">
                  <label class="form-label">退回意见 *</label>
                  <textarea
                    class="form-textarea"
                    value={state.actionForm.reject_reason}
                    onInput$={(e) => {
                      state.actionForm.reject_reason = (e.target as HTMLTextAreaElement).value;
                    }}
                    placeholder="请详细说明退回原因"
                  />
                </div>
              )}

              {state.actionForm.action === "return_for_correction" && (
                <div class="form-group">
                  <label class="form-label">需补充证据清单</label>
                  <textarea
                    class="form-textarea"
                    value={state.actionForm.evidence_required}
                    onInput$={(e) => {
                      state.actionForm.evidence_required = (e.target as HTMLTextAreaElement).value;
                    }}
                    placeholder="请列出需要补充的证据清单（选填，会作为待补正事项展示）"
                  />
                </div>
              )}

              {state.actionForm.action === "confirm_booth" && (
                <div class="form-group">
                  <label class="form-label">展位确认证据 *（证据闭环）</label>
                  <textarea
                    class="form-textarea"
                    value={state.actionForm.booth_confirmation_evidence}
                    onInput$={(e) => {
                      state.actionForm.booth_confirmation_evidence = (e.target as HTMLTextAreaElement).value;
                    }}
                    placeholder="请填写展位确认函编号、签署信息等（证据闭环校验必填，缺失会被拦截）"
                  />
                </div>
              )}

              <div class="form-group">
                <label class="form-label">处理备注</label>
                <textarea
                  class="form-textarea"
                  value={state.actionForm.comment}
                  onInput$={(e) => {
                    state.actionForm.comment = (e.target as HTMLTextAreaElement).value;
                  }}
                  placeholder="可选，填写处理备注信息；如果是逾期单据，建议在此说明逾期处理情况"
                />
              </div>

              <div
                style={{
                  padding: "12px",
                  background: "#f3f4f6",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                <div style={{ marginBottom: "4px" }}>
                  <strong>版本校验：</strong>当前版本 v{app.version}，操作后版本将更新为 v{app.version + 1}
                </div>
                <div style={{ marginBottom: "4px" }}>
                  <strong>权限校验：</strong>将检查您的角色({roleNames[(api.auth.getCurrentUser()?.role) as keyof typeof roleNames] || ""})、是否为当前处理人、状态流转合法性
                </div>
                <div>
                  <strong>校验层级：</strong>版本 → 角色 → 处理人 → 状态 → 上一处理结果 → 证据闭环 → 字段必填
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button
                class="btn btn-default"
                onClick$={() => {
                  state.showActionModal = false;
                  state.error = "";
                }}
              >
                取消
              </button>
              <button
                class="btn btn-primary"
                disabled={state.actionLoading}
                onClick$={handleAction}
              >
                {state.actionLoading ? "处理中..." : "确认操作"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "展商申请详情 - 展会主办方-月底集中处理展商申请系统",
};
