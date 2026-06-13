import { LitElement, css, html } from 'lit';
import { api } from '../api.js';
import { STATUS_MAP, formatDate, formatShortDate, daysUntil } from '../utils.js';

export class WarningsView extends LitElement {
  static properties = {
    props: { type: Object },
    filter: { type: String },
    records: { type: Array },
    loading: { type: Boolean },
  };

  constructor() {
    super();
    this.filter = 'all';
    this.records = [];
    this.loading = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this.load();
  }

  async load() {
    this.loading = true;
    try {
      this.records = await api.warnings(this.filter);
    } catch (e) {
      this.props.notify?.('error', e.message);
    } finally {
      this.loading = false;
    }
  }

  static styles = css`
    :host { display: block; }
    .head { background: #fff; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; border: 1px solid #ebeef5; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .head h2 { margin: 0 0 6px; font-size: 18px; }
    .head p { margin: 0; font-size: 13px; color: #64748b; }

    .filters { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
    .f-btn { padding: 7px 16px; border-radius: 20px; border: 1px solid #e4e7ed; background: #fff; font-size: 13px; cursor: pointer; color: #606266; }
    .f-btn:hover { border-color: #409eff; color: #409eff; }
    .f-btn.active { background: #409eff; border-color: #409eff; color: #fff; }
    .f-btn .num { display: inline-block; background: rgba(0,0,0,0.08); padding: 0 8px; border-radius: 10px; margin-left: 6px; font-size: 11px; }
    .f-btn.active .num { background: rgba(255,255,255,0.25); }

    .legend { display: flex; gap: 18px; margin-top: 14px; padding-top: 14px; border-top: 1px dashed #e4e7ed; font-size: 12px; color: #606266; flex-wrap: wrap; }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .dot.normal { background: #67c23a; }
    .dot.near { background: #e6a23c; }
    .dot.over { background: #f56c6c; }

    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
    .card { background: #fff; border-radius: 12px; border: 1px solid #ebeef5; padding: 16px 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); cursor: pointer; transition: all 0.15s; border-left: 4px solid #67c23a; position: relative; overflow: hidden; }
    .card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(30, 64, 175, 0.12); }
    .card.near { border-left-color: #e6a23c; }
    .card.over { border-left-color: #f56c6c; background: linear-gradient(135deg, #fff, #fff7f7); }
    .card::after { content: ''; position: absolute; top: 0; right: 0; width: 80px; height: 80px; background: radial-gradient(circle at top right, rgba(64,158,255,0.06), transparent 70%); }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .no { font-family: monospace; font-size: 12px; color: #606266; }
    .priority { padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .priority.normal { background: #f0f9eb; color: #67c23a; }
    .priority.near { background: #fdf6ec; color: #e6a23c; }
    .priority.over { background: #fef0f0; color: #f56c6c; }
    .name { font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 10px; }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
    .chip { padding: 2px 8px; border-radius: 8px; font-size: 11px; background: #f4f5f7; color: #606266; }
    .chip.status { background: #ecf5ff; color: #409eff; }
    .chip.miss { background: #fef0f0; color: #f56c6c; }
    .chip.ab { background: #fef0f0; color: #f56c6c; }
    .card-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px dashed #f4f5f7; }
    .due { font-size: 12px; color: #64748b; }
    .due b { font-size: 14px; font-weight: 600; margin-right: 4px; }
    .due.over b { color: #f56c6c; }
    .due.near b { color: #e6a23c; }
    .view-btn { padding: 5px 12px; background: #ecf5ff; color: #409eff; border: none; border-radius: 5px; font-size: 12px; cursor: pointer; }
    .view-btn:hover { background: #d9ecff; }

    .count-banner { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 16px; }
    .count-card { padding: 16px 20px; border-radius: 12px; color: #fff; display: flex; align-items: center; gap: 14px; }
    .count-card.n { background: linear-gradient(135deg, #67c23a, #529b2e); }
    .count-card.a { background: linear-gradient(135deg, #e6a23c, #cf8a2c); }
    .count-card.o { background: linear-gradient(135deg, #f56c6c, #c45656); }
    .count-card .ic { width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; }
    .count-card .val { font-size: 26px; font-weight: 700; line-height: 1; }
    .count-card .lbl { font-size: 12px; opacity: 0.9; margin-top: 4px; }

    .empty { padding: 80px 20px; text-align: center; color: #909399; font-size: 14px; background: #fff; border-radius: 12px; border: 1px dashed #ebeef5; }

    @media (max-width: 600px) {
      .count-banner { grid-template-columns: 1fr; }
    }
  `;

  _classOf(r) {
    if (r.overdue) return 'over';
    if (daysUntil(r.due_date) <= 2) return 'near';
    return 'normal';
  }

  _count() {
    let n = 0, a = 0, o = 0;
    this.records.forEach(r => {
      const c = this._classOf(r);
      if (c === 'normal') n++;
      else if (c === 'near') a++;
      else o++;
    });
    return { n, a, o };
  }

  _dueText(r) {
    const days = daysUntil(r.due_date);
    if (r.overdue) return `已逾期 ${Math.abs(days)} 天`;
    if (days <= 0) return '今日到期';
    return `${days} 天后到期`;
  }

  render() {
    const filters = [
      { key: 'all', label: '全部预警' },
      { key: 'normal', label: '正常(>2天)' },
      { key: 'near', label: '临期(≤2天)' },
      { key: 'overdue', label: '逾期' },
    ];
    const cnt = this._count();
    const totalAll = this.records.length;

    return html`
      <div class="head">
        <h2>到期预警队列</h2>
        <p>按岗位责任人计算到期时间。正常、临期、逾期三色分明，批量逾期推进将逐条给出拦截结果。</p>
        <div class="filters">
          ${filters.map(f => html`
            <button class="f-btn ${this.filter === f.key ? 'active' : ''}" @click=${() => { this.filter = f.key; this.load(); }}>
              ${f.label}
              <span class="num">${f.key === 'all' ? totalAll : (f.key === 'normal' ? cnt.n : f.key === 'near' ? cnt.a : cnt.o)}</span>
            </button>
          `)}
          <button class="f-btn" @click=${this.load}>↻ 刷新</button>
        </div>
        <div class="legend">
          <span><i class="dot normal"></i>正常（>2天到期）</span>
          <span><i class="dot near"></i>临期（≤2天内到期）</span>
          <span><i class="dot over"></i>逾期（已超期）</span>
        </div>
      </div>

      <div class="count-banner">
        <div class="count-card n">
          <div class="ic">✓</div>
          <div><div class="val">${cnt.n}</div><div class="lbl">正常处理中</div></div>
        </div>
        <div class="count-card a">
          <div class="ic">◷</div>
          <div><div class="val">${cnt.a}</div><div class="lbl">临期预警（≤2天）</div></div>
        </div>
        <div class="count-card o">
          <div class="ic">!</div>
          <div><div class="val">${cnt.o}</div><div class="lbl">已逾期（需推进）</div></div>
        </div>
      </div>

      ${this.loading ? html`<div class="empty">加载中...</div>` : ''}
      ${!this.loading && this.records.length === 0 ? html`<div class="empty">此分类下暂无预警记录</div>` : ''}
      <div class="cards">
        ${this.records.map(r => {
          const cls = this._classOf(r);
          const st = STATUS_MAP[r.status] || { label: r.status, color: '#999', bg: '#f4f4f5' };
          return html`
            <div class="card ${cls}" @click=${() => this.props.navigate(`/record/${r.id}`)}>
              <div class="card-header">
                <span class="no">${r.record_no}</span>
                <span class="priority ${cls}">${cls === 'normal' ? '正常' : cls === 'near' ? '临期' : '逾期'}</span>
              </div>
              <div class="name">${r.elder_name} · ${r.care_type}</div>
              <div class="meta">${r.room_no}/${r.bed_no} · 登记：${r.submitter_name}</div>
              <div class="chips">
                <span class="chip status" style="color:${st.color};background:${st.bg}">${st.label}</span>
                ${r.auditor_name ? html`<span class="chip">审核：${r.auditor_name}</span>` : html`<span class="chip">待护士长</span>`}
                ${r.abnormal_reported ? html`<span class="chip ab">⚠ 异常</span>` : ''}
                ${r.missing_evidence?.length ? html`<span class="chip miss">缺${r.missing_evidence.length}项</span>` : ''}
              </div>
              <div class="card-footer">
                <div class="due ${cls}"><b>${this._dueText(r)}</b>${formatShortDate(r.due_date)}</div>
                <button class="view-btn" @click.stop=${() => this.props.navigate(`/record/${r.id}`)}>去处理 →</button>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }
}
customElements.define('warnings-view', WarningsView);
