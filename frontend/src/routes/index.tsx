import { component$, useStore, useTask$, $, useVisibleTask$ } from "@builder.io/qwik";
import { type DocumentHead, useNavigate } from "@builder.io/qwik-city";
import { api } from "~/services/api";
import {
  statusColors,
  statusNames,
  warningLevelColors,
  warningLevelNames,
  actionNames,
  statGroupNames,
} from "~/config";
import type {
  Application,
  StatisticsResponse,
  BatchActionResponse,
  BatchResultItem,
} from "~/types";

export default component$(() => {
  const nav = useNavigate();
  const state = useStore({
    loading: true,
    applications: [] as Application[],
    statistics: null as StatisticsResponse | null,
    total: 0,
    page: 1,
    pageSize: 20,
    selectedIds: [] as number[],
    activeGroup: "pending" as string,
    filters: {
      status: "",
      warning_level: "",
      keyword: "",
    },
    showBatchModal: false,
    batchAction: "",
    batchLoading: false,
    batchResult: null as BatchActionResponse | null,
    showCreateModal: false,
    createForm: {
      company_name: "",
      contact_person: "",
      contact_phone: "",
      contact_email: "",
      exhibition_type: "标准展位",
      booth_area: "",
      booth_preference: "",
    },
    createLoading: false,
    batchForm: {
      comment: "",
      correction_reason: "",
      reject_reason: "",
      evidence_required: "",
      booth_confirmation_evidence: "",
    },
  });

  const loadData = $(async () => {
    state.loading = true;
    try {
      const [apps, stats] = await Promise.all([
        api.applications.list({
          stat_group: state.activeGroup,
          status: state.filters.status,
          warning_level: state.filters.warning_level,
          keyword: state.filters.keyword,
          page: state.page,
          page_size: state.pageSize,
        }),
        api.statistics(),
      ]);
      state.applications = apps.items;
      state.total = apps.total;
      state.statistics = stats;
    } catch (e: any) {
      console.error("加载数据失败:", e);
    } finally {
      state.loading = false;
    }
  });

  useTask$(async () => {
    await loadData();
  });

  const toggleSelect = $((id: number) => {
    const idx = state.selectedIds.indexOf(id);
    if (idx === -1) {
      state.selectedIds.push(id);
    } else {
      state.selectedIds.splice(idx, 1);
    }
  });

  const toggleSelectAll = $(() => {
    if (state.selectedIds.length === state.applications.length) {
      state.selectedIds = [];
    } else {
      state.selectedIds = state.applications.map((a) => a.id);
    }
  });

  const handleBatchAction = async () => {
    if (state.selectedIds.length === 0) return;

    state.batchLoading = true;
    state.batchResult = null;

    try {
      const result = await api.batch.action({
        action: state.batchAction,
        application_ids: state.selectedIds,
        comment: state.batchForm.comment,
        correction_reason: state.batchForm.correction_reason,
        reject_reason: state.batchForm.reject_reason,
        evidence_required: state.batchForm.evidence_required,
        booth_confirmation_evidence: state.batchForm.booth_confirmation_evidence,
      });
      state.batchResult = result;
      await loadData();
      state.selectedIds = [];
    } catch (e: any) {
      console.error("批量操作失败:", e);
    } finally {
      state.batchLoading = false;
    }
  };

  const openBatchModal = $((action: string) => {
    state.batchAction = action;
    state.batchResult = null;
    state.batchForm = {
      comment: "",
      correction_reason: "",
      reject_reason: "",
      evidence_required: "",
      booth_confirmation_evidence: "",
    };
    state.showBatchModal = true;
  });

  const handleCreate = $(async () => {
    if (!state.createForm.company_name || !state.createForm.contact_person || !state.createForm.contact_phone) {
      alert("请填写必填项");
      return;
    }

    state.createLoading = true;
    try {
      await api.applications.create({
        company_name: state.createForm.company_name,
        contact_person: state.createForm.contact_person,
        contact_phone: state.createForm.contact_phone,
        contact_email: state.createForm.contact_email,
        exhibition_type: state.createForm.exhibition_type,
        booth_area: state.createForm.booth_area ? parseFloat(state.createForm.booth_area) : undefined,
        booth_preference: state.createForm.booth_preference,
      });
      state.showCreateModal = false;
      state.createForm = {
        company_name: "",
        contact_person: "",
        contact_phone: "",
        contact_email: "",
        exhibition_type: "标准展位",
        booth_area: "",
        booth_preference: "",
      };
      await loadData();
    } catch (e: any) {
      alert(e.message || "创建失败");
    } finally {
      state.createLoading = false;
    }
  });

  const getAvailableBatchActions = () => {
    const actions: { value: string; label: string; danger?: boolean }[] = [];
    const user = api.auth.getCurrentUser();
    if (!user) return actions;

    if (user.role === "registrar") {
      actions.push({ value: "submit", label: "批量提交审核" });
      actions.push({ value: "correct", label: "批量补正材料" });
    }
    if (user.role === "audit_supervisor") {
      actions.push({ value: "approve_audit", label: "批量审核通过" });
      actions.push({ value: "return_for_correction", label: "批量退回补正" });
      actions.push({ value: "reject_audit", label: "批量拒绝", danger: true });
    }
    if (user.role === "review_leader") {
      actions.push({ value: "approve_review", label: "批量复核通过" });
      actions.push({ value: "confirm_booth", label: "批量确认展位" });
      actions.push({ value: "archive", label: "批量归档" });
      actions.push({ value: "return_for_correction", label: "批量退回补正" });
    }

    return actions;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {state.statistics &&
          (
            [
              { key: "pending", label: "待审核", color: "#f59e0b" },
              { key: "passed", label: "审核通过", color: "#10b981" },
              { key: "synced", label: "已同步", color: "#059669" },
            ] as const
          ).map((item) => (
            <div
              key={item.key}
              class="stats-card"
              onClick$={() => {
                state.activeGroup = item.key;
                state.page = 1;
                loadData();
              }}
              style={{
                cursor: "pointer",
                border:
                  state.activeGroup === item.key
                    ? `2px solid ${item.color}`
                    : "2px solid transparent",
                transition: "all 0.2s",
              }}
            >
              <h3 style={{ color: item.color }}>{item.label}</h3>
              <div class="number" style={{ color: item.color }}>
                {state.statistics[item.key as keyof StatisticsResponse] as number}
              </div>
            </div>
          ))}
      </div>

      <div class="tabs">
        {Object.entries(statGroupNames).map(([key, label]) => (
          <div
            key={key}
            class={`tab ${state.activeGroup === key ? "active" : ""}`}
            onClick$={() => {
              state.activeGroup = key;
              state.page = 1;
              loadData();
            }}
          >
            {label}
            {state.statistics && (
              <span
                style={{
                  marginLeft: "6px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  background: state.activeGroup === key ? "rgba(255,255,255,0.3)" : "#e5e7eb",
                  color: state.activeGroup === key ? "white" : "#6b7280",
                  fontSize: "12px",
                }}
              >
                {state.statistics[key as keyof StatisticsResponse] as number}
              </span>
            )}
          </div>
        ))}
      </div>

      <div class="filters">
        <div class="filter-item">
          <label class="form-label">关键词搜索</label>
          <input
            class="form-input"
            placeholder="申请编号 / 公司名称 / 联系人"
            value={state.filters.keyword}
            onInput$={(e) => {
              state.filters.keyword = (e.target as HTMLInputElement).value;
            }}
            onKeyDown$={(e) => {
              if (e.key === "Enter") {
                state.page = 1;
                loadData();
              }
            }}
          />
        </div>
        <div class="filter-item">
          <label class="form-label">预警级别</label>
          <select
            class="form-select"
            value={state.filters.warning_level}
            onChange$={(e) => {
              state.filters.warning_level = (e.target as HTMLSelectElement).value;
              state.page = 1;
              loadData();
            }}
          >
            <option value="">全部</option>
            {Object.entries(warningLevelNames).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div class="filter-item">
          <label class="form-label">状态</label>
          <select
            class="form-select"
            value={state.filters.status}
            onChange$={(e) => {
              state.filters.status = (e.target as HTMLSelectElement).value;
              state.page = 1;
              loadData();
            }}
          >
            <option value="">全部</option>
            {Object.entries(statusNames).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <button class="btn btn-primary" onClick$={() => loadData()}>
            搜索
          </button>
        </div>
      </div>

      <div class="toolbar">
        <button
          class="btn btn-primary"
          onClick$={() => {
            state.showCreateModal = true;
          }}
        >
          + 新建申请
        </button>

        {getAvailableBatchActions().map((action) => (
          <button
            key={action.value}
            class={`btn ${action.danger ? "btn-danger" : "btn-warning"}`}
            disabled={state.selectedIds.length === 0}
            onClick$={() => openBatchModal(action.value)}
          >
            {action.label} ({state.selectedIds.length})
          </button>
        ))}
      </div>

      <div class="card" style={{ padding: 0, overflow: "hidden" }}>
        {state.loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
            加载中...
          </div>
        ) : state.applications.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#6b7280" }}>
            暂无数据
          </div>
        ) : (
          <>
            <table class="table">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>
                    <input
                      type="checkbox"
                      class="checkbox"
                      checked={
                        state.selectedIds.length === state.applications.length &&
                        state.applications.length > 0
                      }
                      onChange$={toggleSelectAll}
                    />
                  </th>
                  <th>申请编号</th>
                  <th>公司名称</th>
                  <th>联系人</th>
                  <th>参展类型</th>
                  <th>状态</th>
                  <th>预警</th>
                  <th>当前处理人</th>
                  <th>提交时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {state.applications.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <input
                        type="checkbox"
                        class="checkbox"
                        checked={state.selectedIds.includes(app.id)}
                        onChange$={() => toggleSelect(app.id)}
                      />
                    </td>
                    <td style={{ fontFamily: "monospace", color: "#3b82f6" }}>
                      {app.application_no}
                    </td>
                    <td style={{ fontWeight: "500" }}>{app.company_name}</td>
                    <td>
                      {app.contact_person}
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        {app.contact_phone}
                      </div>
                    </td>
                    <td>{app.exhibition_type}</td>
                    <td>
                      <span
                        class="badge"
                        style={{
                          background: `${statusColors[app.status]}20`,
                          color: statusColors[app.status],
                        }}
                      >
                        {app.status_name}
                      </span>
                    </td>
                    <td>
                      <span
                        class="tag"
                        style={{
                          background: `${warningLevelColors[app.warning_level]}20`,
                          color: warningLevelColors[app.warning_level],
                        }}
                      >
                        {app.warning_level_name}
                      </span>
                    </td>
                    <td>{app.current_handler || "-"}</td>
                    <td style={{ color: "#6b7280", fontSize: "13px" }}>
                      {formatDate(app.submitted_at)}
                    </td>
                    <td>
                      <button
                        class="btn btn-outline"
                        style={{ padding: "4px 12px", fontSize: "12px" }}
                        onClick$={() => nav(`/applications/${app.id}`)}
                      >
                        办理
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              style={{
                padding: "16px 20px",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "13px",
                color: "#6b7280",
              }}
            >
              <div>
                共 {state.total} 条记录，当前第 {state.page} 页
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  class="btn btn-default"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  disabled={state.page <= 1}
                  onClick$={() => {
                    state.page--;
                    loadData();
                  }}
                >
                  上一页
                </button>
                <button
                  class="btn btn-default"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  disabled={state.page * state.pageSize >= state.total}
                  onClick$={() => {
                    state.page++;
                    loadData();
                  }}
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {state.showCreateModal && (
        <div class="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <h3 style={{ margin: 0, fontSize: "18px" }}>新建展商申请</h3>
              <button
                class="btn btn-default"
                style={{ padding: "4px 12px" }}
                onClick$={() => {
                  state.showCreateModal = false;
                }}
              >
                关闭
              </button>
            </div>
            <div class="modal-body">
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">公司名称 *</label>
                  <input
                    class="form-input"
                    value={state.createForm.company_name}
                    onInput$={(e) => {
                      state.createForm.company_name = (e.target as HTMLInputElement).value;
                    }}
                    placeholder="请输入公司名称"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">参展类型 *</label>
                  <select
                    class="form-select"
                    value={state.createForm.exhibition_type}
                    onChange$={(e) => {
                      state.createForm.exhibition_type = (e.target as HTMLSelectElement).value;
                    }}
                  >
                    <option value="标准展位">标准展位</option>
                    <option value="光地展位">光地展位</option>
                    <option value="特装展位">特装展位</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">联系人 *</label>
                  <input
                    class="form-input"
                    value={state.createForm.contact_person}
                    onInput$={(e) => {
                      state.createForm.contact_person = (e.target as HTMLInputElement).value;
                    }}
                    placeholder="请输入联系人姓名"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">联系电话 *</label>
                  <input
                    class="form-input"
                    value={state.createForm.contact_phone}
                    onInput$={(e) => {
                      state.createForm.contact_phone = (e.target as HTMLInputElement).value;
                    }}
                    placeholder="请输入联系电话"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">邮箱</label>
                  <input
                    class="form-input"
                    value={state.createForm.contact_email}
                    onInput$={(e) => {
                      state.createForm.contact_email = (e.target as HTMLInputElement).value;
                    }}
                    placeholder="请输入邮箱"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">展位面积(㎡)</label>
                  <input
                    type="number"
                    class="form-input"
                    value={state.createForm.booth_area}
                    onInput$={(e) => {
                      state.createForm.booth_area = (e.target as HTMLInputElement).value;
                    }}
                    placeholder="请输入展位面积"
                  />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">展位偏好</label>
                <textarea
                  class="form-textarea"
                  value={state.createForm.booth_preference}
                  onInput$={(e) => {
                    state.createForm.booth_preference = (e.target as HTMLTextAreaElement).value;
                  }}
                  placeholder="请输入展位偏好位置"
                />
              </div>
            </div>
            <div class="modal-footer">
              <button
                class="btn btn-default"
                onClick$={() => {
                  state.showCreateModal = false;
                }}
              >
                取消
              </button>
              <button
                class="btn btn-primary"
                disabled={state.createLoading}
                onClick$={handleCreate}
              >
                {state.createLoading ? "创建中..." : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}

      {state.showBatchModal && (
        <div class="modal-overlay">
          <div class="modal-content" style={{ maxWidth: "700px" }}>
            <div class="modal-header">
              <h3 style={{ margin: 0, fontSize: "18px" }}>
                {actionNames[state.batchAction] || state.batchAction}
              </h3>
              <button
                class="btn btn-default"
                style={{ padding: "4px 12px" }}
                onClick$={() => {
                  state.showBatchModal = false;
                  state.batchResult = null;
                }}
              >
                关闭
              </button>
            </div>
            <div class="modal-body">
              <div class="alert alert-info">
                已选择 <strong>{state.selectedIds.length}</strong> 条申请进行批量处理
              </div>

              {!state.batchResult && (
                <>
                  {state.batchAction === "return_for_correction" && (
                    <div class="form-group">
                      <label class="form-label">补正原因 *</label>
                      <textarea
                        class="form-textarea"
                        value={state.batchForm.correction_reason}
                        onInput$={(e) => {
                          state.batchForm.correction_reason = (e.target as HTMLTextAreaElement).value;
                        }}
                        placeholder="请填写需要补正的原因"
                      />
                    </div>
                  )}

                  {state.batchAction === "reject_audit" && (
                    <div class="form-group">
                      <label class="form-label">退回意见 *</label>
                      <textarea
                        class="form-textarea"
                        value={state.batchForm.reject_reason}
                        onInput$={(e) => {
                          state.batchForm.reject_reason = (e.target as HTMLTextAreaElement).value;
                        }}
                        placeholder="请填写退回意见"
                      />
                    </div>
                  )}

                  {state.batchAction === "confirm_booth" && (
                    <div class="form-group">
                      <label class="form-label">展位确认证据 *</label>
                      <textarea
                        class="form-textarea"
                        value={state.batchForm.booth_confirmation_evidence}
                        onInput$={(e) => {
                          state.batchForm.booth_confirmation_evidence = (e.target as HTMLTextAreaElement).value;
                        }}
                        placeholder="请填写展位确认函编号或相关证据"
                      />
                    </div>
                  )}

                  <div class="form-group">
                    <label class="form-label">备注</label>
                    <textarea
                      class="form-textarea"
                      value={state.batchForm.comment}
                      onInput$={(e) => {
                        state.batchForm.comment = (e.target as HTMLTextAreaElement).value;
                      }}
                      placeholder="可选，填写处理备注"
                    />
                  </div>

                  <div class="alert alert-warning">
                    <strong>注意：</strong>批量操作会逐条校验，越权、状态冲突、版本不一致、缺少必填证据的申请将被拦截。
                    逾期申请不会整批放行，会被逐条拦截。
                  </div>
                </>
              )}

              {state.batchResult && (
                <div>
                  <div
                    style={{
                      marginBottom: "16px",
                      padding: "16px",
                      borderRadius: "8px",
                      background: "#f9fafb",
                      display: "flex",
                      gap: "24px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>批次号</div>
                      <div style={{ fontFamily: "monospace", fontWeight: "500" }}>
                        {state.batchResult.batch_no}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>总计</div>
                      <div style={{ fontSize: "20px", fontWeight: "700" }}>
                        {state.batchResult.total_count}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", color: "#10b981" }}>成功</div>
                      <div style={{ fontSize: "20px", fontWeight: "700", color: "#10b981" }}>
                        {state.batchResult.success_count}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", color: "#ef4444" }}>失败</div>
                      <div style={{ fontSize: "20px", fontWeight: "700", color: "#ef4444" }}>
                        {state.batchResult.fail_count}
                      </div>
                    </div>
                  </div>

                  <div class="section-title">处理结果明细</div>
                  <div class="batch-results">
                    {state.batchResult.results.map((item: BatchResultItem, idx: number) => (
                      <div
                        key={idx}
                        class={`batch-result-item ${item.success ? "success" : "fail"}`}
                      >
                        <div style={{ fontSize: "20px" }}>
                          {item.success ? "✅" : "❌"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "500" }}>
                            {item.application_no || `申请 #${item.application_id}`}
                          </div>
                          {!item.success && (
                            <div style={{ fontSize: "12px", marginTop: "4px" }}>
                              {item.error_code && (
                                <span
                                  style={{
                                    background: "#fecaca",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    marginRight: "8px",
                                  }}
                                >
                                  {item.error_code}
                                </span>
                              )}
                              {item.error_message}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div class="modal-footer">
              {!state.batchResult ? (
                <>
                  <button
                    class="btn btn-default"
                    onClick$={() => {
                      state.showBatchModal = false;
                    }}
                  >
                    取消
                  </button>
                  <button
                    class="btn btn-primary"
                    disabled={state.batchLoading}
                    onClick$={handleBatchAction}
                  >
                    {state.batchLoading ? "处理中..." : "确认批量处理"}
                  </button>
                </>
              ) : (
                <button
                  class="btn btn-primary"
                  onClick$={() => {
                    state.showBatchModal = false;
                    state.batchResult = null;
                  }}
                >
                  完成
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "展商申请列表 - 展会主办方-月底集中处理展商申请系统",
};
