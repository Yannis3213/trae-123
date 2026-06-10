import { useState, useEffect } from "preact/hooks";
import { useSignal, useSignalEffect } from "@preact/signals";
import { currentUser, isLoggedIn } from "../utils/store.ts";
import { apiFetch } from "../utils/api.ts";
import {
  STATUS_LABELS, STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
  WARNING_LABELS, WARNING_COLORS,
  ROLE_LABELS,
  EXCEPTION_TYPE_LABELS, EXCEPTION_TYPE_COLORS,
  type FreshPurchaseOrder,
  type PurchaseStatus,
  type PriorityLevel,
  type WarningLevel,
  type PurchaseOrderStats,
  type PurchaseOrderListResponse,
} from "../utils/types.ts";

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleString("zh-CN", { hour12: false });
  } catch {
    return s;
  }
}

export default function OrderListIsland() {
  const [orders, setOrders] = useState<FreshPurchaseOrder[]>([]);
  const [stats, setStats] = useState<PurchaseOrderStats | null>(null);
  const [warningCounts, setWarningCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const statusFilter = useSignal<PurchaseStatus | "">("");
  const priorityFilter = useSignal<PriorityLevel | "">("");
  const warningFilter = useSignal<WarningLevel | "">("");
  const exceptionFilter = useSignal<"" | "true" | "false">("");
  const keyword = useSignal("");
  const onlyMine = useSignal(false);

  useSignalEffect(() => {
    loadData();
  });

  async function loadStats() {
    try {
      const s = await apiFetch<PurchaseOrderStats>("/orders/stats");
      setStats(s);
    } catch (err) {
      console.error("加载统计失败", err);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter.value) params.set("status", statusFilter.value);
      if (priorityFilter.value) params.set("priority", priorityFilter.value);
      if (warningFilter.value) params.set("warning_level", warningFilter.value);
      if (exceptionFilter.value) params.set("has_exception", exceptionFilter.value);
      if (keyword.value) params.set("keyword", keyword.value);
      if (onlyMine.value) params.set("only_mine", "true");
      params.set("page", String(page));
      params.set("page_size", String(pageSize));

      const resp = await apiFetch<PurchaseOrderListResponse>(`/orders?${params.toString()}`);
      setOrders(resp.items);
      setTotal(resp.total);
      setWarningCounts(resp.warning_counts);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn.value) {
      loadStats();
      loadData();
    }
  }, [isLoggedIn.value]);

  useEffect(() => {
    loadData();
  }, [page]);

  function resetFilters() {
    statusFilter.value = "";
    priorityFilter.value = "";
    warningFilter.value = "";
    exceptionFilter.value = "";
    keyword.value = "";
    onlyMine.value = false;
    setPage(1);
  }

  if (!isLoggedIn.value || !currentUser.value) {
    return (
      <div class="page-container">
        <div class="loading-state">正在跳转登录页...</div>
        {typeof window !== "undefined" && (window.location.href = "/login", null)}
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div class="page-container">
      <div class="page-header">
        <div>
          <h2 class="page-title">📋 生鲜采购单列表</h2>
          <p class="page-desc">
            当前角色：<b style="color:#4338ca">{ROLE_LABELS[currentUser.value.role]}</b>
            （{currentUser.value.full_name}）
            {currentUser.value.store && <span class="muted"> · {currentUser.value.store}</span>}
          </p>
        </div>
        <div class="header-actions">
          <button class="btn-secondary" onClick={() => { loadStats(); loadData(); }}>
            🔄 刷新
          </button>
          <a href="/batch" class="btn-secondary">📦 批量处理</a>
          <a href="/create" class="btn-primary">➕ 新建采购单</a>
        </div>
      </div>

      {stats && (
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{stats.total}</div>
            <div class="stat-label">全部单据</div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #f59e0b;">
            <div class="stat-value" style="color:#f59e0b">{stats.pending_dispatch}</div>
            <div class="stat-label">待派发</div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #3b82f6;">
            <div class="stat-value" style="color:#3b82f6">{stats.processing}</div>
            <div class="stat-label">处理中</div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #10b981;">
            <div class="stat-value" style="color:#10b981">{stats.closed}</div>
            <div class="stat-label">已关闭</div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #ef4444;">
            <div class="stat-value" style="color:#ef4444">{stats.overdue}</div>
            <div class="stat-label">逾期</div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #f97316;">
            <div class="stat-value" style="color:#f97316">{stats.exception}</div>
            <div class="stat-label">异常</div>
          </div>
        </div>
      )}

      {Object.keys(warningCounts).length > 0 && (
        <div class="warning-bar">
          <span class="warning-title">⏰ 到期预警：</span>
          <span class="warning-tag" style="background:#d1fae5;color:#065f46">
            正常 {warningCounts.normal || 0}
          </span>
          <span class="warning-tag" style="background:#fef3c7;color:#92400e">
            临期 {warningCounts.approaching || 0}
          </span>
          <span class="warning-tag" style="background:#fee2e2;color:#991b1b">
            逾期 {warningCounts.overdue || 0}
          </span>
        </div>
      )}

      <div class="filter-bar">
        <div class="filter-group">
          <label>状态：</label>
          <select value={statusFilter} onInput={(e: any) => { statusFilter.value = e.target.value; setPage(1); }}>
            <option value="">全部</option>
            <option value="pending_dispatch">待派发</option>
            <option value="processing">处理中</option>
            <option value="closed">已关闭</option>
          </select>
        </div>
        <div class="filter-group">
          <label>优先级：</label>
          <select value={priorityFilter} onInput={(e: any) => { priorityFilter.value = e.target.value; setPage(1); }}>
            <option value="">全部</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="urgent">紧急</option>
          </select>
        </div>
        <div class="filter-group">
          <label>预警：</label>
          <select value={warningFilter} onInput={(e: any) => { warningFilter.value = e.target.value; setPage(1); }}>
            <option value="">全部</option>
            <option value="normal">正常</option>
            <option value="approaching">临期</option>
            <option value="overdue">逾期</option>
          </select>
        </div>
        <div class="filter-group">
          <label>异常：</label>
          <select value={exceptionFilter} onInput={(e: any) => { exceptionFilter.value = e.target.value; setPage(1); }}>
            <option value="">全部</option>
            <option value="true">有异常</option>
            <option value="false">正常</option>
          </select>
        </div>
        <div class="filter-group">
          <input
            type="text"
            placeholder="🔍 搜索单号/标题/供应商"
            style="min-width:220px"
            value={keyword}
            onInput={(e: any) => { keyword.value = e.target.value; }}
            onKeyDown={(e: any) => { if (e.key === "Enter") { setPage(1); loadData(); } }}
          />
        </div>
        <div class="filter-group">
          <label class="checkbox-label">
            <input type="checkbox" checked={onlyMine} onChange={(e: any) => { onlyMine.value = e.target.checked; setPage(1); }} />
            只看我的
          </label>
        </div>
        <button class="btn-ghost" onClick={resetFilters}>重置</button>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>单号</th>
              <th>标题 / 供应商</th>
              <th>门店 / 品类</th>
              <th>责任人</th>
              <th>优先级</th>
              <th>状态</th>
              <th>预警</th>
              <th>截止时间</th>
              <th>当前处理人</th>
              <th>异常</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colspan="11" class="loading-state">加载中...</td></tr>
            )}
            {!loading && orders.length === 0 && (
              <tr><td colspan="11" class="empty-state">暂无数据</td></tr>
            )}
            {orders.map(o => (
              <tr key={o.id} class={o.is_overdue ? "row-overdue" : ""}>
                <td>
                  <div class="cell-order-no">{o.order_no}</div>
                  <div class="cell-sub muted">v{o.version}</div>
                </td>
                <td>
                  <div class="cell-title">
                    <a href={`/orders/${o.id}`}>{o.title}</a>
                  </div>
                  <div class="cell-sub muted">🏭 {o.supplier_name}</div>
                  {o.amount && <div class="cell-sub" style="color:#065f46">💰 {o.amount}</div>}
                </td>
                <td>
                  <div>🏬 {o.store}</div>
                  {o.category && <div class="cell-sub muted">📦 {o.category}</div>}
                </td>
                <td>
                  <div>{o.creator?.full_name || "-"}</div>
                  <div class="cell-sub muted">
                    {o.creator?.role ? ROLE_LABELS[o.creator.role] : ""}
                  </div>
                </td>
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
                  {o.is_overdue && <div class="cell-sub" style="color:#ef4444">⚠️ 已逾期</div>}
                </td>
                <td>
                  <div>{o.current_handler?.full_name || "-"}</div>
                  {o.current_handler?.role && (
                    <div class="cell-sub muted">{ROLE_LABELS[o.current_handler.role]}</div>
                  )}
                </td>
                <td>
                  {o.exception_types && o.exception_types.length > 0 ? (
                    <div style="display:flex;flex-direction:column;gap:4px;min-width:160px">
                      {o.exception_types.slice(0, 3).map((et) => (
                        <span
                          key={et}
                          class="tag"
                          style={`background:${EXCEPTION_TYPE_COLORS[et] || "#be123c"}20;color:${EXCEPTION_TYPE_COLORS[et] || "#be123c"};font-size:11px;padding:2px 6px`}
                          title={o.exception_reason || EXCEPTION_TYPE_LABELS[et] || et}
                        >
                          {EXCEPTION_TYPE_LABELS[et] || et}
                        </span>
                      ))}
                      {o.exception_types.length > 3 && (
                        <span class="muted" style="font-size:11px">+{o.exception_types.length - 3} 更多</span>
                      )}
                    </div>
                  ) : (
                    <span class="muted">-</span>
                  )}
                </td>
                <td>
                  <a href={`/orders/${o.id}`} class="btn-link">查看详情</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <span class="muted">共 {total} 条</span>
        <button
          class="btn-ghost"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          上一页
        </button>
        <span>第 {page} / {totalPages} 页</span>
        <button
          class="btn-ghost"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
