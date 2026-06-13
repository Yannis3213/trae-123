import { LitElement, css, html } from 'lit';
import { api } from '../api.js';
import { STATUS_MAP, ROLE_MAP, formatDate, formatShortDate, daysUntil, EVIDENCE_STATE_MAP } from '../utils.js';

export default class ListView extends LitElement {
  static properties = {
    props: { type: Object },
    module: { type: String },
    filters: { type: Object },
    page: { type: Number },
    pageSize: { type: Number },
    list: { type: Array },
    total: { type: Number },
    selected: { type: Object },
    loading: { type: Boolean },
    _batchResult: { state: true, type: Object },
    _overdueResult: { state: true, type: Object },
    _validateResult: { state: true, type: Object },
  };

  constructor() {
    super();
    this.module = '';
    this.list = [];
    this.total = 0;
    this.page = 1;
    this.pageSize = 20;
    this.filters = {};
    this.selected = {};
    this.loading = false;
    this._batchResult = null;
    this._overdueResult = null;
    this._validateResult = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.load();
  }

  updated(changed) {
    if (changed.has('module')) {
      this.page = 1;
      this.selected = {};
      this.load();
    }
  }

  async load() {
    this.loading = true;
    const params = {
      page: this.page,
      page_size: this.pageSize,
      module: this.module || undefined,
      ...this.filters,
    };
    Object.keys(params).forEach(k => { if (params[k] === '' || params[k] === undefined || params[k] === null) delete params[k]; });
    try {
      const res = await api.listRecords(params);
      this.list = res.items || [];
      this.total = res.total || 0;
    } catch (e) {
      if (this.props?.notify) this.props.notify('error', e.message);
    } finally {
      this.loading = false;
    }
  }

  setFilter(key, value) {
    if (value === '' || value === null || value === undefined) {
      delete this.filters[key];
    } else {
      this.filters = { ...this.filters, [key]: value };
    }
    this.page = 1;
    this.selected = {};
    this.load();
  }

  toggleSelected(id) {
    const s = { ...this.selected };
    if (s[id]) delete s[id]; else s[id] = true;
    this.selected = s;
    this.requestUpdate();
  }

  toggleSelectAll() {
    const s = {};
    const allSelected = this.list.every(r => this.selected[r.id]);
    if (!allSelected) {
      this.list.forEach(r => { s[r.id] = true; });
    }
    this.selected = s;
    this.requestUpdate();
  }

  get selectedItems() {
    return this.list.filter(r => this.selected[r.id]);
  }

  async batchAction(action) {
    const items = this.selectedItems;
    if (items.length === 0) {
      this.props.notify('error', '请先勾选要批量处理的记录');
      return;
    }

    if (action === 'overdue_advance') {
      await this.batchOverdueAdvance(items);
      return;
    }

    const validateBody = {
      ids: items.map(r => r.id),
      action,
    };
    try {
      const v = await api.batchValidate(validateBody);
      if (v.invalid_count > 0) {
        this._validateResult = v;
        const proceed = confirm(`候选验证：${v.valid_count}条可操作，${v.invalid_count}条不符合条件。\n是否仅处理符合条件的${v.valid_count}条？`);
        if (!proceed) return;
        if (v.valid_count === 0) {
          this.props.notify('error', '选中的记录全部不符合操作条件');
          return;
        }
      }
    } catch (e) {
      this.props.notify('error', `验证失败: ${e.message}`);
      return;
    }

    const role = this.props.user.role;
    const missingMap = {};
    const passedMap = {};
    const versionMap = {};
    const validIds = this._validateResult?.valid_ids || items.map(r => r.id);
    const validItems = items.filter(r => validIds.includes(r.id));
    validItems.forEach(r => {
      versionMap[r.id] = r.version;
      missingMap[r.id] = r.missing_evidence || [];
      passedMap[r.id] = true;
    });

    let confirmed = true;
    if (action === 'audit_reject') {
      confirmed = confirm(`确认退回这 ${validItems.length} 条记录到补正环节？`);
    } else if (action === 'review_sync') {
      const hasMiss = validItems.some(r => r.missing_evidence?.length);
      confirmed = confirm(`确认将 ${validItems.length} 条记录复核归档并同步？此操作不可撤销。${hasMiss ? '\n⚠ 注意：其中包含缺证据记录，将被后端拦截' : ''}`);
    } else if (action === 'audit_pass') {
      const hasMiss = validItems.some(r => r.missing_evidence?.length);
      confirmed = confirm(`确认批量审核通过 ${validItems.length} 条记录？${hasMiss ? '\n⚠ 注意：其中包含缺证据记录，将被后端拦截' : ''}`);
    } else if (action === 'submit') {
      confirmed = confirm(`确认批量提交 ${validItems.length} 条记录？`);
    }

    if (!confirmed) return;

    this.loading = true;
    try {
      const res = await api.batch({
        ids: validItems.map(r => r.id),
        version_map: versionMap,
        action,
        remark: `批量${action} by ${this.props.user.full_name}`,
        missing_evidence: missingMap,
        passed_map: passedMap,
      });
      this._batchResult = res;
      this.props.notify(res.failed_count === 0 ? 'success' : 'info',
        `批量${action}完成：成功 ${res.success_count} 条，失败 ${res.failed_count} 条`);
      this.selected = {};
      this._validateResult = null;
      this.load();
      if (this.props.loadStats) this.props.loadStats();
    } catch (e) {
      this.props.notify('error', e.message);
    } finally {
      this.loading = false;
    }
  }

  async batchOverdueAdvance(items) {
    const overdueItems = items.filter(r => r.overdue);
    if (overdueItems.length === 0) {
      this.props.notify('error', '选中的记录中没有逾期记录');
      return;
    }
    const hasMiss = overdueItems.some(r => r.missing_evidence?.length);
    if (!confirm(`确认对 ${overdueItems.length} 条逾期记录进行批量推进？${hasMiss ? '\n⚠ 注意：其中包含缺证据记录，推进后仍需补正' : ''}`)) return;

    this.loading = true;
    try {
      const versionMap = {};
      overdueItems.forEach(r => { versionMap[r.id] = r.version; });
      const res = await api.batchAdvanceOverdue({
        ids: overdueItems.map(r => r.id),
        version_map: versionMap,
      });
      this._overdueResult = res;
      this.props.notify(res.failed_count === 0 ? 'success' : 'info',
        `逾期批量推进完成：成功 ${res.success_count} 条，失败 ${res.failed_count} 条`);
      this.selected = {};
      this.load();
      if (this.props.loadStats) this.props.loadStats();
    } catch (e) {
      this.props.notify('error', e.message);
    } finally {
      this.loading = false;
    }
  }

  _moduleTitle() {
    switch (this.module) {
      case 'register': return { title: '照护记录登记', desc: '您创建或被退回的记录，可在此编辑、补正、提交' };
      case 'verify': return { title: '过程核验', desc: '待您审核的照护记录，核对证据并给出审核意见' };
      case 'review': return { title: '复核归档', desc: '经护士长审核通过的记录，由您复核后完成归档同步' };
      default: return { title: '照护记录总览', desc: '查看全部照护记录（按权限筛选）' };
    }
  }

  _batchButtons() {
    const role = this.props.user.role;
    const btns = [];
    if (role === 'REGISTRAR' && (this.module === 'register' || this.filters.statuses === 'PENDING_SUBMIT,RETURNED' || this.filters.status === 'PENDING_SUBMIT' || this.filters.status === 'RETURNED' || !this.module)) {
      btns.push({ action: 'submit', label: '批量提交审核', cls: 'primary' });
    }
    if (role === 'AUDITOR') {
      btns.push({ action: 'audit_pass', label: '批量审核通过', cls: 'success' });
      btns.push({ action: 'audit_reject', label: '批量退回补正', cls: 'danger' });
    }
    if (role === 'REVIEWER') {
      btns.push({ action: 'review_sync', label: '批量复核归档', cls: 'primary' });
    }
    if (role === 'REVIEWER' || role === 'AUDITOR') {
      btns.push({ action: 'overdue_advance', label: '逾期批量推进', cls: 'warning' });
    }
    return btns;
  }

  static styles = css`
    :host { display: block; }
    .module-head { background: #fff; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; border: 1px solid #ebeef5; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .module-head h2 { margin: 0 0 6px; font-size: 18px; color: #1e293b; }
    .module-head p { margin: 0; font-size: 13px; color: #64748b; }
    .module-meta { display: flex; gap: 20px; margin-top: 14px; flex-wrap: wrap; }
    .meta-item { display: flex; gap: 8px; align-items: center; font-size: 13px; }
    .meta-item .num { font-size: 18px; font-weight: 700; color: #1e40af; }

    .filter-bar { background: #fff; border-radius: 12px; padding: 14px 20px; margin-bottom: 16px; border: 1px solid #ebeef5; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .filter-bar select, .filter-bar input { padding: 7px 12px; border: 1px solid #dcdfe6; border-radius: 6px; font-size: 13px; outline: none; background: #fff; font-family: inherit; }
    .filter-bar select:focus, .filter-bar input:focus { border-color: #409eff; }
    .filter-bar .lbl { font-size: 12px; color: #606266; }
    .filter-bar .sp { flex: 1; }
    .btn { padding: 7px 14px; border-radius: 6px; border: 1px solid #dcdfe6; background: #fff; font-size: 13px; cursor: pointer; }
    .btn:hover { border-color: #409eff; color: #409eff; }
    .btn.primary { background: #409eff; border-color: #409eff; color: #fff; }
    .btn.primary:hover { background: #337ecc; border-color: #337ecc; color: #fff; }
    .btn.success { background: #67c23a; border-color: #67c23a; color: #fff; }
    .btn.success:hover { background: #529b2e; border-color: #529b2e; color: #fff; }
    .btn.danger { background: #f56c6c; border-color: #f56c6c; color: #fff; }
    .btn.danger:hover { background: #c45656; border-color: #c45656; color: #fff; }
    .btn.warning { background: #e6a23c; border-color: #e6a23c; color: #fff; }
    .btn.warning:hover { background: #b88230; border-color: #b88230; color: #fff; }
    .btn + .btn { margin-left: 4px; }

    .batch-bar { background: #fff; border-radius: 12px; padding: 12px 20px; margin-bottom: 14px; border: 1px solid #e0e8f5; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; gap: 12px; align-items: center; flex-wrap: wrap; background: linear-gradient(90deg, #eff6ff, #fff); }
    .batch-bar .sel-info { font-size: 13px; color: #475569; }
    .batch-bar .sel-info b { color: #1e40af; }

    .table-wrap { background: #fff; border-radius: 12px; border: 1px solid #ebeef5; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 1100px; }
    thead th { text-align: left; padding: 12px 16px; color: #606266; font-weight: 500; background: #fafbfc; border-bottom: 1px solid #ebeef5; font-size: 12px; white-space: nowrap; }
    thead th:first-child { width: 40px; }
    tbody td { padding: 12px 16px; border-bottom: 1px solid #f4f5f7; vertical-align: middle; }
    tbody tr:hover { background: #f9fbff; }
    tbody tr.selected { background: #eff6ff; }
    tbody tr:last-child td { border-bottom: none; }
    .chk { width: 16px; height: 16px; cursor: pointer; }
    .no { font-family: monospace; font-size: 12px; color: #606266; }
    .status-chip { display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 500; white-space: nowrap; }
    .warn-chip { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
    .warn-chip.over { background: #fef0f0; color: #f56c6c; }
    .warn-chip.near { background: #fdf6ec; color: #e6a23c; }
    .miss-chip { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; background: #fef0f0; color: #f56c6c; margin-right: 4px; }
    .ev-chip { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; }
    .row-btn { padding: 5px 10px; background: #ecf5ff; color: #409eff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; }
    .row-btn:hover { background: #d9ecff; }
    .empty { padding: 80px 20px; text-align: center; color: #909399; font-size: 14px; }

    .pager { padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #ebeef5; font-size: 13px; color: #606266; }
    .pager-btns { display: flex; gap: 6px; }
    .pager-btn { padding: 5px 10px; border: 1px solid #dcdfe6; border-radius: 4px; cursor: pointer; background: #fff; font-size: 12px; }
    .pager-btn.active { background: #409eff; color: #fff; border-color: #409eff; }
    .pager-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .result-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 999; }
    .result-box { background: #fff; border-radius: 12px; width: 640px; max-width: 92vw; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; }
    .result-head { padding: 16px 24px; border-bottom: 1px solid #ebeef5; display: flex; justify-content: space-between; align-items: center; }
    .result-head h4 { margin: 0; }
    .result-body { padding: 12px 24px 16px; overflow: auto; }
    .result-item { padding: 10px 14px; border-radius: 8px; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; font-size: 13px; }
    .result-item.ok { background: #f0f9eb; color: #529b2e; }
    .result-item.fail { background: #fef0f0; color: #c45656; }
    .result-item .tag { padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .result-item.ok .tag { background: #67c23a; color: #fff; }
    .result-item.fail .tag { background: #f56c6c; color: #fff; }
    .close { cursor: pointer; background: none; border: none; font-size: 20px; color: #909399; }
  `;

  render() {
    const title = this._moduleTitle();
    const btns = this._batchButtons();
    const selCount = Object.keys(this.selected).length;
    const totalPages = Math.max(1, Math.ceil(this.total / this.pageSize));

    const statusOptions = [
      { value: '', label: '全部状态' },
      { value: 'PENDING_SUBMIT', label: '待提交' },
      { value: 'PENDING_AUDIT', label: '待审核' },
      { value: 'PENDING_REVIEW', label: '待复核' },
      { value: 'RETURNED', label: '退回补正' },
      { value: 'AUDITED_PASSED', label: '审核通过' },
      { value: 'SYNCED', label: '已同步' },
    ];

    return html`
      <div class="module-head">
        <h2>${title.title}</h2>
        <p>${title.desc}</p>
        <div class="module-meta">
          <div class="meta-item"><span>共查询到</span><span class="num">${this.total}</span><span>条</span></div>
          ${selCount ? html`<div class="meta-item" style="color:#1e40af"><span>已选择</span><span class="num">${selCount}</span><span>条</span></div>` : ''}
        </div>
      </div>

      <div class="filter-bar">
        <span class="lbl">关键字：</span>
        <input type="text" placeholder="编号/姓名/房间/床位" .value=${this.filters.keyword || ''}
               @input=${e => { this.setFilter('keyword', e.target.value); }}>
        <span class="lbl">状态：</span>
        <select .value=${this.filters.status || ''} @change=${e => this.setFilter('status', e.target.value)}>
          ${statusOptions.map(o => html`<option value=${o.value}>${o.label}</option>`)}
        </select>
        <select @change=${e => {
          if (e.target.value === 'OVERDUE') this.setFilter('overdue', 'true');
          else if (e.target.value === 'NORMAL') this.setFilter('overdue', 'false');
          else { delete this.filters.overdue; this.filters = { ...this.filters }; this.page = 1; this.load(); }
          e.target.value = '';
        }}>
          <option value="">到期筛选</option>
          <option value="OVERDUE">仅逾期</option>
          <option value="NORMAL">正常(未逾期)</option>
        </select>
        <select @change=${e => {
          if (e.target.value) this.setFilter('abnormal', e.target.value === 'AB' ? 'true' : 'false');
          else { delete this.filters.abnormal; this.filters = { ...this.filters }; this.page = 1; this.load(); }
          e.target.value = '';
        }}>
          <option value="">异常</option>
          <option value="AB">有异常上报</option>
          <option value="NO">无异常</option>
        </select>
        <select @change=${e => {
          const val = e.target.value;
          if (val) this.setFilter('evidence_state', val);
          else { delete this.filters.evidence_state; this.filters = { ...this.filters }; this.page = 1; this.load(); }
          e.target.value = '';
        }}>
          <option value="">证据状态</option>
          <option value="COMPLETE">证据齐全</option>
          <option value="MISSING">有缺失</option>
          <option value="OVERDUE_PENDING">逾期待处理</option>
          <option value="ARCHIVED">已归档</option>
        </select>
        <div class="sp"></div>
        <button class="btn" @click=${() => { this.filters = {}; this.page = 1; this.load(); }}>重置</button>
        <button class="btn" @click=${() => this.load()}>刷新</button>
        ${this.props.user.role === 'REGISTRAR' ? html`<button class="btn primary" @click=${() => this.props.navigate('/create')}>+ 新增登记</button>` : ''}
      </div>

      ${selCount > 0 && btns.length > 0 ? html`
        <div class="batch-bar">
          <span class="sel-info">已选择 <b>${selCount}</b> 条记录：</span>
          ${btns.map(b => html`<button class="btn ${b.cls}" @click=${() => this.batchAction(b.action)}>${b.label}</button>`)}
        </div>
      ` : ''}

      <div class="table-wrap">
        ${this.loading && this.list.length === 0 ? html`<div class="empty">加载中...</div>` : ''}
        ${!this.loading && this.list.length === 0 ? html`<div class="empty">暂无符合条件的记录</div>` : ''}
        ${this.list.length ? html`
          <table>
            <thead>
              <tr>
                <th>${btns.length ? html`<input type="checkbox" class="chk"
                  ?checked=${this.list.every(r => this.selected[r.id])}
                  @change=${() => this.toggleSelectAll()}>` : ''}</th>
                <th>编号</th>
                <th>老人</th>
                <th>房间/床位</th>
                <th>护理类型</th>
                <th>状态</th>
                <th>证据</th>
                <th>到期</th>
                <th>提交/处理人</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${this.list.map(r => {
                const st = STATUS_MAP[r.status] || { label: r.status, color: '#999', bg: '#f4f4f5' };
                const days = daysUntil(r.due_date);
                let warnCls = ''; let warnText = '';
                if (r.overdue) { warnCls = 'over'; warnText = `逾期${Math.abs(days)}天`; }
                else if (days <= 2 && r.status !== 'SYNCED') { warnCls = 'near'; warnText = `临期${days}天`; }
                return html`
                  <tr class="${this.selected[r.id] ? 'selected' : ''}">
                    <td>${btns.length ? html`<input type="checkbox" class="chk" ?checked=${!!this.selected[r.id]} @change=${() => this.toggleSelected(r.id)}>` : ''}</td>
                    <td class="no">${r.record_no}</td>
                    <td><b>${r.elder_name}</b></td>
                    <td>${r.room_no} / ${r.bed_no}</td>
                    <td>${r.care_type}</td>
                    <td><span class="status-chip" style="color:${st.color};background:${st.bg}">${st.label}</span>
                      ${r.abnormal_reported ? html` <span class="warn-chip over" title="异常上报">⚠异常</span>` : ''}
                      ${warnText ? html` <span class="warn-chip ${warnCls}">${warnText}</span>` : ''}
                    </td>
                    <td>${r.missing_evidence?.length ? html`<span class="miss-chip" title="${r.missing_evidence.join(', ')}">缺${r.missing_evidence.length}项</span>` : ''}
                      ${r.evidence_state ? html`<span class="ev-chip" style="color:${EVIDENCE_STATE_MAP[r.evidence_state]?.color || '#999'};background:${EVIDENCE_STATE_MAP[r.evidence_state]?.bg || '#f4f4f5'}">${EVIDENCE_STATE_MAP[r.evidence_state]?.label || r.evidence_state}</span>` : ''}</td>
                    <td style="font-size:12px;color:#606266">${formatShortDate(r.due_date)}</td>
                    <td style="font-size:12px;color:#606266">
                      <div>登记: ${r.submitter_name}</div>
                      ${r.auditor_name ? html`<div>审核: ${r.auditor_name}</div>` : ''}
                      ${r.reviewer_name ? html`<div>复核: ${r.reviewer_name}</div>` : ''}
                    </td>
                    <td><button class="row-btn" @click=${() => this.props.navigate(`/record/${r.id}`)}>查看详情</button></td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
          <div class="pager">
            <span>共 ${this.total} 条 · 第 ${this.page}/${totalPages} 页</span>
            <div class="pager-btns">
              <button class="pager-btn" ?disabled=${this.page <= 1} @click=${() => { this.page--; this.load(); }}>上一页</button>
              <button class="pager-btn active">${this.page}</button>
              <button class="pager-btn" ?disabled=${this.page >= totalPages} @click=${() => { this.page++; this.load(); }}>下一页</button>
            </div>
          </div>
        ` : ''}
      </div>

      ${this._validateResult && this._validateResult.invalid_count > 0 ? html`
        <div class="result-modal" @click=${e => { if (e.target === e.currentTarget) this._validateResult = null; }}>
          <div class="result-box">
            <div class="result-head">
              <h4>批量候选验证（可操作 ${this._validateResult.valid_count} / 不符合 ${this._validateResult.invalid_count}）</h4>
              <button class="close" @click=${() => this._validateResult = null}>×</button>
            </div>
            <div class="result-body">
              ${this._validateResult.invalid_items.map(item => html`
                <div class="result-item fail">
                  <span class="tag">不符合</span>
                  <span style="font-family:monospace">${item.record_no || 'ID' + item.id}</span>
                  <span style="flex:1"></span>
                  <span>${item.error}</span>
                </div>
              `)}
            </div>
          </div>
        </div>
      ` : ''}

      ${this._batchResult ? html`
        <div class="result-modal" @click=${e => { if (e.target === e.currentTarget) this._batchResult = null; }}>
          <div class="result-box">
            <div class="result-head">
              <h4>批量处理结果（成功 ${this._batchResult.success_count} / 失败 ${this._batchResult.failed_count}）</h4>
              <button class="close" @click=${() => this._batchResult = null}>×</button>
            </div>
            <div class="result-body">
              ${this._batchResult.results.map(r => html`
                <div class="result-item ${r.success ? 'ok' : 'fail'}">
                  <span class="tag">${r.success ? '成功' : '失败'}</span>
                  <span style="font-family:monospace">${r.record_no}</span>
                  <span style="flex:1"></span>
                  <span>${r.error_message || '处理完成'}</span>
                </div>
              `)}
            </div>
          </div>
        </div>
      ` : ''}

      ${this._overdueResult ? html`
        <div class="result-modal" @click=${e => { if (e.target === e.currentTarget) this._overdueResult = null; }}>
          <div class="result-box">
            <div class="result-head">
              <h4>逾期批量推进结果（成功 ${this._overdueResult.success_count} / 失败 ${this._overdueResult.failed_count}）</h4>
              <button class="close" @click=${() => this._overdueResult = null}>×</button>
            </div>
            <div class="result-body">
              ${this._overdueResult.results.map(r => html`
                <div class="result-item ${r.success ? 'ok' : 'fail'}">
                  <span class="tag">${r.success ? '成功' : '失败'}</span>
                  <span style="font-family:monospace">${r.record_no}</span>
                  <span style="flex:1"></span>
                  <span>${r.error_message || (r.has_missing_evidence ? `推进成功但缺证据: ${(r.missing_evidence || []).join('、')}` : '推进完成')}</span>
                  ${r.abnormal_reported ? html`<span style="color:#e6a23c;margin-left:4px">异常: ${r.abnormal_reason || ''}</span>` : ''}
                </div>
              `)}
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }
}
customElements.define('list-view', ListView);
