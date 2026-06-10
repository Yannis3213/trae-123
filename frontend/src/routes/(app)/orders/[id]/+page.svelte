<script>
  import { goto, page } from '$app/stores';
  import { orderApi } from '$lib/api';
  import { userStore, statusColors, warnColors } from '$lib/stores';
  import { onMount, onDestroy } from 'svelte';
  import dayjs from 'dayjs';

  let orderId = null;
  let order = null;
  let records = [];
  let exceptions = [];
  let bomRecords = [];
  let substituteRecords = [];
  let pilotRecords = [];
  let loading = true;
  let errorMsg = '';
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
    errorMsg = '';
    try {
      const results = await Promise.allSettled([
        orderApi.detail(orderId),
        orderApi.records(orderId),
        orderApi.exceptions(orderId),
        orderApi.bomRecords(orderId),
        orderApi.substituteRecords(orderId),
        orderApi.pilotRecords(orderId),
      ]);

      const [detailRes, recordsRes, exceptionsRes, bomRes, subRes, pilotRes] = results;

      if (detailRes.status === 'fulfilled' && !detailRes.value.error) {
        order = detailRes.value;
      } else {
        errorMsg = detailRes.value?.error || '加载详情失败';
      }

      records = recordsRes.status === 'fulfilled' && Array.isArray(recordsRes.value) ? recordsRes.value : [];
      exceptions = exceptionsRes.status === 'fulfilled' && Array.isArray(exceptionsRes.value) ? exceptionsRes.value : [];
      bomRecords = bomRes.status === 'fulfilled' && Array.isArray(bomRes.value) ? bomRes.value : [];
      substituteRecords = subRes.status === 'fulfilled' && Array.isArray(subRes.value) ? subRes.value : [];
      pilotRecords = pilotRes.status === 'fulfilled' && Array.isArray(pilotRes.value) ? pilotRes.value : [];
    } catch (e) {
      console.error('加载失败', e);
      errorMsg = '网络错误，请检查后端服务';
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
    if (currentAction === 'return' && !returnReason) {
      alert('请填写退回原因');
      return;
    }
    actionLoading = true;
    try {
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
        let msg = res.message;
        if (res.code === 'VERSION_CONFLICT') {
          msg += '\n\n请刷新页面后重试';
        } else if (res.code === 'MISSING_EVIDENCE') {
          msg += '\n\n请先上传对应的证据材料';
        } else if (res.code === 'PERMISSION_DENIED') {
          msg += '\n\n请确认您的角色和当前处理人是否正确';
        }
        alert(msg);
        if (res.code === 'VERSION_CONFLICT') {
          loadAll();
        }
      }
    } catch (e) {
      actionLoading = false;
      alert('操作失败：' + e.message);
    }
  }

  let showEditModal = false;
  let editData = {};
  let editLoading = false;

  function openEdit() {
    if (!order) return;
    editData = {
      title: order.title || '',
      change_type: order.change_type || 'bom_change',
      urgency: order.urgency || 'normal',
      old_material_code: order.old_material_code || '',
      old_material_name: order.old_material_name || '',
      old_material_spec: order.old_material_spec || '',
      new_material_code: order.new_material_code || '',
      new_material_name: order.new_material_name || '',
      new_material_spec: order.new_material_spec || '',
      bom_reference: order.bom_reference || '',
      product_model: order.product_model || '',
      change_reason: order.change_reason || '',
      change_description: order.change_description || '',
      correction_reason: '',
    };
    showEditModal = true;
  }

  async function doEdit() {
    if (!editData.correction_reason) {
      alert('请填写补正原因');
      return;
    }
    editLoading = true;
    try {
      const data = { ...editData };
      delete data.correction_reason;
      const res = await orderApi.action(orderId, {
        action: 'correct',
        correction_reason: editData.correction_reason,
        expected_version: order.version,
        ...data,
      });
      editLoading = false;
      if (res.success) {
        showEditModal = false;
        loadAll();
      } else {
        let msg = res.message;
        if (res.code === 'VERSION_CONFLICT') {
          msg += '\n\n版本已变更，即将刷新页面';
        } else if (res.code === 'PERMISSION_DENIED') {
          msg += '\n\n请确认您的角色和处理人是否正确';
        }
        alert(msg);
        if (res.code === 'VERSION_CONFLICT') {
          loadAll();
        }
      }
    } catch (e) {
      editLoading = false;
      alert('保存失败：' + e.message);
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
    try {
      const res = await orderApi.saveEvidence(orderId, evidenceType, evidenceData);
      evidenceLoading = false;
      if (res.success) {
        showEvidenceModal = false;
        loadAll();
      } else {
        alert(res.message);
      }
    } catch (e) {
      evidenceLoading = false;
      alert('保存失败：' + e.message);
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

  function isMyTurn() {
    if (!order || !user) return false;
    if (order.current_handler && order.current_handler.id === user.id) return true;
    return false;
  }

  const tabs = [
    { key: 'basic', label: '基本信息' },
    { key: 'evidence', label: '证据材料' },
    { key: 'process', label: '处理记录' },
    { key: 'exception', label: '异常记录' },
  ];

  let detailRefreshTimer = null;
  function handleDetailVisibility() {
    if (!document.hidden) {
      loadAll();
    }
  }

  onMount(() => {
    loadAll();
    detailRefreshTimer = setInterval(loadAll, 30000);
    document.addEventListener('visibilitychange', handleDetailVisibility);
  });

  onDestroy(() => {
    if (detailRefreshTimer) clearInterval(detailRefreshTimer);
    document.removeEventListener('visibilitychange', handleDetailVisibility);
  });

  function goBack() {
    goto('/orders');
  }
</script>

{#if loading}
  <div class="loading">加载中...</div>
{:else if errorMsg}
  <div class="error-card card">
    <p>{errorMsg}</p>
    <button class="btn btn-primary btn-sm" on:click={goBack}>返回列表</button>
  </div>
{:else if order}
  <div class="detail-page">
    <div class="page-header detail-page-header">
      <div style="display: flex; align-items: center; gap: 12px;">
        <button class="btn btn-default btn-sm" on:click={goBack}>← 返回</button>
        <h2 style="margin: 0; font-size: 18px;">
          {order ? order.order_no : '加载中...'} - 物料变更单详情
        </h2>
      </div>
    </div>
    <div class="detail-header card">
      <div class="header-top">
        <div class="header-actions">
          {#if order.can_edit}
            <button class="btn btn-warning btn-sm" on:click={openEdit}>补正修改</button>
          {/if}
          {#if order.can_return}
            <button class="btn btn-danger btn-sm" on:click={() => openAction('return')}>退回</button>
          {/if}
          {#each order.available_actions as action}
            {#if action.action !== 'correct'}
              <button class="btn btn-{action.type} btn-sm" on:click={() => openAction(action.action)}>
                {action.label}
              </button>
            {/if}
          {/each}
        </div>
      </div>

      {#if isMyTurn()}
        <div class="my-turn-banner">
          <span class="icon">👉</span>
          <span>当前轮到您处理，请及时办理</span>
        </div>
      {:else if order.current_handler}
        <div class="handler-banner">
          <span class="icon">👤</span>
          <span>当前处理人：<strong>{order.current_handler.name}</strong>（{order.current_handler.role_display}）</span>
          {#if order.current_handler.id !== user?.id}
            <span class="tip">请等待处理人办理，或联系其确认</span>
          {/if}
        </div>
      {/if}

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
          <span class="meta-label">提交时间</span>
          <span class="meta-value">{formatDate(order.submit_time)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">截止时间</span>
          <span class="meta-value" style="color: {warnColor(order.warn_status)};">{formatDate(order.deadline)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">最近更新</span>
          <span class="meta-value">{formatDate(order.updated_at)}</span>
        </div>
      </div>

      {#if order.return_reason}
        <div class="alert alert-warning">
          <strong>⚠️ 退回原因：</strong>{order.return_reason}
        </div>
      {/if}
      {#if order.correction_reason}
        <div class="alert alert-info">
          <strong>📝 补正说明：</strong>{order.correction_reason}
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
          {#if tab.key === 'evidence' && (bomRecords.length + substituteRecords.length + pilotRecords.length) > 0}
            <span class="tab-badge blue">{bomRecords.length + substituteRecords.length + pilotRecords.length}</span>
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
            <div class="evidence-info">
              <span class="evidence-label">BOM变更证据</span>
              <span class="evidence-status-text">{order.bom_evidence_ready ? '已上传' : '未上传'}</span>
            </div>
          </div>
          <div class="evidence-item {order.substitute_evidence_ready ? 'ready' : 'missing'}">
            <span class="evidence-icon">{order.substitute_evidence_ready ? '✅' : '❌'}</span>
            <div class="evidence-info">
              <span class="evidence-label">物料替代证据</span>
              <span class="evidence-status-text">{order.substitute_evidence_ready ? '已上传' : '未上传'}</span>
            </div>
          </div>
          <div class="evidence-item {order.pilot_evidence_ready ? 'ready' : 'missing'}">
            <span class="evidence-icon">{order.pilot_evidence_ready ? '✅' : '❌'}</span>
            <div class="evidence-info">
              <span class="evidence-label">试产验证证据</span>
              <span class="evidence-status-text">{order.pilot_evidence_ready ? '已上传' : '未上传'}</span>
            </div>
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

    {#if activeTab === 'evidence'}
      <div class="tab-content card">
        <h3 class="section-title">BOM变更记录 ({bomRecords.length})</h3>
        {#if bomRecords.length > 0}
          <div class="record-list">
            {#each bomRecords as r}
              <div class="record-item">
                <div class="record-header">
                  <span class="record-title">{r.bom_no}</span>
                  {#if r.bom_version}<span class="record-version">版本：{r.bom_version}</span>{/if}
                  <span class="record-time">{formatDate(r.created_at)}</span>
                </div>
                <div class="record-body">
                  {#if r.change_items}<p><strong>变更项：</strong>{r.change_items}</p>{/if}
                  {#if r.confirmed_by}<p><strong>确认人：</strong>{r.confirmed_by}</p>{/if}
                  {#if r.confirmed_at}<p><strong>确认时间：</strong>{formatDate(r.confirmed_at)}</p>{/if}
                  {#if r.evidence_url}<p><strong>证据：</strong><a href={r.evidence_url} target="_blank">{r.evidence_url}</a></p>{/if}
                  {#if r.remark}<p><strong>备注：</strong>{r.remark}</p>{/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty">暂无BOM变更记录</div>
        {/if}

        <h3 class="section-title">物料替代记录 ({substituteRecords.length})</h3>
        {#if substituteRecords.length > 0}
          <div class="record-list">
            {#each substituteRecords as r}
              <div class="record-item">
                <div class="record-header">
                  <span class="record-title">物料替代核对</span>
                  <span class="record-time">{formatDate(r.created_at)}</span>
                </div>
                <div class="record-body">
                  {#if r.substitute_plan}<p><strong>替代方案：</strong>{r.substitute_plan}</p>{/if}
                  {#if r.substitute_result}<p><strong>替代结果：</strong>{r.substitute_result}</p>{/if}
                  {#if r.checked_by}<p><strong>核对人：</strong>{r.checked_by}</p>{/if}
                  {#if r.checked_at}<p><strong>核对时间：</strong>{formatDate(r.checked_at)}</p>{/if}
                  {#if r.evidence_url}<p><strong>证据：</strong><a href={r.evidence_url} target="_blank">{r.evidence_url}</a></p>{/if}
                  {#if r.remark}<p><strong>备注：</strong>{r.remark}</p>{/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty">暂无物料替代记录</div>
        {/if}

        <h3 class="section-title">试产验证记录 ({pilotRecords.length})</h3>
        {#if pilotRecords.length > 0}
          <div class="record-list">
            {#each pilotRecords as r}
              <div class="record-item">
                <div class="record-header">
                  <span class="record-title">试产验证</span>
                  <span class="record-time">{formatDate(r.created_at)}</span>
                </div>
                <div class="record-body">
                  {#if r.pilot_plan}<p><strong>试产方案：</strong>{r.pilot_plan}</p>{/if}
                  {#if r.pilot_result}<p><strong>试产结果：</strong>{r.pilot_result}</p>{/if}
                  <p><strong>试产数量：</strong>{r.pilot_quantity} PCS</p>
                  <p><strong>良率：</strong><span class="tag pass-rate">{r.pass_rate}%</span></p>
                  {#if r.verified_by}<p><strong>验证人：</strong>{r.verified_by}</p>{/if}
                  {#if r.verified_at}<p><strong>验证时间：</strong>{formatDate(r.verified_at)}</p>{/if}
                  {#if r.evidence_url}<p><strong>证据：</strong><a href={r.evidence_url} target="_blank">{r.evidence_url}</a></p>{/if}
                  {#if r.remark}<p><strong>备注：</strong>{r.remark}</p>{/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty">暂无试产验证记录</div>
        {/if}
      </div>
    {/if}

    {#if activeTab === 'process'}
      <div class="tab-content card">
        <h3 class="section-title">处理流程 ({records.length})</h3>
        {#if records.length > 0}
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
                        <span class="tag" style="background: {statusColor(record.from_status)}20; color: {statusColor(record.from_status)};">
                          {record.from_status_display}
                        </span>
                        <span class="arrow">→</span>
                      {/if}
                      <span class="tag status-tag" style="background: {statusColor(record.to_status)}20; color: {statusColor(record.to_status)};">
                        {record.to_status_display}
                      </span>
                    </div>
                  {/if}
                  {#if record.comment}
                    <div class="timeline-comment">{record.comment}</div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty">暂无处理记录</div>
        {/if}
      </div>
    {/if}

    {#if activeTab === 'exception'}
      <div class="tab-content card">
        <h3 class="section-title">异常记录 ({exceptions.length})</h3>
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
                    {e.responsible_user || e.responsible_role || '未指定'}
                    {#if e.responsible_user}
                      <span class="role-tag">（{e.responsible_role || ''}）</span>
                    {/if}
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
            <textarea bind:value={returnReason} rows="4" placeholder="请详细说明退回原因，以便登记员补正"></textarea>
          </div>
        {:else}
          <p>确定执行「{actionLabel(currentAction)}」操作吗？</p>
          {#if order && currentAction === 'confirm_bom' && !order.bom_evidence_ready}
            <div class="alert alert-warning">
              ⚠️ BOM证据未上传，操作可能会被拒绝。建议先上传证据后再提交。
            </div>
          {/if}
          {#if order && currentAction === 'check_substitute' && !order.substitute_evidence_ready}
            <div class="alert alert-warning">
              ⚠️ 物料替代证据未上传，操作可能会被拒绝。
            </div>
          {/if}
          {#if order && currentAction === 'verify_pilot' && !order.pilot_evidence_ready}
            <div class="alert alert-warning">
              ⚠️ 试产验证证据未上传，操作可能会被拒绝。
            </div>
          {/if}
        {/if}
        <div class="form-group">
          <label>备注</label>
          <textarea bind:value={actionComment} rows="2"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" on:click={() => showActionModal = false}>取消</button>
        <button class="btn btn-primary" on:click={doAction} disabled={actionLoading || (currentAction === 'return' && !returnReason)}>
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
          <label>补正原因 *</label>
          <textarea bind:value={editData.correction_reason} rows="3" placeholder="请说明补正的原因"></textarea>
        </div>
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
        <button class="btn btn-primary" on:click={doEdit} disabled={editLoading || !editData.correction_reason}>
          {editLoading ? '保存中...' : '保存补正'}
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
              <label>BOM编号 *</label>
              <input type="text" bind:value={evidenceData.bom_no} />
            </div>
            <div class="form-group">
              <label>BOM版本</label>
              <input type="text" bind:value={evidenceData.bom_version} />
            </div>
          </div>
          <div class="form-group">
            <label>变更项 *</label>
            <textarea bind:value={evidenceData.change_items} rows="3" placeholder="请列出具体的变更项"></textarea>
          </div>
        {:else if evidenceType === 'substitute'}
          <div class="form-group">
            <label>替代方案 *</label>
            <textarea bind:value={evidenceData.substitute_plan} rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>替代结果 *</label>
            <textarea bind:value={evidenceData.substitute_result} rows="3"></textarea>
          </div>
        {:else if evidenceType === 'pilot'}
          <div class="form-group">
            <label>试产方案 *</label>
            <textarea bind:value={evidenceData.pilot_plan} rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>试产结果 *</label>
            <textarea bind:value={evidenceData.pilot_result} rows="3"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>试产数量 *</label>
              <input type="number" bind:value={evidenceData.pilot_quantity} />
            </div>
            <div class="form-group">
              <label>良率(%) *</label>
              <input type="number" step="0.1" bind:value={evidenceData.pass_rate} />
            </div>
          </div>
        {/if}
        <div class="form-group">
          <label>证据链接</label>
          <input type="text" bind:value={evidenceData.evidence_url} placeholder="证据文件的URL地址" />
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea bind:value={evidenceData.remark} rows="2"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" on:click={() => showEvidenceModal = false}>取消</button>
        <button class="btn btn-primary" on:click={doEvidence} disabled={evidenceLoading}>
          {evidenceLoading ? '保存中...' : '保存证据'}
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
  .page-header {
    margin-bottom: 4px;
  }
  .page-header h2 {
    margin: 0;
    font-size: 18px;
    color: #1f2937;
  }
  .detail-page-header {
    background: white;
    padding: 14px 20px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .error-card {
    text-align: center;
    padding: 40px;
  }
  .error-card p {
    color: #ef4444;
    margin-bottom: 16px;
  }
  .detail-header {
    padding: 20px;
  }
  .header-top {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
  }
  .header-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .my-turn-banner {
    background: #dcfce7;
    border: 1px solid #86efac;
    color: #166534;
    padding: 10px 14px;
    border-radius: 6px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
  .handler-banner {
    background: #fef3c7;
    border: 1px solid #fcd34d;
    color: #92400e;
    padding: 10px 14px;
    border-radius: 6px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    flex-wrap: wrap;
  }
  .handler-banner .tip {
    margin-left: auto;
    font-size: 12px;
    color: #b45309;
  }
  .header-info {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 12px;
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
    flex-wrap: wrap;
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
    grid-template-columns: repeat(3, 1fr);
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
    border: 1px solid #fcd34d;
  }
  .alert-info {
    background: #dbeafe;
    color: #1e40af;
    border: 1px solid #93c5fd;
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
    cursor: pointer;
    transition: all 0.2s;
  }
  .tab-btn:hover {
    background: #f9fafb;
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
  .tab-badge.blue {
    background: #3b82f6;
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
    white-space: pre-wrap;
  }

  .evidence-status {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }
  .evidence-item {
    flex: 1;
    padding: 12px 16px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .evidence-item.ready {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
  }
  .evidence-item.missing {
    background: #fef2f2;
    border: 1px solid #fecaca;
  }
  .evidence-icon {
    font-size: 18px;
  }
  .evidence-info {
    display: flex;
    justify-content: space-between;
    flex: 1;
  }
  .evidence-label {
    font-size: 14px;
    font-weight: 500;
  }
  .evidence-status-text {
    font-size: 13px;
    color: #6b7280;
  }
  .evidence-actions {
    display: flex;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
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
    flex-wrap: wrap;
  }
  .record-title {
    font-weight: 600;
    font-size: 14px;
  }
  .record-version {
    font-size: 12px;
    color: #6b7280;
    background: #e5e7eb;
    padding: 2px 6px;
    border-radius: 4px;
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
  .pass-rate {
    background: #dcfce7;
    color: #166534;
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
    background: white;
    padding: 8px 10px;
    border-radius: 4px;
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
    flex-wrap: wrap;
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
    background: #fecaca;
    padding: 2px 6px;
    border-radius: 4px;
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
  .role-tag {
    color: #991b1b;
    font-size: 12px;
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
  .modal-body p {
    margin-bottom: 12px;
    font-size: 14px;
  }
</style>
