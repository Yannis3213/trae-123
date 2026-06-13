import { LitElement, css, html } from 'lit';
import { api } from '../api.js';
import { STATUS_MAP, formatDate, daysUntil, formatShortDate } from '../utils.js';

export class DashboardView extends LitElement {
  static properties = {
    props: { type: Object },
    stats: { type: Object },
    warnings: { type: Array },
    recent: { type: Array },
  };

  constructor() {
    super();
    this.stats = null;
    this.warnings = [];
    this.recent = [];
  }

  connectedCallback() {
    super.connectedCallback();
    this.load();
  }

  async load() {
    try {
      const [stats, warn, listResp] = await Promise.all([
        api.stats(),
        api.warnings('all'),
        api.listRecords({ page_size: 10 }),
      ]);
      this.stats = stats;
      this.warnings = warn.slice(0, 8);
      this.recent = listResp.items || [];
      if (this.props?.loadStats) this.props.loadStats();
    } catch (e) {
      if (this.props?.notify) this.props.notify('error', e.message);
    }
  }

  static styles = css`
    :host { display: block; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 20px; }
    .card { background: #fff; border-radius: 12px; padding: 16px 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #ebeef5; }
    .card .label { font-size: 12px; color: #909399; margin-bottom: 8px; }
    .card .value { font-size: 28px; font-weight: 700; color: #303133; line-height: 1; margin-bottom: 6px; }
    .card .foot { font-size: 11px; color: #b1b3b8; }
    .card.blue { border-left: 3px solid #409eff; }
    .card.blue .value { color: #409eff; }
    .card.orange { border-left: 3px solid #e6a23c; }
    .card.orange .value { color: #e6a23c; }
    .card.green { border-left: 3px solid #67c23a; }
    .card.green .value { color: #67c23a; }
    .card.red { border-left: 3px solid #f56c6c; }
    .card.red .value { color: #f56c6c; }
    .card.gray { border-left: 3px solid #909399; }
    .card.gray .value { color: #909399; }
    .card.teal { border-left: 3px solid #36cbcb; }
    .card.teal .value { color: #1f9d9d; }

    .grid-2 { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; }
    @media (max-width: 1100px) { .grid-2 { grid-template-columns: 1fr; } }
    .panel { background: #fff; border-radius: 12px; border: 1px solid #ebeef5; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; }
    .panel-head { padding: 14px 20px; border-bottom: 1px solid #ebeef5; display: flex; align-items: center; justify-content: space-between; }
    .panel-head h3 { margin: 0; font-size: 15px; color: #303133; }
    .panel-head .more { font-size: 12px; color: #409eff; cursor: pointer; }
    .panel-body { padding: 6px 0; }

    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead th { text-align: left; padding: 10px 20px; color: #909399; font-weight: 500; background: #fafbfc; border-bottom: 1px solid #ebeef5; font-size: 12px; }
    tbody td { padding: 10px 20px; border-bottom: 1px solid #f4f5f7; }
    tbody tr:hover { background: #f9fbff; cursor: pointer; }
    tbody tr:last-child td { border-bottom: none; }
    .status-chip { display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 500; }
    .row-btn { padding: 4px 10px; background: #ecf5ff; color: #409eff; border: none; border-radius: 4px; font-size: 12px; }
    .row-btn:hover { background: #d9ecff; }

    .warn-row { padding: 12px 20px; border-bottom: 1px solid #f4f5f7; display: flex; align-items: center; gap: 14px; cursor: pointer; }
    .warn-row:hover { background: #f9fbff; }
    .warn-row:last-child { border-bottom: none; }
    .warn-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; flex-shrink: 0; }
    .warn-icon.normal { background: #f0f9eb; color: #67c23a; }
    .warn-icon.near { background: #fdf6ec; color: #e6a23c; }
    .warn-icon.over { background: #fef0f0; color: #f56c6c; }
    .warn-body { flex: 1; min-width: 0; }
    .warn-title { font-size: 13px; color: #303133; font-weight: 500; margin-bottom: 3px; }
    .warn-meta { font-size: 11px; color: #909399; }
    .warn-date { font-size: 12px; font-weight: 500; }
    .warn-date.normal { color: #67c23a; }
    .warn-date.near { color: #e6a23c; }
    .warn-date.over { color: #f56c6c; }

    .quick-actions { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .qa-btn { padding: 10px 16px; background: #fff; border: 1px solid #dbe3ee; border-radius: 8px; font-size: 13px; color: #475569; cursor: pointer; transition: all 0.15s; }
    .qa-btn:hover { border-color: #409eff; color: #409eff; background: #ecf5ff; }
    .qa-btn.primary { background: #409eff; color: #fff; border-color: #409eff; }
    .qa-btn.primary:hover { background: #337ecc; border-color: #337ecc; color: #fff; }

    .empty { padding: 40px 20px; text-align: center; color: #909399; font-size: 13px; }
  `;

  _warningClass(r) {
    const days = daysUntil(r.due_date);
    if (r.overdue) return 'over';
    if (days <= 2) return 'near';
    return 'normal';
  }

  _warningDaysText(r) {
    const days = daysUntil(r.due_date);
    if (r.overdue) return `已逾期 ${Math.abs(days)} 天`;
    if (days <= 0) return '今日到期';
    if (days <= 2) return `${days}天后到期`;
    return `${days}天后到期`;
  }

  _quickActions() {
    const role = this.props?.user?.role;
    const actions = [];
    if (role === 'REGISTRAR') {
      actions.push({ label: '+ 新增照护记录', path: '/create', primary: true });
      actions.push({ label: '我的待提交', path: '/list/register' });
      actions.push({ label: '退回补正处理', path: '/list?statuses=RETURNED' });
    }
    if (role === 'AUDITOR') {
      actions.push({ label: '待我审核', path: '/list/verify', primary: true });
      actions.push({ label: '异常待复核', path: '/list?abnormal=true' });
      actions.push({ label: '缺材料清单', path: '/list?missing_evidence=true' });
    }
    if (role === 'REVIEWER') {
      actions.push({ label: '待我复核归档', path: '/list/review', primary: true });
      actions.push({ label: '逾期记录', path: '/list?overdue=true' });
      actions.push({ label: '到期预警', path: '/warnings' });
    }
    return actions;
  }

  render() {
    const s = this.stats || {};
    const role = this.props?.user?.role;
    const qa = this._quickActions();

    const cards = [
      { label: '待审核', value: s.pending_audit || 0, cls: 'orange', hint: '护士长待办理' },
      { label: '待复核归档', value: s.pending_review || 0, cls: 'blue', hint: '院区主任待办理' },
      { label: '退回补正', value: s.returned || 0, cls: 'red', hint: '需要补正后重提' },
      { label: '本月已同步', value: s.synced || 0, cls: 'green', hint: '复核归档完成' },
      { label: '逾期记录', value: s.overdue || 0, cls: 'red', hint: '超期未处理' },
      { label: '临期预警', value: s.near_due || 0, cls: 'teal', hint: '2天内到期' },
    ];
    if (role === 'REGISTRAR') {
      cards.unshift({ label: '我的草稿', value: s.pending_submit || 0, cls: 'gray', hint: '尚未提交' });
    }

    return html`
      <div class="quick-actions">
        ${qa.map(a => html`
          <button class="qa-btn ${a.primary ? 'primary' : ''}" @click=${() => this.props.navigate(a.path)}>${a.label}</button>
        `)}
      </div>

      <div class="cards">
        ${cards.map(c => html`
          <div class="card ${c.cls}">
            <div class="label">${c.label}</div>
            <div class="value">${c.value}</div>
            <div class="foot">${c.hint}</div>
          </div>
        `)}
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-head">
            <h3>最近照护记录</h3>
            <span class="more" @click=${() => this.props.navigate('/list')}>查看全部 →</span>
          </div>
          <div class="panel-body">
            ${this.recent && this.recent.length ? html`
              <table>
                <thead>
                  <tr>
                    <th>编号</th><th>老人</th><th>护理类型</th><th>状态</th><th>提交时间</th><th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.recent.map(r => {
                    const st = STATUS_MAP[r.status] || { label: r.status, color: '#999', bg: '#f4f4f5' };
                    return html`
                      <tr @click=${() => this.props.navigate(`/record/${r.id}`)}>
                        <td style="font-family:monospace;font-size:12px;color:#606266">${r.record_no}</td>
                        <td>${r.elder_name}</td>
                        <td>${r.care_type}</td>
                        <td><span class="status-chip" style="color:${st.color};background:${st.bg}">${st.label}</span></td>
                        <td style="color:#909399;font-size:12px">${formatShortDate(r.submitted_at || r.created_at)}</td>
                        <td><button class="row-btn" @click.stop=${() => this.props.navigate(`/record/${r.id}`)}>查看</button></td>
                      </tr>
                    `;
                  })}
                </tbody>
              </table>
            ` : html`<div class="empty">暂无记录</div>`}
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <h3>到期预警队列</h3>
            <span class="more" @click=${() => this.props.navigate('/warnings')}>预警总览 →</span>
          </div>
          <div class="panel-body">
            ${this.warnings && this.warnings.length ? html`
              ${this.warnings.map(r => {
                const cls = this._warningClass(r);
                const st = STATUS_MAP[r.status] || { label: r.status };
                return html`
                  <div class="warn-row" @click=${() => this.props.navigate(`/record/${r.id}`)}>
                    <div class="warn-icon ${cls}">${cls === 'over' ? '!' : cls === 'near' ? '◷' : '✓'}</div>
                    <div class="warn-body">
                      <div class="warn-title">${r.record_no} · ${r.elder_name} · ${r.care_type}</div>
                      <div class="warn-meta">
                        <span style="display:inline-block;padding:1px 8px;border-radius:8px;background:${STATUS_MAP[r.status]?.bg};color:${STATUS_MAP[r.status]?.color};font-size:11px;margin-right:8px;">${st.label}</span>
                        到期：${formatShortDate(r.due_date)}
                        ${r.missing_evidence?.length ? html`<span style="color:#f56c6c;margin-left:8px">缺${r.missing_evidence.length}项证据</span>` : ''}
                      </div>
                    </div>
                    <div class="warn-date ${cls}">${this._warningDaysText(r)}</div>
                  </div>
                `;
              })}
            ` : html`<div class="empty">暂无预警</div>`}
          </div>
        </div>
      </div>
    `;
  }
}
customElements.define('dashboard-view', DashboardView);
