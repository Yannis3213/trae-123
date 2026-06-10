import { useState, useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { currentUser, isLoggedIn } from "../utils/store.ts";
import { apiFetch } from "../utils/api.ts";
import {
  STATUS_LABELS, STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
  WARNING_LABELS, WARNING_COLORS,
  ROLE_LABELS,
  type FreshPurchaseOrder,
  type PurchaseStatus,
  type PurchaseOrderListResponse,
  type BatchActionRequest,
  type BatchActionResult,
} from "../utils/types.ts";

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleString("zh-CN", { hour12: false });
  } catch {
    return s;
  }
}

export default function BatchProcessIsland() {
  const [orders, setOrders] = useState<FreshPurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [results, setResults] = useState<BatchActionResult[] | null>(null);

  const selected = useSignal<Set<number>>(new Set());
  const statusFilter = useSignal<PurchaseStatus | "">("");
  const onlyMine = useSignal(false);

  const targetStatus = useSignal<PurchaseStatus | "">("");
  const batchAction = useSignal("批量派发");
  const batchComment = useSignal("");
  const processing = useSignal(false);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter.value) params.set("status", statusFilter.value);
      if (onlyMine.value) params.set("only_mine", "true");
      params.set("page_size", "100");
      const resp = await apiFetch<PurchaseOrderListResponse>(`/orders?${params.toString()}`);
      setOrders(resp.items.filter(o => o.status !== "closed"));
      setTotal(resp.total);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn.value) {
      loadData();
    }
  }, [isLoggedIn.value, statusFilter.value, onlyMine.value]);

  if (!isLoggedIn.value || !currentUser.value) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return <div class="loading-state">跳转中...</div>;
  }

  const user = currentUser.value;

  function toggleSelect(id: number) {
    const next = new Set(selected.value);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selected.value = next;
  }

  function toggleSelectAll() {
    if (selected.value.size === orders.length) {
      selected.value = new Set();
    } else {
      selected.value = new Set(orders.map(o => o.id));
    }
  }

  async function handleBatchSubmit() {
    if (selected.value.size === 0) {
      setMsg({ type: "error", text: "请先选择要处理的单据" });
      return;
    }
    if (!targetStatus.value) {
      setMsg({ type: "error", text: "请选择目标状态" });
      return;
    }

    processing.value = true;
    setMsg(null);
    setResults(null);
    try {
      const orderIds = Array.from(selected.value);
      const expectedVersions: Record<string, number> = {};
      orders.forEach(o => {
        if (orderIds.includes(o.id)) {
          expectedVersions[String(o.id)] = o.version;
        }
      });

      const req: BatchActionRequest = {
        order_ids: orderIds,
        target_status: targetStatus.value as PurchaseStatus,
        comment: batchComment.value || undefined,
        action: batchAction.value,
        expected_versions: expectedVersions,
      };

      const result = await apiFetch<BatchActionResult[]>(`/orders/batch`, {
        method: "POST",
        body: JSON.stringify(req),
      });

      setResults(result);
      const successCount = result.filter(r => r.success).length;
      const failCount = result.filter(r => !r.success).length;
      setMsg({
        type: successCount > 0 ? "success" : "error",
        text: `批量操作完成：成功 ${successCount} 条，失败 ${failCount} 条`
      });

      if (successCount > 0) {
        selected.value = new Set();
        loadData();
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      processing.value = false;
    }
  }

  const allowedTargets: PurchaseStatus[] = [];
  if (user.role === "registrar") {
    allowedTargets.push("processing");
  }
  if (user.role === "supervisor") {
    allowedTargets.push("closed", "pending_dispatch");
  }
  if (user.role === "reviewer") {
    allowedTargets.push("processing", "closed");
  }

  return (
    <div class="page-container">
      <div class="page-header">
        <div>
          <a href="/" class="btn-ghost" style="margin-right:8px">← 返回列表</a>
          <h2 class="page-title" style="display:inline-block;margin-left:8px">📦 批量处理</h2>
          <p class="page-desc">
            当前角色：<b style="color:#4338ca">{ROLE_LABELS[user.role]}</b>
            （{user.full_name}）
            <span class="muted"> · 已选择 {selected.value.size} / {orders.length} 条单据</span>
          </p>
        </div>
      </div>

      {msg && (
        <div class={`alert alert-${msg.type}`}>
          {msg.text}
          <span class="close" onClick={() => setMsg(null)}>×</span>
        </div>
      )}

      <div class="batch-config-panel">
        <div class="batch-config-title">⚙️ 批量操作配置</div>
        <div class="batch-config-grid">
          <div class="filter-group">
            <label>筛选状态：</label>
            <select value={statusFilter} onInput={(e: any) => { statusFilter.value = e.target.value; selected.value = new Set(); }}>
              <option value="">全部（未关闭）</option>
              <option value="pending_dispatch">待派发</option>
              <option value="processing">处理中</option>
            </select>
          </div>
          <div class="filter-group">
            <label class="checkbox-label">
              <input type="checkbox" checked={onlyMine} onChange={(e: any) => { onlyMine.value = e.target.checked; selected.value = new Set(); }} />
              只看我的
            </label>
          </div>
          <div style="flex:1"></div>
          <div class="filter-group">
            <label>目标状态：</label>
            <select value={targetStatus} onInput={(e: any) => {
              targetStatus.value = e.target.value;
              batchAction.value = e.target.value === "processing" ? "批量派发处理"
                : e.target.value === "closed" ? "批量复核归档"
                : e.target.value === "pending_dispatch" ? "批量退回补正"
                : "批量操作";
            }}>
              <option value="">请选择</option>
              {allowedTargets.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div class="filter-group">
            <label>动作：</label>
            <input type="text" value={batchAction} onInput={(e: any) => (batchAction.value = e.target.value)} style="width:160px" />
          </div>
          <div class="filter-group" style="flex:1;min-width:260px">
            <label>备注：</label>
            <input type="text" value={batchComment} onInput={(e: any) => (batchComment.value = e.target.value)} placeholder="（可选）批量操作说明..." />
          </div>
          <button class="btn-primary" onClick={handleBatchSubmit} disabled={processing.value || selected.value.size === 0}>
            {processing.value ? "处理中..." : `✅ 批量处理 (${selected.value.size})`}
          </button>
        </div>
        <div class="muted" style="margin-top:8px;font-size:12px">
          ⚠️ 注意：逾期或缺材料的单据会被逐条拦截，不会整批放行；系统将按单据逐一校验权限、版本和必填证据。
        </div>
      </div>

      {results && (
        <div class="batch-results">
          <div class="batch-results-title">📊 批量处理结果（逐条明细）</div>
          <table class="data-table">
            <thead>
              <tr>
                <th>单号</th>
                <th>标题</th>
                <th>结果</th>
                <th>详情</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.order_id}>
                  <td class="cell-order-no">{r.order_no}</td>
                  <td>{orders.find(o => o.id === r.order_id)?.title || "-"}</td>
                  <td>
                    <span class={`tag ${r.success ? "tag-success" : "tag-error"}`}>
                      {r.success ? "✅ 成功" : "❌ 失败"}
                    </span>
                  </td>
                  <td style={r.success ? "color:#065f46" : "color:#991b1b"}>{r.message}</td>
                  <td>
                    <a href={`/orders/${r.order_id}`} class="btn-link">查看详情</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:40px">
                <input
                  type="checkbox"
                  checked={orders.length > 0 && selected.value.size === orders.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>单号</th>
              <th>标题 / 供应商</th>
              <th>门店</th>
              <th>优先级</th>
              <th>状态</th>
              <th>预警</th>
              <th>截止时间</th>
              <th>当前处理人</th>
              <th>异常</th>
              <th>证据</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colspan="11" class="loading-state">加载中...</td></tr>}
            {!loading && orders.length === 0 && <tr><td colspan="11" class="empty-state">暂无可批量处理的单据</td></tr>}
            {orders.map(o => {
              const canActForThis = (
                (targetStatus.value === "processing" && o.status === "pending_dispatch") ||
                (targetStatus.value === "closed" && o.status === "processing") ||
                (targetStatus.value === "pending_dispatch" && o.status === "processing")
              );
              return (
                <tr key={o.id} class={o.is_overdue ? "row-overdue" : selected.value.has(o.id) ? "row-selected" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.value.has(o.id)}
                      onChange={() => toggleSelect(o.id)}
                    />
                  </td>
                  <td>
                    <div class="cell-order-no">{o.order_no}</div>
                    <div class="cell-sub muted">v{o.version}</div>
                  </td>
                  <td>
                    <div class="cell-title"><a href={`/orders/${o.id}`}>{o.title}</a></div>
                    <div class="cell-sub muted">🏭 {o.supplier_name}</div>
                  </td>
                  <td>🏬 {o.store}</td>
                  <td>
                    <span class="tag" style={`background:${PRIORITY_COLORS[o.priority]}20;color:${PRIORITY_COLORS[o.priority]}`}>
                      {PRIORITY_LABELS[o.priority]}
                    </span>
                  </td>
                  <td>
                    <span class="tag" style={`background:${STATUS_COLORS[o.status]}20;color:${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td>
                    <span class="tag" style={`background:${WARNING_COLORS[o.warning_level]}20;color:${WARNING_COLORS[o.warning_level]}`}>
                      {WARNING_LABELS[o.warning_level]}
                    </span>
                  </td>
                  <td>
                    <div>{formatDate(o.deadline)}</div>
                    {o.is_overdue && <div class="cell-sub" style="color:#ef4444">⚠️ 逾期</div>}
                  </td>
                  <td>
                    <div>{o.current_handler?.full_name || "-"}</div>
                    {o.current_handler?.role && (
                      <div class="cell-sub muted">{ROLE_LABELS[o.current_handler.role]}</div>
                    )}
                  </td>
                  <td>
                    {o.has_exception
                      ? <span class="tag tag-exception" title={o.exception_reason || ""}>⚠️ 异常</span>
                      : <span class="muted">-</span>
                    }
                  </td>
                  <td>
                    <div class="evidence-checks">
                      <span class={o.has_quotation_evidence ? "ev-ok" : "ev-miss"} title="供应商报价单">📋{o.has_quotation_evidence ? "✓" : "✗"}</span>
                      <span class={o.has_purchase_evidence ? "ev-ok" : "ev-miss"} title="采购下单">📝{o.has_purchase_evidence ? "✓" : "✗"}</span>
                      <span class={o.has_arrival_evidence ? "ev-ok" : "ev-miss"} title="到货验收">✅{o.has_arrival_evidence ? "✓" : "✗"}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
