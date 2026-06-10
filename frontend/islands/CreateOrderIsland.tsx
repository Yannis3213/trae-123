import { useState, useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { currentUser, isLoggedIn } from "../utils/store.ts";
import { apiFetch } from "../utils/api.ts";
import {
  PRIORITY_LABELS,
  type FreshPurchaseOrder,
  type PriorityLevel,
  type FreshPurchaseOrderCreate,
} from "../utils/types.ts";

export default function CreateOrderIsland() {
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const title = useSignal("");
  const supplier_name = useSignal("");
  const store = useSignal(currentUser.value?.store || "");
  const category = useSignal("");
  const amount = useSignal("");
  const priority = useSignal<PriorityLevel>("medium");
  const deadline = useSignal("");
  const supplier_quotation = useSignal("");
  const purchase_order_content = useSignal("");
  const arrival_verification = useSignal("");
  const has_quotation_evidence = useSignal(false);
  const has_purchase_evidence = useSignal(false);
  const has_arrival_evidence = useSignal(false);
  const loading = useSignal(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  if (!isLoggedIn.value || !currentUser.value) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return <div class="loading-state">跳转中...</div>;
  }

  const user = currentUser.value;
  if (user.role !== "registrar" && user.role !== "reviewer") {
    return (
      <div class="page-container">
        <div class="alert alert-error">
          只有生鲜采购登记员或复核负责人才可以创建采购单。
          <a href="/" style="margin-left:16px">← 返回列表</a>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!title.value.trim() || !supplier_name.value.trim() || !store.value.trim() || !deadline.value) {
      setMsg({ type: "error", text: "请填写标题、供应商、门店和截止时间" });
      return;
    }
    loading.value = true;
    setMsg(null);
    try {
      const payload: FreshPurchaseOrderCreate = {
        title: title.value,
        supplier_name: supplier_name.value,
        store: store.value,
        category: category.value || undefined,
        amount: amount.value || undefined,
        priority: priority.value,
        deadline: new Date(deadline.value).toISOString(),
        supplier_quotation: supplier_quotation.value || undefined,
        purchase_order_content: purchase_order_content.value || undefined,
        arrival_verification: arrival_verification.value || undefined,
        has_quotation_evidence: has_quotation_evidence.value,
        has_purchase_evidence: has_purchase_evidence.value,
        has_arrival_evidence: has_arrival_evidence.value,
      };
      const result = await apiFetch<FreshPurchaseOrder>("/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCreatedId(result.id);
      setMsg({ type: "success", text: `采购单创建成功！单号：${result.order_no}` });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      loading.value = false;
    }
  }

  return (
    <div class="page-container">
      <div class="page-header">
        <div>
          <a href="/" class="btn-ghost" style="margin-right:8px">← 返回列表</a>
          <h2 class="page-title" style="display:inline-block;margin-left:8px">➕ 新建生鲜采购单</h2>
          <p class="page-desc">
            创建人：<b>{user.full_name}</b>（{user.store || "未分配门店"}）
          </p>
        </div>
      </div>

      {msg && (
        <div class={`alert alert-${msg.type}`}>
          {msg.text}
          {createdId && <a href={`/orders/${createdId}`} style="margin-left:16px">→ 查看详情</a>}
          <span class="close" onClick={() => setMsg(null)}>×</span>
        </div>
      )}

      <form onSubmit={handleSubmit} class="form-panel">
        <h3 class="section-title">📋 基本信息</h3>
        <div class="form-grid">
          <div class="form-group" style="grid-column: span 2">
            <label>标题 *</label>
            <input
              type="text"
              placeholder="例如：6月新鲜叶菜类批量采购"
              value={title}
              onInput={(e: any) => (title.value = e.target.value)}
            />
          </div>
          <div class="form-group">
            <label>供应商名称 *</label>
            <input
              type="text"
              placeholder="例如：绿源农产品有限公司"
              value={supplier_name}
              onInput={(e: any) => (supplier_name.value = e.target.value)}
            />
          </div>
          <div class="form-group">
            <label>门店 *</label>
            <input
              type="text"
              placeholder="例如：生鲜超市-朝阳店"
              value={store}
              onInput={(e: any) => (store.value = e.target.value)}
            />
          </div>
          <div class="form-group">
            <label>品类</label>
            <input
              type="text"
              placeholder="例如：叶菜类 / 进口水果 / 冷鲜肉品"
              value={category}
              onInput={(e: any) => (category.value = e.target.value)}
            />
          </div>
          <div class="form-group">
            <label>预估金额</label>
            <input
              type="text"
              placeholder="例如：¥8,500"
              value={amount}
              onInput={(e: any) => (amount.value = e.target.value)}
            />
          </div>
          <div class="form-group">
            <label>优先级</label>
            <select value={priority} onInput={(e: any) => (priority.value = e.target.value)}>
              <option value="low">{PRIORITY_LABELS.low}</option>
              <option value="medium">{PRIORITY_LABELS.medium}</option>
              <option value="high">{PRIORITY_LABELS.high}</option>
              <option value="urgent">{PRIORITY_LABELS.urgent}</option>
            </select>
          </div>
          <div class="form-group">
            <label>截止时间 *</label>
            <input
              type="datetime-local"
              value={deadline}
              onInput={(e: any) => (deadline.value = e.target.value)}
            />
          </div>
        </div>

        <h3 class="section-title" style="margin-top:28px">🏭 供应商报价</h3>
        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={has_quotation_evidence}
              onChange={(e: any) => (has_quotation_evidence.value = e.target.checked)}
            />
             报价材料已齐全（未勾选将无法派发处理）
          </label>
        </div>
        <div class="form-group">
          <label>报价内容</label>
          <textarea
            rows="4"
            placeholder="供应商报价详情，如：菠菜2元/斤，生菜2.5元/斤，含运费..."
            value={supplier_quotation}
            onInput={(e: any) => (supplier_quotation.value = e.target.value)}
          ></textarea>
        </div>

        <h3 class="section-title" style="margin-top:28px">📝 采购下单（可选，后续处理阶段填写）</h3>
        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={has_purchase_evidence}
              onChange={(e: any) => (has_purchase_evidence.value = e.target.checked)}
            />
             下单凭证已齐全
          </label>
        </div>
        <div class="form-group">
          <label>下单详情</label>
          <textarea
            rows="3"
            placeholder="采购下单详情，如：采购订单号、确认方式、预计发货时间..."
            value={purchase_order_content}
            onInput={(e: any) => (purchase_order_content.value = e.target.value)}
          ></textarea>
        </div>

        <h3 class="section-title" style="margin-top:28px">✅ 到货验收（可选，处理完成时填写）</h3>
        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={has_arrival_evidence}
              onChange={(e: any) => (has_arrival_evidence.value = e.target.checked)}
            />
             验收凭证已齐全
          </label>
        </div>
        <div class="form-group">
          <label>验收详情</label>
          <textarea
            rows="3"
            placeholder="到货验收情况，如：全部货物合格入库、数量准确、质量达标..."
            value={arrival_verification}
            onInput={(e: any) => (arrival_verification.value = e.target.value)}
          ></textarea>
        </div>

        <div style="margin-top:24px;text-align:right">
          <button type="reset" class="btn-ghost" style="margin-right:8px">重置</button>
          <button type="submit" class="btn-primary" disabled={loading.value}>
            {loading.value ? "创建中..." : "💾 创建采购单"}
          </button>
        </div>
      </form>
    </div>
  );
}
