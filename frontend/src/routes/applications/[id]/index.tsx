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

  const getDeadlineInfo = (deadline?: string) => {
    if (!deadline) return null;
    const now = new Date();
    const dl = new Date(deadline);
    const diffMs = dl.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 0) {
      return {
        text: `已逾期 ${Math.abs(diffHours)} 小时`,
        color: "#ef4444",
      };
    } else if (diffHours < 24) {
      return {
        text: `剩余 ${diffHours} 小时`,
        color: "#f59e0b",
      };
    } else {
      return {
        text: `剩余 ${Math.floor(diffHours / 24)} 天`,
        color: "#10b981",
      };
    }
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
  const deadlineInfo = getDeadlineInfo(app.deadline);

  return (
    <div>
      <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button class="btn btn-default" onClick$={() => nav("/")}>
          ← 返回列表
        </button>
        <h1 style={{ margin: 0, fontSize: "20px" }}>
          展商申请详情
        </h1>
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

            {deadlineInfo && (
              <div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                  处理期限
                </div>
                <div style={{ color: deadlineInfo.color, fontWeight: "500" }}>
                  {deadlineInfo.text}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                所在队列
              </div>
              <div style={{ fontWeight: "500" }}>
                {queueNames[app.queue] || app.queue}
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
              <label class="form-label">创建人</label>
              <div style={{ padding: "10px 0", fontSize: "14px" }}>
                {app.created_by}
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
              <label class="form-label">展位确认证据</label>
              <div style={{ padding: "10px 12px", background: "#f0fdf4", borderRadius: "8px", fontSize: "14px", border: "1px solid #bbf7d0" }}>
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
              gap: "24px",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            <div>提交时间：{formatDate(app.submitted_at)}</div>
            <div>最后更新：{formatDate(app.last_updated_at)}</div>
            <div>当前处理人：{app.current_handler || "-"}</div>
            <div>同步状态：{app.sync_status === "synced" ? "已同步" : "待同步"}</div>
          </div>
        </div>
      )}

      {state.activeTab === "records" && (
        <div class="card">
          <div class="section-title">处理记录</div>
          {state.data.processing_records.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#6b7280" }}>
              暂无处理记录
            </div>
          ) : (
            <div class="timeline">
              {state.data.processing_records.map((record: ProcessingRecord) => (
                <div key={record.id} class="timeline-item">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "4px",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: "600", color: "#1f2937" }}>
                        {actionNames[record.action] || record.action}
                      </span>
                      {record.from_status && record.to_status && (
                        <span style={{ marginLeft: "8px", fontSize: "13px", color: "#6b7280" }}>
                          {statusNames[record.from_status]} → {statusNames[record.to_status]}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>
                      {formatDate(record.created_at)}
                    </div>
                  </div>
                  <div style={{ fontSize: "13px", color: "#4b5563", marginBottom: "4px" }}>
                    处理人：{record.handler_name} ({roleNames[record.handler_role] || record.handler_role})
                    {record.previous_handler && (
                      <span style={{ marginLeft: "12px" }}>
                        上一处理人：{record.previous_handler}
                      </span>
                    )}
                    {record.version && (
                      <span style={{ marginLeft: "12px" }}>版本：v{record.version}</span>
                    )}
                  </div>
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
                </div>
              ))}
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
                  ⚠️ 该申请已逾期，操作后将在处理记录中留下异常原因
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
                    placeholder="请详细说明需要补正的内容"
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
                  <label class="form-label">需补充证据</label>
                  <textarea
                    class="form-textarea"
                    value={state.actionForm.evidence_required}
                    onInput$={(e) => {
                      state.actionForm.evidence_required = (e.target as HTMLTextAreaElement).value;
                    }}
                    placeholder="请列出需要补充的证据清单（选填）"
                  />
                </div>
              )}

              {state.actionForm.action === "confirm_booth" && (
                <div class="form-group">
                  <label class="form-label">展位确认证据 *</label>
                  <textarea
                    class="form-textarea"
                    value={state.actionForm.booth_confirmation_evidence}
                    onInput$={(e) => {
                      state.actionForm.booth_confirmation_evidence = (e.target as HTMLTextAreaElement).value;
                    }}
                    placeholder="请填写展位确认函编号或上传相关证据说明"
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
                  placeholder="可选，填写处理备注信息"
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
                <div>
                  <strong>权限校验：</strong>将检查您的角色、是否为当前处理人、状态流转是否合法
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
