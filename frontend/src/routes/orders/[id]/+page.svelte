<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { api, STATUS_LABELS, WARNING_LABELS, PRIORITY_LABELS, ROLE_LABELS, EXCEPTION_LABELS, formatDate, formatShortDate } from '$lib/api.js';
  import { currentUser as userStore } from '$lib/stores';

  $: user = $userStore;
  let order = null;
  let loading = true;
  let error = '';
  let activeTab = 'info';
  let editing = false;
  let editForm = {};
  let actionLoading = false;
  let actionErrors = [];

  let submitPayload = { opinion: '', comment: '', audit_note: '', attachments: [], exception_type: '', exception_desc: '' };
  let newAttachment = { file_name: '', evidence_type: '', description: '' };

  async function load() {
    loading = true;
    error = '';
    try {
      order = await api.getAppointment($page.params.id);
      editForm = { ...order };
    } catch (e) { error = e.message; }
    loading = false;
  }

  function editable() {
    if (!user) return false;
    if (!order) return false;
    if (order.status === 'ARCHIVED') return false;
    if (user.role === 'TA' && (order.status === 'DRAFT' || order.status === 'RETURNED')) return true;
    return false;
  }

  function canSubmit() {
    return user && order && user.role === 'TA'
      && (order.status === 'DRAFT' || order.status === 'RETURNED')
      && order.owner_id === user.id;
  }
  function canProcess() {
    return user && order && user.role === 'ADMIN'
      && order.status === 'PENDING'
      && (!order.current_handler_id || order.current_handler_id === user.id);
  }
  function canReview() {
    return user && order && user.role === 'DEAN'
      && order.status === 'PENDING'
      && (!order.current_handler_id || order.current_handler_id === user.id);
  }
  function canReturn() {
    return user && order && (user.role === 'ADMIN' || user.role === 'DEAN')
      && order.status === 'PENDING';
  }

  function toggleEdit() {
    editing = !editing;
    if (editing) editForm = { ...order };
  }

  async function saveEdit() {
    try {
      const payload = { ...editForm, version: order.version };
      order = await api.updateAppointment(order.id, payload);
      editing = false;
      error = '';
    } catch (e) { error = e.message; }
  }

  function addAttachment() {
    if (!newAttachment.file_name) return;
    submitPayload.attachments.push({ ...newAttachment, file_type: 'text/plain' });
    newAttachment = { file_name: '', evidence_type: '', description: '' };
  }

  async function doAction(action) {
    actionLoading = true;
    actionErrors = [];
    error = '';
    try {
      const payload = { ...submitPayload, version: order.version };
      let res;
      if (action === 'submit') res = await api.submitAppointment(order.id, payload);
      else if (action === 'process') res = await api.processAppointment(order.id, payload);
      else if (action === 'review') res = await api.reviewAppointment(order.id, payload);
      else if (action === 'return') res = await api.returnAppointment(order.id, payload);

      if (res && res.ok === false && res.errors) {
        actionErrors = res.errors;
      } else {
        submitPayload = { opinion: '', comment: '', audit_note: '', attachments: [], exception_type: '', exception_desc: '' };
        await load();
      }
    } catch (e) { error = e.message; }
    actionLoading = false;
  }

  onMount(async () => {
    if (!user) { goto('/login'); return; }
    await load();
  });

  const evidenceTypes = [
    { value: '', label: '不指定' },
    { value: 'safety', label: '安全确认' },
    { value: 'material', label: '耗材清单' },
    { value: 'plan', label: '实验方案' },
    { value: 'other', label: '其他' }
  ];
</script>

{#if loading}
  <div class="empty-state">加载中...</div>
{:else if !order}
  <div class="alert alert-danger">{error || '预约单不存在'}</div>
  <button class="btn" on:click={() => goto('/orders')}>← 返回列表</button>
{:else}
  <div class="flex-between" style="margin-bottom: 16px;">
    <div>
      <button class="btn btn-sm" on:click={() => goto('/orders')}>← 返回列表</button>
      <span style="margin-left: 12px; font-size: 20px; font-weight: 600;">{order.title}</span>
      <code style="margin-left: 12px;">{order.order_no}</code>
    </div>
    <div class="flex-gap">
      <span class="badge badge-{order.status.toLowerCase()}">{STATUS_LABELS[order.status]}</span>
      {#if order.is_overdue}
        <span class="badge badge-overdue" title="责任人：{order.current_handler_name || order.owner_name}">⚠️ 逾期 · {order.current_handler_name || order.owner_name}</span>
      {:else}
        <span class="badge badge-{order.warning_level}">{WARNING_LABELS[order.warning_level]}</span>
      {/if}
      <span class="badge badge-prio-{order.priority.toLowerCase()}">{PRIORITY_LABELS[order.priority]}</span>
      <span class="tag" style="background:#dbeafe;color:#1e3a8a" title="后端校验使用，防止重复提交和状态冲突">🔒 版本 v{order.version}</span>
      {#if editable()}
        <button class="btn btn-primary btn-sm" on:click={toggleEdit}>{editing ? '取消编辑' : '✏️ 编辑'}</button>
      {/if}
    </div>
  </div>

  {#if error}
    <div class="alert alert-danger">{error}</div>
  {/if}

  {#if order.is_overdue && order.status !== 'ARCHIVED'}
    <div class="alert alert-danger">
      ⚠️ 该预约单已逾期（截止 {formatDate(order.deadline)}），当前责任人：<b>{order.current_handler_name || order.owner_name}</b>。
      逾期单据无法直接批量推进，需要先补正后再在详情页单独处理。
    </div>
  {/if}

  {#if order.warning_level === 'warning' && order.status !== 'ARCHIVED'}
    <div class="alert alert-warning">
      ⚠️ 该预约单临近截止（{formatDate(order.deadline)}），请尽快处理。责任人：<b>{order.current_handler_name || order.owner_name}</b>
    </div>
  {/if}

  <div class="tabs">
    <button class="tab {activeTab === 'info' ? 'active' : ''}" on:click={() => activeTab = 'info'}>📝 预约信息</button>
    <button class="tab {activeTab === 'materials' ? 'active' : ''}" on:click={() => activeTab = 'materials'}>🧪 耗材与安全</button>
    <button class="tab {activeTab === 'evidence' ? 'active' : ''}" on:click={() => activeTab = 'evidence'}>📎 证据附件</button>
    <button class="tab {activeTab === 'process' ? 'active' : ''}" on:click={() => activeTab = 'process'}>📜 处理记录</button>
    <button class="tab {activeTab === 'audit' ? 'active' : ''}" on:click={() => activeTab = 'audit'}>🔖 审计备注/异常</button>
  </div>

  {#if activeTab === 'info'}
    <div class="card">
      <div class="section-header"><h3>实验预约信息</h3></div>
      <div class="form-row">
        <div class="form-group">
          <label>预约单标题</label>
          {#if editing && editable()}
            <input type="text" bind:value={editForm.title} />
          {:else}
            <div class="field-static">{order.title}</div>
          {/if}
        </div>
        <div class="form-group">
          <label>实验名称</label>
          {#if editing && editable()}
            <input type="text" bind:value={editForm.experiment_name} />
          {:else}
            <div class="field-static">{order.experiment_name}</div>
          {/if}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>实验室</label>
          {#if editing && editable()}
            <input type="text" bind:value={editForm.experiment_room} />
          {:else}
            <div class="field-static">{order.experiment_room || '-'}</div>
          {/if}
        </div>
        <div class="form-group">
          <label>实验日期</label>
          {#if editing && editable()}
            <input type="date" bind:value={editForm.experiment_date} />
          {:else}
            <div class="field-static">{order.experiment_date ? formatShortDate(order.experiment_date) : '-'}</div>
          {/if}
        </div>
        <div class="form-group">
          <label>学生人数</label>
          {#if editing && editable()}
            <input type="number" bind:value={editForm.student_count} />
          {:else}
            <div class="field-static">{order.student_count}</div>
          {/if}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>课程名称</label>
          {#if editing && editable()}
            <input type="text" bind:value={editForm.course_name} />
          {:else}
            <div class="field-static">{order.course_name || '-'}</div>
          {/if}
        </div>
        <div class="form-group">
          <label>授课教师</label>
          {#if editing && editable()}
            <input type="text" bind:value={editForm.teacher_name} />
          {:else}
            <div class="field-static">{order.teacher_name || '-'}</div>
          {/if}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>优先级</label>
          {#if editing && editable()}
            <select bind:value={editForm.priority}>
              <option value="LOW">低</option>
              <option value="NORMAL">中</option>
              <option value="HIGH">高</option>
              <option value="URGENT">紧急</option>
            </select>
          {:else}
            <div class="field-static">{PRIORITY_LABELS[order.priority]}</div>
          {/if}
        </div>
        <div class="form-group">
          <label>截止时间</label>
          <div class="field-static">{order.deadline ? formatDate(order.deadline) : '-'}</div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>创建人(责任人)</label>
          <div class="field-static">{order.owner_name} ({ROLE_LABELS[user?.role] || '实验助教'})</div>
        </div>
        <div class="form-group">
          <label>当前处理人</label>
          <div class="field-static">{order.current_handler_name || '未指派'}</div>
        </div>
      </div>
      {#if editing && editable()}
        <div class="flex-gap" style="justify-content:flex-end">
          <button class="btn" on:click={toggleEdit}>取消</button>
          <button class="btn btn-primary" on:click={saveEdit}>保存修改</button>
        </div>
      {/if}
    </div>
  {/if}

  {#if activeTab === 'materials'}
    <div class="card">
      <div class="section-header"><h3>耗材申领</h3></div>
      <div class="form-row">
        <div class="form-group full">
          {#if editing && editable()}
            <textarea bind:value={editForm.materials_requested} placeholder="列出所需耗材和数量..." />
          {:else}
            <div class="field-static" style="min-height:100px;white-space:pre-wrap">{order.materials_requested || '（未填写）'}</div>
          {/if}
        </div>
      </div>
      <div class="section-header"><h3>安全确认</h3></div>
      <div class="form-row">
        <div class="form-group">
          <label>安全确认状态</label>
          {#if editing && editable()}
            <label class="checkbox-row">
              <input type="checkbox" bind:checked={editForm.safety_confirmed} />
              我已完成安全培训并确认实验室安全规范
            </label>
          {:else}
            <div class="field-static">
              {#if order.safety_confirmed}
                <span style="color: var(--success)">✅ 已完成安全确认</span>
              {:else}
                <span style="color: var(--danger)">❌ 未完成安全确认</span>
              {/if}
            </div>
          {/if}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group full">
          <label>安全备注</label>
          {#if editing && editable()}
            <textarea bind:value={editForm.safety_note} />
          {:else}
            <div class="field-static" style="white-space:pre-wrap">{order.safety_note || '（无）'}</div>
          {/if}
        </div>
      </div>
      {#if editing && editable()}
        <div class="flex-gap" style="justify-content:flex-end">
          <button class="btn" on:click={toggleEdit}>取消</button>
          <button class="btn btn-primary" on:click={saveEdit}>保存修改</button>
        </div>
      {/if}
    </div>
  {/if}

  {#if activeTab === 'evidence'}
    <div class="card">
      <div class="section-header"><h3>证据附件列表</h3></div>
      {#if order.attachments.length === 0}
        <div class="empty-state">暂无附件</div>
      {:else}
        <table>
          <thead>
            <tr><th>文件名</th><th>证据类型</th><th>说明</th><th>上传人</th><th>上传时间</th></tr>
          </thead>
          <tbody>
            {#each order.attachments as a}
              <tr>
                <td>📎 {a.file_name}</td>
                <td>{a.evidence_type || '-'}</td>
                <td>{a.description || '-'}</td>
                <td>{a.uploaded_by_name}</td>
                <td>{formatDate(a.uploaded_at)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {/if}

  {#if activeTab === 'process'}
    <div class="card">
      <div class="section-header"><h3>处理记录 / 操作日志（含审计备注、异常、补正动作留痕）</h3></div>
      {#if order.records.length === 0}
        <div class="empty-state">暂无处理记录</div>
      {:else}
        <div class="timeline">
          {#each order.records as r}
            <div class="timeline-item">
              <div class="time">
                {formatDate(r.created_at)} · <span class="actor">{r.actor_name}</span>
                {#if r.batch_id}
                  <span class="tag" style="margin-left:6px;background:#e0e7ff;color:#3730a3">批次 {r.batch_id}</span>
                {/if}
                {#if r.evidence_count > 0}
                  <span class="tag" style="margin-left:6px">📎 证据 {r.evidence_count}</span>
                {/if}
              </div>
              <div class="action">
                <b>{r.action}</b>:
                {STATUS_LABELS[r.from_status]} → {STATUS_LABELS[r.to_status]}
                {#if r.comment}
                  <div style="margin-top:4px;color:var(--gray-700)">💬 {r.comment}</div>
                {/if}
                {#if r.opinion}
                  <div style="margin-top:4px;color:var(--primary)">📝 处理意见：{r.opinion}</div>
                {/if}
                {#if r.audit_note}
                  <div style="margin-top:4px;color:var(--info)">🔖 审计备注：{r.audit_note}</div>
                {/if}
                {#if r.exception_type}
                  <div style="margin-top:4px;color:var(--danger)">
                    ⚠️ 异常 [{EXCEPTION_LABELS[r.exception_type] || r.exception_type}]：{r.exception_desc || r.comment}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if activeTab === 'audit'}
    <div class="card">
      <div class="section-header"><h3>审计备注</h3></div>
      {#if order.audit_notes.length === 0}
        <div class="empty-state">暂无审计备注</div>
      {:else}
        <table>
          <thead><tr><th>时间</th><th>操作人</th><th>内容</th></tr></thead>
          <tbody>
            {#each order.audit_notes as n}
              <tr>
                <td>{formatDate(n.created_at)}</td>
                <td>{n.author_name}</td>
                <td>{n.content}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
    <div class="card">
      <div class="section-header"><h3>异常原因</h3></div>
      {#if order.exceptions.length === 0}
        <div class="empty-state">暂无异常</div>
      {:else}
        <table>
          <thead><tr><th>异常类型</th><th>描述</th><th>登记人</th><th>时间</th><th>状态</th></tr></thead>
          <tbody>
            {#each order.exceptions as e}
              <tr>
                <td><span class="badge badge-returned">{EXCEPTION_LABELS[e.exception_type] || e.exception_type}</span></td>
                <td>{e.description}</td>
                <td>{e.reporter_name}</td>
                <td>{formatDate(e.created_at)}</td>
                <td>{e.resolved ? '<span style="color:var(--success)">已解决</span>' : '<span style="color:var(--danger)">待补正</span>'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {/if}

  {#if order.status !== 'ARCHIVED'}
    <div class="card">
      <div class="section-header">
        <h3>办理动作</h3>
        <span style="color:var(--gray-500);font-size:12px">
          当前角色: {ROLE_LABELS[user?.role] || '未登录'}
        </span>
      </div>

      {#if actionErrors.length > 0}
        <div class="alert alert-danger">
          复核校验未通过：
          <ul>
            {#each actionErrors as e}
              <li>【{EXCEPTION_LABELS[e.type] || e.type}】{e.msg}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="form-row">
        <div class="form-group">
          <label>处理意见 *</label>
          <textarea bind:value={submitPayload.opinion} placeholder="填写处理意见..." />
        </div>
        <div class="form-group">
          <label>审计备注 *（复核阶段必填）</label>
          <textarea bind:value={submitPayload.audit_note} placeholder="填写审计备注..." />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>退回/异常类型</label>
          <select bind:value={submitPayload.exception_type}>
            <option value="">不标记异常</option>
            <option value="MATERIAL">材料问题</option>
            <option value="PERMISSION">权限问题</option>
            <option value="TIMELIMIT">时限问题</option>
            <option value="STATUS">状态问题</option>
          </select>
        </div>
        <div class="form-group">
          <label>异常说明（退回时作为退回原因）</label>
          <input type="text" bind:value={submitPayload.exception_desc} />
        </div>
        <div class="form-group">
          <label>备注/留言</label>
          <input type="text" bind:value={submitPayload.comment} />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group full">
          <label>添加证据附件</label>
          <div class="flex-gap" style="align-items:flex-start">
            <input type="text" bind:value={newAttachment.file_name} placeholder="文件名(模拟)" style="flex:1" />
            <select bind:value={newAttachment.evidence_type} style="min-width:120px">
              {#each evidenceTypes as et}
                <option value={et.value}>{et.label}</option>
              {/each}
            </select>
            <input type="text" bind:value={newAttachment.description} placeholder="说明" style="flex:1" />
            <button class="btn btn-sm" on:click={addAttachment}>+ 添加</button>
          </div>
          {#if submitPayload.attachments.length > 0}
            <div style="margin-top:8px">
              {#each submitPayload.attachments as a, i}
                <span class="tag" style="margin-top:4px">
                  📎 {a.file_name} ({a.evidence_type || '未分类'})
                  <button on:click={() => submitPayload.attachments.splice(i, 1)} style="margin-left:6px;background:none;border:none;cursor:pointer;color:var(--danger)">✕</button>
                </span>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="flex-gap" style="justify-content:flex-end;flex-wrap:wrap">
        {#if canSubmit()}
          <button class="btn btn-primary" disabled={actionLoading} on:click={() => doAction('submit')}>
            📤 提交复核
          </button>
        {/if}
        {#if canProcess()}
          <button class="btn btn-primary" disabled={actionLoading} on:click={() => doAction('process')}>
            🔍 核验并转交复核
          </button>
          <button class="btn btn-warning" disabled={actionLoading} on:click={() => doAction('return')}>
            ↩️ 退回补正
          </button>
        {/if}
        {#if canReview()}
          <button class="btn btn-success" disabled={actionLoading || order.is_overdue} on:click={() => doAction('review')}>
            ✅ 复核归档
          </button>
          {#if order.is_overdue}
            <span style="color:var(--danger);font-size:12px;align-self:center">⚠️ 逾期单据需先补正</span>
          {/if}
          <button class="btn btn-warning" disabled={actionLoading} on:click={() => doAction('return')}>
            ↩️ 退回补正
          </button>
        {/if}
        {#if !canSubmit() && !canProcess() && !canReview() && !canReturn()}
          <span style="color:var(--gray-500)">当前角色在该状态下没有可执行的操作</span>
        {/if}
      </div>
    </div>
  {/if}
{/if}
