<script>
  import { goto, page } from '$app/stores';
  import { orderApi } from '$lib/api';
  import { userStore, statusColors, warnColors } from '$lib/stores';
  import { onMount } from 'svelte';
  import dayjs from 'dayjs';

  let orderId = null;
  let order = null;
  let records = [];
  let exceptions = [];
  let bomRecords = [];
  let substituteRecords = [];
  let pilotRecords = [];
  let loading = true;
  let user = null;
  let activeTab = 'basic';

  $: userStore.subscribe(u => user = u);

  $: {
    if ($page && $page.params && $page.params.id) {
      orderId = parseInt($page.params.id);
    }
  }

  async function loadAll() {
    if (!orderId) return;
    loading = true;
    try {
      const [o, r, e, b, s, p] = await Promise.all([
        orderApi.detail(orderId),
        orderApi.records(orderId),
        orderApi.exceptions(orderId),
        orderApi.bomRecords(orderId),
        orderApi.substituteRecords(orderId),
        orderApi.pilotRecords(orderId),
      ]);
      order = o;
      records = r;
      exceptions = e;
      bomRecords = b;
      substituteRecords = s;
      pilotRecords = p;
    } catch (e) {
      console.error(e);
    }
    loading = false;
  }

  let showActionModal = false;
  let currentAction = '';
  let actionComment = '';
  let returnReason = '';
  let correctionReason = '';
  let actionLoading = false;

  function openAction(action) {
    currentAction = action;
    actionComment = '';
    returnReason = '';
    correctionReason = '';
    showActionModal = true;
  }

  async function doAction() {
    if (!order) return;
    actionLoading = true;
    const res = await orderApi.action(orderId, {
      action: currentAction,
      comment: actionComment,
      return_reason: returnReason,
      correction_reason: correctionReason,
      expected_version: order.version,
    });
    actionLoading = false;
    showActionModal = false;
    if (res.success) {
      loadAll();
    } else {
      alert(`操作失败：${res.message}\n错误码：${res.code || ''}`);
    }
  }

  let showEditModal = false;
  let editData = {};
  let editLoading = false;

  function openEdit() {
    if (!order) return;
    editData = {
      title: order.title,
      change_type: order.change_type,
      urgency: order.urgency,
      old_material_code: order.old_material_code,
      old_material_name: order.old_material_name,
      old_material_spec: order.old_material_spec,
      new_material_code: order.new_material_code,
      new_material_name: order.new_material_name,
      new_material_spec: order.new_material_spec,
      bom_reference: order.bom_reference,
      product_model: order.product_model,
      change_reason: order.change_reason,
      change_description: order.change_description,
      correction_reason: '',
    };
    showEditModal = true;
  }

  async function doEdit() {
    editLoading = true;
    const data = { ...editData };
    delete data.correction_reason;
    const res = await orderApi.update(orderId, data);
    editLoading = false;
    if (res.success) {
      showEditModal = false;
      loadAll();
    } else {
      alert(res.message);
    }
  }

  let showEvidenceModal = false;
  let evidenceType = '';
  let evidenceData = {};
  let evidenceLoading = false;

  function openEvidence(type) {
    evidenceType = type;
    evidenceData = {
      bom_no: '',
      bom_version: '',
      change_items: '',
      substitute_plan: '',
      substitute_result: '',
      pilot_plan: '',
      pilot_result: '',
      pilot_quantity: 0,
      pass_rate: 0,
      evidence_url: '',
      remark: '',
    };
    showEvidenceModal = true;
  }

  async function doEvidence() {
    evidenceLoading = true;
    const res = await orderApi.saveEvidence(orderId, evidenceType, evidenceData);
    evidenceLoading = false;
    if (res.success) {
      showEvidenceModal = false;
      loadAll();
    } else {
      alert(res.message);
    }
  }

  function statusColor(status) {
    return statusColors[status] || '#9ca3af';
  }

  function warnColor(warn) {
    return warnColors[warn] || '#22c55e';
  }

  function formatDate(d) {
    if (!d) return '-';
    return dayjs(d).format('YYYY-MM-DD HH:mm:ss');
  }

  function actionLabel(action) {
    if (!order) return '';
    const a = order.available_actions?.find(x => x.action === action);
    return a ? a.label : action;
  }

  const tabs = [
    { key: 'basic', label: '基本信息' },
    { key: 'process', label: '流程记录' },
    { key: 'evidence', label: '证据材料' },
    { key: 'exception', label: '异常记录' },
  ];

  onMount(() => {
    loadAll();
  });

  function goBack() {
    goto('/orders');
  }
</script>

{#if loading}
  <div class="loading">加载中...</div>
{:else if order}
  <div class="detail-page">
    <div class="detail-header card">
      <div class="header-top">
        <button class="btn btn-default btn-sm back-btn" on:click={goBack}>← 返回列表</button>
        <div class="header-actions">
          {#if order.can_edit}
            <button class="btn btn-warning btn-sm" on:click={openEdit}>补正修改</button>
          {/if}
          {#if order.can_return}
            <button class="btn btn-danger btn-sm" on:click={() => openAction('return')}>退回</button>
          {/if}
          {#each order.available_actions as action}
            {#if action.type === 'primary'}
              <button class="btn btn-{action.type} btn-sm" on:click={() => openAction(action.action)}>
                {action.label}
              </button>
            {/if}
          {/each}
        </div>
      </div>
      <div class="header-info">
        <div class="order-title">
          <h2>{order.title}</h2>
          <span class="order-no">{order.order_no}</span>
        </div>
        <div class="header-tags">
          <span class="tag status-tag" style="background: {statusColor(order.status)}20; color: {statusColor(order.status)};">
            {order.status_display}
          </span>
          <span class="tag" style="background: {warnColor(order.warn_status)}20; color: {warnColor(order.warn_status)};">
            {order.warn_status_display}
          </span>
          <span class="tag">{order.change_type_display}</span>
          <span class="tag">{order.urgency_display}</span>
          <span class="version-tag">V{order.version}</span>
        </div>
      </div>
      <div class="header-meta">
        <div class="meta-item">
          <span class="meta-label">创建人</span>
          <span class="meta-value">{order.created_by?.name || '-'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">当前处理人</span>
          <span class="meta-value">{order.current_handler?.name || '-'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">创建时间</span>
          <span class="meta-value">{formatDate(order.created_at)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">截止时间</span>
          <span class="meta-value">{formatDate(order.deadline)}</span>
        </div>
      </div>

      {#if order.return_reason}
        <div class="alert alert-warning">
          <strong>退回原因：</strong>{order.return_reason}
        </div>
      {/if}
      {#if order.correction_reason}
        <div class="alert alert-info">
          <strong>补正说明：</strong>{order.correction_reason}
        </div>
      {/if}
    </div>

    <div class="tabs card">
      {#each tabs as tab}
        <button class="tab-btn {activeTab === tab.key ? 'active' : ''}" on:click={() => activeTab = tab.key}>
          {tab.label}
          {#if tab.key === 'exception' && exceptions.length > 0}
            <span class="tab-badge">{exceptions.length}</span>
          {/if}
        </button>
      {/each}
    </div>

    {#if activeTab === 'basic'}
      <div class="tab-content card">
        <h3 class="section-title">物料信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">原物料编码</span>
            <span class="info-value">{order.old_material_code}</span>
          </div>
          <div class="info-item">
            <span class="info-label">原物料名称</span>
            <span class="info-value">{order.old_material_name}</span>
          </div>
          <div class="info-item full">
            <span class="info-label">原物料规格</span>
            <span class="info-value">{order.old_material_spec || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">新物料编码</span>
            <span class="info-value">{order.new_material_code || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">新物料名称</span>
            <span class="info-value">{order.new_material_name || '-'}</span>
          </div>
          <div class="info-item full">
            <span class="info-label">新物料规格</span>
            <span class="info-value">{order.new_material_spec || '-'}</span>
          </div>
        </div>

        <h3 class="section-title">产品信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">BOM编号</span>
            <span class="info-value">{order.bom_reference || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">产品型号</span>
            <span class="info-value">{order.product_model || '-'}</span>
          </div>
        </div>

        <h3 class="section-title">变更说明</h3>
        <div class="info-block">
          <div class="info-subtitle">变更原因</div>
          <div class="info-text">{order.change_reason || '-'}</div>
        </div>
        <div class="info-block">
          <div class="info-subtitle">变更描述</div>
          <div class="info-text">{order.change_description || '-'}</div>
        </div>

        <h3 class="section-title">证据状态</h3>
        <div class="evidence-status">
          <div class="evidence-item {order.bom_evidence_ready ? 'ready' : 'missing'}">
            <span class="evidence-icon">{order.bom_evidence_ready ? '✅' : '❌'}</span>
            <span class="evidence-label">BOM变更证据</span>
          </div>
          <div class="evidence-item {order.substitute_evidence_ready ? 'ready' : 'missing'}">
            <span class="evidence-icon">{order.substitute_evidence_ready ? '✅' : '❌'}</span>
            <span class="evidence-label">物料替代证据</span>
          </div>
          <div class="evidence-item {order.pilot_evidence_ready ? 'ready' : 'missing'}">
            <span class="evidence-icon">{order.pilot_evidence_ready ? '✅' : '❌'}</span>
            <span class="evidence-label">试产验证证据</span>
          </div>
        </div>

        {#if user && (user.role === 'material_officer' || user.role === 'quality_engineer')}
          <div class="evidence-actions">
            {#if user.role === 'material_officer'}
              <button class="btn btn-primary btn-sm" on:click={() => openEvidence('bom')}>上传BOM证据</button>
            {/if}
            {#if user.role === 'quality_engineer'}
              <button class="btn btn-primary btn-sm" on:click={() => openEvidence('substitute')}>上传替代证据</button>
              <button class="btn btn-primary btn-sm" on:click={() => openEvidence('pilot')}>上传试产证据</button>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    {#if activeTab === 'process'}
      <div class="tab-content card">
        <h3 class="section-title">处理流程</h3>
        <div class="timeline">
          {#each records as record, index}
            <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class="timeline-action">{record.action_display}</span>
                  <span class="timeline-operator">{record.operator || '系统'}</span>
                  <span class="timeline-time">{formatDate(record.created_at)}</span>
                  <span class="timeline-version">V{record.version}</span>
                </div>
                {#if record.from_status || record.to_status}
                  <div class="timeline-status">
                    {#if record.from_status}
                      <span class="tag">{record.from_status_display}</span>
                      <span class="arrow">→</span>
                    {/if}
                    <span class="tag status-tag">{record.to_status_display}</span>
                  </div>
                {/if}
                {#if record.comment}
                  <div class="timeline-comment">{record.comment}</div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if activeTab === 'evidence'}
      <div class="tab-content card">
        <h3 class="section-title">BOM变更记录</h3>
        {#if bomRecords.length > 0}
          <div class="record-list">
            {#each bomRecords as r}
              <div class="record-item">
                <div class="record-header">
                  <span class="record-title">{r.bom_no}</span>
                  <span class="record-version">版本：{r.bom_version}</span>
                  <span class="record-time">{formatDate(r.created_at)}</span>
                </div>
                <div class="record-body">
                  <p><strong>变更项：</strong>{r.change_items || '-'}</p>
                  <p><strong>确认人：</strong>{r.confirmed_by || '-'}</p>
                  <p><strong>备注：</strong>{r.remark || '-'}</p>
                  {#if r.evidence_url}
                    <p><strong>证据：</strong><a href={r.evidence_url} target="_blank">{r.evidence_url}</a></p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty">暂无BOM变更记录</div>
        {/if}

        <h3 class="section-title">物料替代记录</h3>
        {#if substituteRecords.length > 0}
          <div class="record-list">
            {#each substituteRecords as r}
              <div class="record-item">
                <div class="record-header">
                  <span class="record-title">物料替代核对</span>
                  <span class="record-time">{formatDate(r.created_at)}</span>
                </div>
                <div class="record-body">
                  <p><strong>替代方案：</strong>{r.substitute_plan || '-'}</p>
                  <p><strong>替代结果：</strong>{r.substitute_result || '-'}</p>
                  <p><strong>核对人：</strong>{r.checked_by || '-'}</p>
                  <p><strong>备注：</strong>{r.remark || '-'}</p>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty">暂无物料替代记录</div>
        {/if}

        <h3 class="section-title">试产验证记录</h3>
        {#if pilotRecords.length > 0}
          <div class="record-list">
            {#each pilotRecords as r}
              <div class="record-item">
                <div class="record-header">
                  <span class="record-title">试产验证</span>
                  <span class="record-time">{formatDate(r.created_at)}</span>
                </div>
                <div class="record-body">
                  <p><strong>试产方案：</strong>{r.pilot_plan || '-'}</p>
                  <p><strong>试产结果：</strong>{r.pilot_result || '-'}</p>
                  <p><strong>试产数量：</strong>{r.pilot_quantity} PCS</p>
                  <p><strong>良率：</strong>{r.pass_rate}%</p>
                  <p><strong>验证人：</strong>{r.verified_by || '-'}</p>
                  <p><strong>备注：</strong>{r.remark || '-'}</p>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty">暂无试产验证记录</div>
        {/if}
      </div>
    {/if}

    {#if activeTab === 'exception'}
      <div class="tab-content card">
        <h3 class="section-title">异常记录</h3>
        {#if exceptions.length > 0}
          <div class="exception-list">
            {#each exceptions as e}
              <div class="exception-item">
                <div class="exception-header">
                  <span class="exception-type">{e.exception_type}</span>
                  <span class="exception-code">{e.exception_code}</span>
                  <span class="exception-time">{formatDate(e.created_at)}</span>
                  <span class="tag {e.resolved ? 'resolved' : 'unresolved'}">
                    {e.resolved ? '已解决' : '未解决'}
                  </span>
                </div>
                <div class="exception-body">
                  <p><strong>描述：</strong>{e.description}</p>
                  <p>
                    <strong>责任人：</strong>
                    {e.responsible_user || e.responsible_role || '-'}
                  </p>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty">暂无异常记录</div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

{#if showActionModal}
  <div class="modal-mask" on:click|self={() => showActionModal = false}>
    <div class="modal-content">
      <div class="modal-header">{actionLabel(currentAction)}</div>
      <div class="modal-body">
        {#if currentAction === 'return'}
          <div class="form-group">
            <label>退回原因 *</label>
            <textarea bind:value={returnReason} rows="4" placeholder="请输入退回原因"></textarea>
          </div>
        {:else if currentAction === 'correct'}
          <p>请在补正弹窗中修改信息</p>
        {:else}
          <p>确定执行此操作吗？</p>
        {/if}
        <div class="form-group">
          <label>备注</label>
          <textarea bind:value={actionComment} rows="2"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" on:click={() => showActionModal = false}>取消</button>
        <button class="btn btn-primary" on:click={doAction} disabled={actionLoading}>
          {actionLoading ? '处理中...' : '确认'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showEditModal}
  <div class="modal-mask" on:click|self={() => showEditModal = false}>
    <div class="modal-content large">
      <div class="modal-header">补正修改</div>
      <div class="modal-body">
        <div class="form-group">
          <label>标题</label>
          <input type="text" bind:value={editData.title} />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>变更类型</label>
            <select bind:value={editData.change_type}>
              <option value="bom_change">BOM变更</option>
              <option value="material_substitute">物料替代</option>
              <option value="pilot_verify">试产验证</option>
            </select>
          </div>
          <div class="form-group">
            <label>紧急程度</label>
            <select bind:value={editData.urgency}>
              <option value="normal">正常</option>
              <option value="urgent">紧急</option>
              <option value="critical">特急</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>原物料编码</label>
            <input type="text" bind:value={editData.old_material_code} />
          </div>
          <div class="form-group">
            <label>原物料名称</label>
            <input type="text" bind:value={editData.old_material_name} />
          </div>
        </div>
        <div class="form-group">
          <label>原物料规格</label>
          <input type="text" bind:value={editData.old_material_spec} />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>新物料编码</label>
            <input type="text" bind:value={editData.new_material_code} />
          </div>
          <div class="form-group">
            <label>新物料名称</label>
            <input type="text" bind:value={editData.new_material_name} />
          </div>
        </div>
        <div class="form-group">
          <label>新物料规格</label>
          <input type="text" bind:value={editData.new_material_spec} />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>BOM编号</label>
            <input type="text" bind:value={editData.bom_reference} />
          </div>
          <div class="form-group">
            <label>产品型号</label>
            <input type="text" bind:value={editData.product_model} />
          </div>
        </div>
        <div class="form-group">
          <label>变更原因</label>
          <textarea bind:value={editData.change_reason} rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>变更描述</label>
          <textarea bind:value={editData.change_description} rows="3"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" on:click={() => showEditModal = false}>取消</button>
        <button class="btn btn-primary" on:click={doEdit} disabled={editLoading}>
          {editLoading ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showEvidenceModal}
  <div class="modal-mask" on:click|self={() => showEvidenceModal = false}>
    <div class="modal-content">
      <div class="modal-header">
        {evidenceType === 'bom' ? '上传BOM证据' : evidenceType === 'substitute' ? '上传物料替代证据' : '上传试产验证证据'}
      </div>
      <div class="modal-body">
        {#if evidenceType === 'bom'}
          <div class="form-row">
            <div class="form-group">
              <label>BOM编号</label>
              <input type="text" bind:value={evidenceData.bom_no} />
            </div>
            <div class="form-group">
              <label>BOM版本</label>
              <input type="text" bind:value={evidenceData.bom_version} />
            </div>
          </div>
          <div class="form-group">
            <label>变更项</label>
            <textarea bind:value={evidenceData.change_items} rows="3"></textarea>
          </div>
        {:else if evidenceType === 'substitute'}
          <div class="form-group">
            <label>替代方案</label>
            <textarea bind:value={evidenceData.substitute_plan} rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>替代结果</label>
            <textarea bind:value={evidenceData.substitute_result} rows="3"></textarea>
          </div>
        {:else if evidenceType === 'pilot'}
          <div class="form-group">
            <label>试产方案</label>
            <textarea bind:value={evidenceData.pilot_plan} rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>试产结果</label>
            <textarea bind:value={evidenceData.pilot_result} rows="3"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>试产数量</label>
              <input type="number" bind:value={evidenceData.pilot_quantity} />
            </div>
            <div class="form-group">
              <label>良率(%)</label>
              <input type="number" step="0.1" bind:value={evidenceData.pass_rate} />
            </div>
          </div>
        {/if}
        <div class="form-group">
          <label>证据链接</label>
          <input type="text" bind:value={evidenceData.evidence_url} placeholder="证据文件URL" />
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea bind:value={evidenceData.remark} rows="2"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" on:click={() => showEvidenceModal = false}>取消</button>
        <button class="btn btn-primary" on:click={doEvidence} disabled={evidenceLoading}>
          {evidenceLoading ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .detail-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .detail-header {
    padding: 20px;
  }
  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .back-btn {
    margin-bottom: 0;
  }
  .header-actions {
    display: flex;
    gap: 8px;
  }
  .header-info {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  .order-title {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .order-title h2 {
    font-size: 20px;
    margin: 0;
  }
  .order-no {
    font-family: monospace;
    font-size: 13px;
    color: #6b7280;
  }
  .header-tags {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .version-tag {
    background: #f3f4f6;
    color: #374151;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
  }
  .header-meta {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
  }
  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .meta-label {
    font-size: 12px;
    color: #6b7280;
  }
  .meta-value {
    font-size: 14px;
    color: #1f2937;
  }
  .alert {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 14px;
  }
  .alert-warning {
    background: #fef3c7;
    color: #92400e;
  }
  .alert-info {
    background: #dbeafe;
    color: #1e40af;
  }

  .tabs {
    display: flex;
    padding: 0;
    border-radius: 8px;
    overflow: hidden;
  }
  .tab-btn {
    flex: 1;
    padding: 12px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 14px;
    color: #6b7280;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .tab-btn.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
    background: #eff6ff;
  }
  .tab-badge {
    background: #ef4444;
    color: white;
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 11px;
  }

  .tab-content {
    padding: 20px;
  }
  .section-title {
    font-size: 16px;
    margin: 0 0 12px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }
  .info-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .info-item.full {
    grid-column: 1 / -1;
  }
  .info-label {
    font-size: 12px;
    color: #6b7280;
  }
  .info-value {
    font-size: 14px;
    color: #1f2937;
  }
  .info-block {
    margin-bottom: 16px;
  }
  .info-subtitle {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 4px;
  }
  .info-text {
    font-size: 14px;
    line-height: 1.6;
    color: #1f2937;
    background: #f9fafb;
    padding: 10px 12px;
    border-radius: 6px;
  }

  .evidence-status {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
  }
  .evidence-item {
    flex: 1;
    padding: 12px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .evidence-item.ready {
    background: #f0fdf4;
  }
  .evidence-item.missing {
    background: #fef2f2;
  }
  .evidence-icon {
    font-size: 18px;
  }
  .evidence-label {
    font-size: 14px;
  }
  .evidence-actions {
    display: flex;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
  }

  .timeline {
    position: relative;
    padding-left: 24px;
  }
  .timeline-item {
    position: relative;
    padding-bottom: 20px;
  }
  .timeline-dot {
    position: absolute;
    left: -24px;
    top: 4px;
    width: 12px;
    height: 12px;
    background: #3b82f6;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 0 0 2px #3b82f6;
  }
  .timeline-item:not(:last-child)::after {
    content: '';
    position: absolute;
    left: -18px;
    top: 16px;
    width: 2px;
    height: calc(100% - 16px);
    background: #e5e7eb;
  }
  .timeline-content {
    background: #f9fafb;
    padding: 12px;
    border-radius: 8px;
  }
  .timeline-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .timeline-action {
    font-weight: 600;
    font-size: 14px;
  }
  .timeline-operator {
    font-size: 13px;
    color: #6b7280;
  }
  .timeline-time {
    font-size: 12px;
    color: #9ca3af;
  }
  .timeline-version {
    margin-left: auto;
    font-size: 11px;
    color: #9ca3af;
    font-family: monospace;
  }
  .timeline-status {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }
  .arrow {
    color: #9ca3af;
  }
  .timeline-comment {
    font-size: 13px;
    color: #4b5563;
    line-height: 1.5;
  }

  .record-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
  }
  .record-item {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }
  .record-header {
    background: #f9fafb;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .record-title {
    font-weight: 600;
    font-size: 14px;
  }
  .record-version {
    font-size: 12px;
    color: #6b7280;
  }
  .record-time {
    margin-left: auto;
    font-size: 12px;
    color: #9ca3af;
  }
  .record-body {
    padding: 12px 14px;
    font-size: 13px;
    line-height: 1.6;
    color: #4b5563;
  }
  .record-body p {
    margin: 4px 0;
  }

  .exception-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .exception-item {
    border: 1px solid #fecaca;
    border-radius: 8px;
    overflow: hidden;
    background: #fef2f2;
  }
  .exception-header {
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: #fee2e2;
  }
  .exception-type {
    font-weight: 600;
    font-size: 14px;
    color: #991b1b;
  }
  .exception-code {
    font-size: 12px;
    color: #b91c1c;
    font-family: monospace;
  }
  .exception-time {
    font-size: 12px;
    color: #7f1d1d;
  }
  .exception-item .tag {
    margin-left: auto;
  }
  .tag.resolved {
    background: #dcfce7;
    color: #166534;
  }
  .tag.unresolved {
    background: #fecaca;
    color: #991b1b;
  }
  .exception-body {
    padding: 12px 14px;
    font-size: 13px;
    color: #7f1d1d;
    line-height: 1.6;
  }
  .exception-body p {
    margin: 4px 0;
  }

  .empty {
    text-align: center;
    padding: 30px;
    color: #9ca3af;
    font-size: 14px;
  }
  .loading {
    text-align: center;
    padding: 40px;
    color: #6b7280;
  }

  .modal-content.large {
    max-width: 700px;
  }
  .modal-body {
    padding: 0;
  }
</style>
