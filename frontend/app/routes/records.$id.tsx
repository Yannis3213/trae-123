import { useState, useEffect } from "react";
import { useNavigate, useParams } from "@remix-run/react";
import Layout from "~/components/Layout";
import StatusBadge from "~/components/StatusBadge";
import ExpiryBadge from "~/components/ExpiryBadge";
import EvidenceSummary from "~/components/EvidenceSummary";
import { apiFetch } from "~/utils/api";
import { getToken, isAuthenticated, getCurrentUser } from "~/utils/auth";

interface ProcessingRecord {
  id: string;
  action: string;
  handler: { id: string; name: string };
  comment?: string;
  review_opinion?: string;
  review_result?: string;
  return_reason?: string;
  correction_note?: string;
  created_at: string;
}

interface ExceptionReason {
  id: string;
  reason: string;
  created_at: string;
  created_by: string;
  resolved?: number;
  resolved_at?: string;
}

interface AuditNote {
  id: string;
  content: string;
  created_at: string;
  created_by: { id: string; name: string };
}

interface Attachment {
  id: string;
  filename: string;
  category: string;
  created_at: string;
}

interface RecordDetail {
  id: string;
  record_no: string;
  client_name: string;
  business_type: string;
  status: string;
  expiry_status: string;
  current_handler: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
  version: number;
  suitability_check: boolean;
  risk_assessment: boolean;
  business_opening: boolean;
  review_opinion?: string;
  review_result?: string;
  return_reason?: string;
  correction_note?: string;
  processing_records: ProcessingRecord[];
  exception_reasons: ExceptionReason[];
  audit_notes: AuditNote[];
  attachments: Attachment[];
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

const ACTION_LABELS: Record<string, string> = {
  created: "创建记录",
  assign: "分派",
  transfer: "转办",
  review: "复核",
  visited: "回访",
  approved: "审核通过",
  returned: "退回",
  correction: "补正",
  return: "退回",
};

export default function RecordDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [comment, setComment] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [reviewOpinion, setReviewOpinion] = useState("");
  const [reviewResult, setReviewResult] = useState<"approved" | "rejected">("approved");
  const [returnReason, setReturnReason] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    if (id) {
      loadRecord();
      loadUsers();
    }
  }, [id]);

  const loadRecord = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const data = await apiFetch(`/records/${id}`, {}, token || undefined);
      setRecord(data.record || data);
    } catch (err: any) {
      setError(err.message || "加载记录详情失败");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const token = getToken();
      const data = await apiFetch("/auth/users", {}, token || undefined);
      setUsers(data || []);
    } catch {}
  };

  const user = getCurrentUser();

  const handleStatusUpdate = async (action: string) => {
    try {
      setActionError("");
      const token = getToken();
      const body: any = { action, version: record?.version };
      if (action === "assign" || action === "transfer") {
        if (!selectedUser) {
          setActionError(action === "assign" ? "请选择合规专员" : "请选择营业部经理");
          return;
        }
        body.assigned_to = parseInt(selectedUser);
      }
      if (action === "return") {
        if (!comment) {
          setActionError("请填写退回原因");
          return;
        }
        if (!returnReason) {
          setActionError("请填写补正要求");
          return;
        }
        body.comment = comment;
        body.return_reason = returnReason;
      }
      if (action === "transfer" && comment) {
        body.comment = comment;
      }
      if (action === "review") {
        if (!reviewOpinion) {
          setActionError("请填写复核意见");
          return;
        }
        body.review_opinion = reviewOpinion;
        body.review_result = reviewResult;
      }
      await apiFetch(`/records/${id}/status`, {
        method: "PUT",
        body: JSON.stringify(body),
      }, token || undefined);
      const messages: Record<string, string> = {
        assign: "分派成功",
        transfer: "转办成功",
        review: "审核完成",
        return: "退回成功",
      };
      setActionSuccess(messages[action] || "操作成功");
      setComment("");
      setSelectedUser("");
      setReviewOpinion("");
      setReturnReason("");
      loadRecord();
    } catch (err: any) {
      setActionError(err.message || "操作失败");
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    try {
      const token = getToken();
      await apiFetch(
        `/records/${id}/audit-notes`,
        {
          method: "POST",
          body: JSON.stringify({ content: noteContent }),
        },
        token || undefined
      );
      setNoteContent("");
      loadRecord();
    } catch (err: any) {
      setActionError(err.message || "添加备注失败");
    }
  };

  const handleSubmitCorrection = async () => {
    if (!correctionNote) {
      setActionError("请填写补正说明");
      return;
    }
    if (!record?.version) {
      setActionError("版本号缺失，请刷新页面");
      return;
    }
    try {
      setActionError("");
      const token = getToken();
      await apiFetch(`/records/${id}/correction`, {
        method: "PUT",
        body: JSON.stringify({
          comment: comment || "提交补正材料",
          correction_note: correctionNote,
          version: record.version,
        }),
      }, token || undefined);
      setActionSuccess("补正提交成功");
      setComment("");
      setCorrectionNote("");
      loadRecord();
    } catch (err: any) {
      setActionError(err.message || "提交补正失败");
    }
  };

  const handleUploadEvidence = async (type: string) => {
    try {
      setUploading(true);
      const token = getToken();
      await apiFetch(
        `/records/${id}/attachments`,
        {
          method: "POST",
          body: JSON.stringify({ file_name: `${type}_evidence.pdf`, file_type: "application/pdf", category: type }),
        },
        token || undefined
      );
      loadRecord();
    } catch (err: any) {
      setActionError(err.message || "上传证据失败");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="empty-state" style={{ padding: 80 }}>
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-text">加载中...</div>
        </div>
      </Layout>
    );
  }

  if (error || !record) {
    return (
      <Layout>
        <div className="alert alert-error">{error || "记录不存在"}</div>
        <button className="btn btn-secondary" onClick={() => navigate("/dashboard")}>
          返回列表
        </button>
      </Layout>
    );
  }

  const complianceUsers = users.filter((u) => u.role === "compliance_officer");
  const managerUsers = users.filter((u) => u.role === "branch_manager");

  return (
    <Layout>
      <div style={{ marginBottom: 20 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate("/dashboard")}
          style={{ marginBottom: 12 }}
        >
          ← 返回列表
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>
              记录详情 - {record.record_no}
            </h2>
            <p className="text-sm text-muted" style={{ marginTop: 4 }}>
              版本: v{record.version} · 最后更新:{" "}
              {record.updated_at ? new Date(record.updated_at).toLocaleString("zh-CN") : "—"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <StatusBadge status={record.status} />
            <ExpiryBadge status={record.expiry_status} />
          </div>
        </div>
      </div>

      {actionError && <div className="alert alert-error">{actionError}</div>}
      {actionSuccess && <div className="alert alert-success">{actionSuccess}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div className="card-header">记录信息</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
            <div>
              <div className="text-xs text-muted">记录编号</div>
              <div className="font-medium">{record.record_no}</div>
            </div>
            <div>
              <div className="text-xs text-muted">客户姓名</div>
              <div className="font-medium">{record.client_name}</div>
            </div>
            <div>
              <div className="text-xs text-muted">业务类型</div>
              <div className="font-medium">{record.business_type}</div>
            </div>
            <div>
              <div className="text-xs text-muted">当前处理人</div>
              <div className="font-medium">{record.current_handler?.name || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted">创建时间</div>
              <div className="font-medium text-sm">
                {record.created_at ? new Date(record.created_at).toLocaleString("zh-CN") : "—"}
              </div>
            </div>
            {record.review_opinion && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="text-xs text-muted">复核意见</div>
                <div className="font-medium text-sm" style={{ marginTop: 2 }}>{record.review_opinion}</div>
              </div>
            )}
            {record.review_result && (
              <div>
                <div className="text-xs text-muted">复核结果</div>
                <div style={{ marginTop: 2 }}>
                  <span className={record.review_result === "approved" ? "badge badge-green" : "badge badge-red"}>
                    {record.review_result === "approved" ? "通过" : "驳回"}
                  </span>
                </div>
              </div>
            )}
            {record.return_reason && (
              <div>
                <div className="text-xs text-muted">退回补正要求</div>
                <div className="font-medium text-sm" style={{ color: "var(--warning)" }}>{record.return_reason}</div>
              </div>
            )}
            {record.correction_note && (
              <div>
                <div className="text-xs text-muted">补正说明</div>
                <div className="font-medium text-sm" style={{ color: "var(--info)" }}>{record.correction_note}</div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">证据信息</div>
          <EvidenceSummary
            evidence={{
              suitability_check: record.suitability_check,
              risk_assessment: record.risk_assessment,
              business_opening: record.business_opening,
            }}
            showWarning
          />
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleUploadEvidence("suitability")}
              disabled={uploading}
            >
              上传适当性检查
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleUploadEvidence("risk_assessment")}
              disabled={uploading}
            >
              上传风险测评
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleUploadEvidence("business_opening")}
              disabled={uploading}
            >
              上传业务开通
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">操作区域</div>
        {user?.role === "financial_advisor" && record.status === "pending_assign" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
                <label>选择合规专员</label>
                <select
                  className="form-control"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="">请选择</option>
                  {complianceUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" onClick={() => handleStatusUpdate("assign")}>
                分派
              </button>
            </div>
            {record.return_reason && (
              <div style={{ padding: "8px 12px", background: "var(--warning-light)", borderRadius: "var(--radius)", fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  退回补正要求
                  {record.correction_note && <span className="badge badge-green" style={{ marginLeft: 8 }}>已补正</span>}
                </div>
                <div>{record.return_reason}</div>
              </div>
            )}
            {record.return_reason && !record.correction_note && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                  <label>补正说明 <span style={{ color: "var(--danger)" }}>*</span></label>
                  <textarea
                    className="form-control"
                    value={correctionNote}
                    onChange={(e) => setCorrectionNote(e.target.value)}
                    placeholder="请说明已补充的材料和修正内容"
                    rows={2}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                  <label>备注</label>
                  <input
                    className="form-control"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="补充说明"
                  />
                </div>
                <button className="btn btn-secondary" onClick={handleSubmitCorrection}>
                  提交补正
                </button>
              </div>
            )}
            {record.return_reason && record.correction_note && (
              <div style={{ padding: "8px 12px", background: "var(--info-light)", borderRadius: "var(--radius)", fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>已提交的补正说明</div>
                <div>{record.correction_note}</div>
              </div>
            )}
          </div>
        )}

        {user?.role === "compliance_officer" && record.status === "transferred" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
                <label>选择营业部经理</label>
                <select
                  className="form-control"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="">请选择</option>
                  {managerUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" onClick={() => handleStatusUpdate("transfer")}>
                转办
              </button>
            </div>
            {record.return_reason && (
              <div style={{ padding: "8px 12px", background: "var(--warning-light)", borderRadius: "var(--radius)", fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  退回补正要求
                  {record.correction_note && <span className="badge badge-green" style={{ marginLeft: 8 }}>已补正</span>}
                </div>
                <div>{record.return_reason}</div>
              </div>
            )}
            {record.return_reason && !record.correction_note && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                  <label>补正说明 <span style={{ color: "var(--danger)" }}>*</span></label>
                  <textarea
                    className="form-control"
                    value={correctionNote}
                    onChange={(e) => setCorrectionNote(e.target.value)}
                    placeholder="请说明已补充的材料和修正内容"
                    rows={2}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                  <label>备注</label>
                  <input
                    className="form-control"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="补充说明"
                  />
                </div>
                <button className="btn btn-secondary" onClick={handleSubmitCorrection}>
                  提交补正
                </button>
              </div>
            )}
            {record.return_reason && record.correction_note && (
              <div style={{ padding: "8px 12px", background: "var(--info-light)", borderRadius: "var(--radius)", fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>已提交的补正说明</div>
                <div>{record.correction_note}</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label>退回原因 <span style={{ color: "var(--danger)" }}>*</span></label>
                <input
                  className="form-control"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="请输入退回原因"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label>补正要求 <span style={{ color: "var(--danger)" }}>*</span></label>
                <input
                  className="form-control"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="请输入补正要求"
                />
              </div>
              <button className="btn btn-danger" onClick={() => handleStatusUpdate("return")}>
                退回
              </button>
            </div>
          </div>
        )}

        {user?.role === "branch_manager" && record.status === "visited" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>复核意见 <span style={{ color: "var(--danger)" }}>*</span></label>
              <textarea
                className="form-control"
                value={reviewOpinion}
                onChange={(e) => setReviewOpinion(e.target.value)}
                placeholder="请填写复核意见"
                rows={3}
              />
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
                <label>复核结果 <span style={{ color: "var(--danger)" }}>*</span></label>
                <select
                  className="form-control"
                  value={reviewResult}
                  onChange={(e) => setReviewResult(e.target.value as "approved" | "rejected")}
                >
                  <option value="approved">审核通过</option>
                  <option value="rejected">审核驳回</option>
                </select>
              </div>
              <button className="btn btn-success" onClick={() => handleStatusUpdate("review")}>
                提交复核意见
              </button>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label>退回原因 <span style={{ color: "var(--danger)" }}>*</span></label>
                <input
                  className="form-control"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="请输入退回原因"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label>补正要求 <span style={{ color: "var(--danger)" }}>*</span></label>
                <input
                  className="form-control"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="请输入补正要求"
                />
              </div>
              <button className="btn btn-danger" onClick={() => handleStatusUpdate("return")}>
                退回
              </button>
            </div>
          </div>
        )}

        {!(
          (user?.role === "financial_advisor" && record.status === "pending_assign") ||
          (user?.role === "compliance_officer" && record.status === "transferred") ||
          (user?.role === "branch_manager" && record.status === "visited")
        ) && (
          <div className="text-sm text-muted" style={{ padding: "8px 0" }}>
            当前角色和状态下无可用操作
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
        <div className="card">
          <div className="card-header">处理时间线</div>
          {record.processing_records && record.processing_records.length > 0 ? (
            <div className="timeline">
              {record.processing_records.map((pr, i) => (
                <div key={pr.id || i} className="timeline-item">
                  <div className={`timeline-dot ${i === 0 ? "" : "completed"}`} />
                  <div className="timeline-content">
                    <div className="timeline-title">
                      {ACTION_LABELS[pr.action] || pr.action}
                      {pr.handler?.name && ` — ${pr.handler.name}`}
                    </div>
                    <div className="timeline-time">
                      {pr.created_at ? new Date(pr.created_at).toLocaleString("zh-CN") : ""}
                    </div>
                    {pr.comment && <div className="timeline-desc">{pr.comment}</div>}
                    {pr.review_opinion && (
                      <div style={{ marginTop: 4, padding: "4px 8px", background: "var(--success-light)", borderRadius: 4, fontSize: 12 }}>
                        复核意见：{pr.review_opinion}
                      </div>
                    )}
                    {pr.review_result && (
                      <div style={{ marginTop: 2, fontSize: 12 }}>
                        复核结果：<span className={pr.review_result === "approved" ? "badge badge-green" : "badge badge-red"}>
                          {pr.review_result === "approved" ? "通过" : "驳回"}
                        </span>
                      </div>
                    )}
                    {pr.return_reason && (
                      <div style={{ marginTop: 2, padding: "4px 8px", background: "var(--warning-light)", borderRadius: 4, fontSize: 12 }}>
                        退回补正要求：{pr.return_reason}
                      </div>
                    )}
                    {pr.correction_note && (
                      <div style={{ marginTop: 2, padding: "4px 8px", background: "var(--info-light)", borderRadius: 4, fontSize: 12 }}>
                        补正说明：{pr.correction_note}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="empty-state-text">暂无处理记录</div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">异常原因</div>
          {record.exception_reasons && record.exception_reasons.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {record.exception_reasons.map((er, i) => (
                <div
                  key={er.id || i}
                  style={{
                    padding: "8px 12px",
                    background: er.resolved ? "var(--gray-50)" : "var(--warning-light)",
                    borderRadius: "var(--radius)",
                    fontSize: 13,
                    opacity: er.resolved ? 0.7 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 500, textDecoration: er.resolved ? "line-through" : "none" }}>{er.reason}</div>
                    {er.resolved ? (
                      <span className="badge badge-green">已解决</span>
                    ) : (
                      <span className="badge badge-red">待处理</span>
                    )}
                  </div>
                  <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                    {er.created_at ? new Date(er.created_at).toLocaleString("zh-CN") : ""}
                    {er.resolved && er.resolved_at && ` · 解决于 ${new Date(er.resolved_at).toLocaleString("zh-CN")}`}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="empty-state-text">无异常原因</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
        <div className="card">
          <div className="card-header">审核备注</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="form-control"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="输入审核备注"
              />
              <button className="btn btn-primary btn-sm" onClick={handleAddNote}>
                添加
              </button>
            </div>
          </div>
          {record.audit_notes && record.audit_notes.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {record.audit_notes.map((note, i) => (
                <div
                  key={note.id || i}
                  style={{
                    padding: "10px 12px",
                    background: "var(--gray-50)",
                    borderRadius: "var(--radius)",
                  }}
                >
                  <div style={{ fontSize: 13 }}>{note.content}</div>
                  <div
                    className="text-xs text-muted"
                    style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}
                  >
                    <span>{note.created_by?.name || ""}</span>
                    <span>
                      {note.created_at ? new Date(note.created_at).toLocaleString("zh-CN") : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="empty-state-text">暂无备注</div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">附件</div>
          {record.attachments && record.attachments.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {record.attachments.map((att, i) => (
                <div
                  key={att.id || i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--gray-50)",
                    borderRadius: "var(--radius)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="badge badge-blue">{att.category || "附件"}</span>
                    <span className="text-sm">{att.filename}</span>
                  </div>
                  <span className="text-xs text-muted">
                    {att.created_at ? new Date(att.created_at).toLocaleDateString("zh-CN") : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="empty-state-text">暂无附件</div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
