import { LitElement, css, html } from 'lit';
import { api } from '../api.js';
import { STATUS_MAP, ROLE_MAP, formatDate, formatShortDate, daysUntil } from '../utils.js';

export class DetailView extends LitElement {
  static properties = {
    props: { type: Object },
    recordId: { type: Number },
    record: { type: Object },
    loading: { type: Boolean },
    activeTab: { type: String },
    form: { type: Object },
    editMode: { type: Boolean },
    processing: { type: Boolean },
  };

  constructor() {
    super();
    this.record = null;
    this.loading = false;
    this.activeTab = 'base';
    this.form = {};
    this.editMode = false;
    this.processing = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this.load();
  }

  updated(changed) {
    if (changed.has('recordId')) this.load();
  }

  async load() {
    if (!this.recordId) return;
    this.loading = true;
    try {
      this.record = await api.getRecord(this.recordId);
    } catch (e) {
      this.props.notify?.('error', e.message);
    } finally {
      this.loading = false;
    }
  }

  get canEdit() {
    if (!this.record) return false;
    const isOwner = this.record.submitter_id === this.props.user.id;
    const isReg = this.props.user.role === 'REGISTRAR';
    return isReg && isOwner && ['PENDING_SUBMIT', 'RETURNED'].includes(this.record.status);
  }
  get canSubmit() {
    if (!this.record) return false;
    const isOwner = this.record.submitter_id === this.props.user.id;
    const isReg = this.props.user.role === 'REGISTRAR';
    return isReg && isOwner && ['PENDING_SUBMIT', 'RETURNED'].includes(this.record.status);
  }
  get canAudit() {
    return this.props.user.role === 'AUDITOR' && this.record?.status === 'PENDING_AUDIT';
  }
  get canReview() {
    return this.props.user.role === 'REVIEWER' && ['PENDING_REVIEW', 'AUDITED_PASSED'].includes(this.record?.status || '');
  }

  async startEdit() {
    const r = this.record;
    this.form = {
      care_content: r.care_content,
      medication_detail: Array.isArray(r.medication_detail) ? [...r.medication_detail] : [],
      vital_signs: { ...(r.vital_signs || {}) },
      vital_signs_corrected: !!r.vital_signs_corrected,
      abnormal_reported: !!r.abnormal_reported,
      abnormal_review_result: r.abnormal_review_result || '',
      abnormal_reason: r.abnormal_reason || '',
      evidence_provided: [...(r.evidence_provided || [])],
      correction_note: '',
    };
    this.editMode = true;
  }

  setForm(k, v) { this.form = { ...this.form, [k]: v }; }
  setMed(i, k, v) {
    const rows = [...this.form.medication_detail];
    rows[i] = { ...rows[i], [k]: v };
    this.setForm('medication_detail', rows);
  }
  addMed() {
    const rows = [...this.form.medication_detail, { name: '', dose: '', time: '08:00', operator: this.props.user.full_name }];
    this.setForm('medication_detail', rows);
  }
  delMed(i) {
    this.setForm('medication_detail', this.form.medication_detail.filter((_, idx) => idx !== i));
  }
  setVital(k, v) {
    this.setForm('vital_signs', { ...this.form.vital_signs, [k]: v });
  }
  toggleProvided(ev) {
    const v = ev.target.dataset.value;
    const cur = [...this.form.evidence_provided];
    const i = cur.indexOf(v);
    if (i >= 0) cur.splice(i, 1); else cur.push(v);
    this.setForm('evidence_provided', cur);
  }

  async saveEdit() {
    if (!this.form.care_content) { this.props.notify('error', '请填写照护内容'); return; }
    this.processing = true;
    try {
      const r = this.record;
      const payload = {
        care_content: this.form.care_content,
        medication_detail: this.form.medication_detail.filter(m => m.name),
        medication_issued: this.form.medication_detail.some(m => m.name),
        vital_signs: this.form.vital_signs,
        vital_signs_corrected: this.form.vital_signs_corrected,
        abnormal_reported: this.form.abnormal_reported,
        abnormal_review_result: this.form.abnormal_review_result,
        abnormal_reason: this.form.abnormal_reason,
        evidence_provided: this.form.evidence_provided,
      };
      const upd = r.status === 'RETURNED'
        ? await api.correctRecord(r.id, { ...payload, correction_note: this.form.correction_note || '补正后提交', version: r.version })
        : await api.updateRecord(r.id, payload);
      this.props.notify('success', r.status === 'RETURNED' ? '补正已提交至审核' : '已保存');
      this.editMode = false;
      this.load();
      if (this.props.loadStats) this.props.loadStats();
    } catch (e) {
      this.props.notify('error', e.message);
    } finally { this.processing = false; }
  }

  async submitRecord() {
    const r = this.record;
    if (!confirm(`确认提交记录 ${r.record_no} 至护士长审核？`)) return;
    this.processing = true;
    try {
      const res = await api.submitRecord(r.id, { version: r.version, evidence_provided: r.evidence_provided || [] });
      this.props.notify('success', res.message + (res.missing_evidence?.length ? `（提示：缺失${res.missing_evidence.length}项证据）` : ''));
      this.load();
      if (this.props.loadStats) this.props.loadStats();
    } catch (e) {
      this.props.notify('error', e.message);
    } finally { this.processing = false; }
  }

  async auditRecord(passed) {
    const r = this.record;
    const sh = this.shadowRoot;
    const remark = sh.getElementById('audit-remark')?.value || '';
    const abReason = sh.getElementById('audit-abnormal')?.value || '';
    const missing = (r.evidence_required || []).filter(e => !(r.evidence_provided || []).includes(e));
    if (!passed && !remark && !missing.length) {
      if (!confirm('退回请填写退回理由，是否继续？')) return;
    }
    this.processing = true;
    try {
      const payload = {
        version: r.version, passed, remark,
        missing_evidence: missing,
        abnormal_reason: abReason,
      };
      const res = await api.auditRecord(r.id, payload);
      this.props.notify('success', passed ? '审核通过，已流转至复核环节' : '已退回补正');
      this.load();
      if (this.props.loadStats) this.props.loadStats();
    } catch (e) {
      this.props.notify('error', e.message);
    } finally { this.processing = false; }
  }

  async reviewRecord() {
    const r = this.record;
    const sh = this.shadowRoot;
    const remark = sh.getElementById('review-remark')?.value || '';
    if (r.missing_evidence?.length) {
      if (!confirm(`该记录仍缺失${r.missing_evidence.length}项证据，确认强制归档？可能被后端拦截。`)) return;
    } else {
      if (!confirm(`确认复核归档并同步记录 ${r.record_no}？`)) return;
    }
    this.processing = true;
    try {
      const res = await api.reviewRecord(r.id, { version: r.version, remark });
      this.props.notify('success', '复核归档完成，状态已同步');
      this.load();
      if (this.props.loadStats) this.props.loadStats();
    } catch (e) {
      this.props.notify('error', e.message);
    } finally { this.processing = false; }
  }

  async advanceOverdue() {
    try {
      await api.advanceOverdue(this.record.id);
      this.props.notify('info', '逾期推进提醒已发送');
      this.load();
    } catch (e) { this.props.notify('error', e.message); }
  }

  static styles = css`
    :host { display: block; }
    .top-card { background: #fff; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; border: 1px solid #ebeef5; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .top-row { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
    .top-left h2 { margin: 0 0 6px; font-size: 20px; color: #1e293b; }
    .top-left .no { font-family: monospace; color: #606266; font-size: 13px; margin-bottom: 10px; }
    .meta-tags { display: flex; flex-wrap: wrap; gap: 8px; }
    .tag { padding: 4px 10px; border-radius: 10px; font-size: 12px; background: #f5f7fa; color: #606266; }
    .tag.status { font-weight: 500; }
    .tag.overdue { background: #fef0f0; color: #f56c6c; }
    .tag.near { background: #fdf6ec; color: #e6a23c; }
    .tag.ab { background: #fef0f0; color: #f56c6c; }
    .tag.miss { background: #fef0f0; color: #f56c6c; }

    .action-bar { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn { padding: 8px 16px; border-radius: 6px; border: 1px solid #dcdfe6; background: #fff; font-size: 13px; cursor: pointer; }
    .btn:hover:not(:disabled) { border-color: #409eff; color: #409eff; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn.primary { background: linear-gradient(90deg, #1e40af, #3b82f6); color: #fff; border-color: #3b82f6; }
    .btn.primary:hover:not(:disabled) { filter: brightness(1.05); color: #fff; }
    .btn.success { background: #67c23a; color: #fff; border-color: #67c23a; }
    .btn.success:hover:not(:disabled) { background: #529b2e; color: #fff; }
    .btn.danger { background: #f56c6c; color: #fff; border-color: #f56c6c; }
    .btn.danger:hover:not(:disabled) { background: #c45656; color: #fff; }

    .body { display: grid; grid-template-columns: 220px 1fr; gap: 16px; }
    @media (max-width: 1000px) { .body { grid-template-columns: 1fr; } }
    .tabs { background: #fff; border-radius: 12px; border: 1px solid #ebeef5; padding: 10px 8px; height: fit-content; }
    .tab { padding: 10px 14px; border-radius: 8px; font-size: 13px; cursor: pointer; color: #606266; margin-bottom: 2px; }
    .tab:hover { background: #f5f7fa; }
    .tab.active { background: #ecf5ff; color: #409eff; font-weight: 500; }

    .panel { background: #fff; border-radius: 12px; border: 1px solid #ebeef5; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .panel h3 { margin: 0 0 14px; font-size: 15px; color: #303133; padding-bottom: 10px; border-bottom: 1px solid #f4f5f7; }
    .row-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px 20px; }
    @media (max-width: 900px) { .row-grid { grid-template-columns: repeat(2, 1fr); } }
    .kv { font-size: 13px; }
    .kv .k { color: #909399; margin-bottom: 4px; }
    .kv .v { color: #303133; font-weight: 500; word-break: break-all; }
    .kv.full { grid-column: 1 / -1; }
    .long-text { padding: 12px 14px; background: #fafbfc; border-radius: 8px; font-size: 13px; line-height: 1.7; white-space: pre-wrap; }

    .med-table, .timeline, .notes-list { width: 100%; border-collapse: collapse; font-size: 13px; }
    .med-table th, .med-table td { padding: 8px 12px; border-bottom: 1px solid #f4f5f7; text-align: left; }
    .med-table th { background: #fafbfc; font-weight: 500; color: #606266; font-size: 12px; }
    .med-table td input { width: 100%; padding: 5px 8px; border: 1px solid #ebeef5; border-radius: 4px; font-size: 13px; }

    .vital-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
    .vital-item { padding: 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #ebeef5; }
    .vital-item .k { font-size: 11px; color: #909399; margin-bottom: 4px; }
    .vital-item .v { font-size: 15px; font-weight: 600; color: #1e40af; }
    .vital-item input { width: 100%; padding: 4px 8px; border: 1px solid #ebeef5; border-radius: 4px; font-size: 14px; font-weight: 600; }

    .timeline { border-spacing: 0 10px; border-collapse: separate; }
    .timeline td { padding: 0; vertical-align: top; }
    .tl-line { position: relative; padding-right: 14px; width: 60px; }
    .tl-line::before { content: ''; position: absolute; left: 18px; top: 0; bottom: -14px; width: 2px; background: #e4e7ed; }
    .tl-line::after { content: ''; position: absolute; left: 11px; top: 3px; width: 16px; height: 16px; border-radius: 50%; background: #409eff; box-shadow: 0 0 0 4px #ecf5ff; }
    .tl-line.fail::after { background: #f56c6c; box-shadow: 0 0 0 4px #fef0f0; }
    .tl-line.warn::after { background: #e6a23c; box-shadow: 0 0 0 4px #fdf6ec; }
    .tl-line.ok::after { background: #67c23a; box-shadow: 0 0 0 4px #f0f9eb; }
    .tl-card { padding: 12px 14px; background: #fafbfc; border-radius: 8px; border: 1px solid #ebeef5; margin-bottom: 4px; }
    .tl-card .head { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; color: #909399; }
    .tl-card .action { font-weight: 600; color: #409eff; }
    .tl-card .role { padding: 1px 8px; background: #ecf5ff; color: #409eff; border-radius: 10px; font-size: 11px; }
    .tl-card .cont { font-size: 13px; color: #303133; line-height: 1.6; }
    .tl-card.err { background: #fef0f0; border-color: #fbc4c4; }
    .tl-card.err .cont { color: #c45656; }

    .chip { display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 12px; margin: 2px 4px 2px 0; cursor: pointer; }
    .chip.req { background: #f4f4f5; color: #606266; border: 1px dashed #c0c4cc; }
    .chip.provided { background: #f0f9eb; color: #67c23a; border: 1px solid #c2e7b0; }
    .chip.missing { background: #fef0f0; color: #f56c6c; border: 1px solid #fbc4c4; }

    .note-item { padding: 12px 14px; background: #fafbfc; border-radius: 8px; border-left: 3px solid #409eff; margin-bottom: 8px; }
    .note-item.type-missing_evidence { border-left-color: #f56c6c; background: #fef0f0; }
    .note-item.type-abnormal { border-left-color: #e6a23c; background: #fdf6ec; }
    .note-item.type-overdue { border-left-color: #f56c6c; background: #fef0f0; }
    .note-item.type-due_warning { border-left-color: #e6a23c; background: #fdf6ec; }
    .note-item.head { font-size: 12px; color: #909399; margin-bottom: 6px; display: flex; justify-content: space-between; }
    .note-item .type-label { padding: 1px 8px; background: #ecf5ff; color: #409eff; border-radius: 10px; font-size: 11px; }
    .note-item .cont { font-size: 13px; color: #303133; line-height: 1.6; }

    textarea.form { width: 100%; padding: 8px 10px; border: 1px solid #dcdfe6; border-radius: 6px; font-size: 13px; font-family: inherit; min-height: 80px; outline: none; resize: vertical; box-sizing: border-box; }
    textarea.form:focus { border-color: #409eff; }
    .form-row { margin-bottom: 14px; }
    .form-row label { font-size: 12px; color: #606266; margin-bottom: 5px; display: block; font-weight: 500; }

    .review-panel, .audit-panel { padding: 16px; background: linear-gradient(135deg, #eff6ff, #fff); border-radius: 10px; border: 1px solid #bfdbfe; margin-top: 16px; }
    .review-panel h4, .audit-panel h4 { margin: 0 0 12px; color: #1e40af; }
    .audit-btns { display: flex; gap: 10px; margin-top: 12px; }
    .edit-marker { display: inline-block; padding: 2px 8px; background: #f56c6c; color: #fff; font-size: 11px; border-radius: 10px; margin-left: 6px; }
    .abnormal-box { padding: 12px 14px; background: #fdf6ec; border-left: 3px solid #e6a23c; border-radius: 4px; font-size: 13px; line-height: 1.7; margin-top: 10px; }
    .abnormal-box .t { font-weight: 600; color: #b88230; margin-bottom: 4px; }

    .back { display: inline-block; padding: 4px 12px; color: #909399; font-size: 13px; cursor: pointer; margin-bottom: 12px; border-radius: 6px; }
    .back:hover { background: #fff; color: #409eff; }

    .loader { padding: 60px 20px; text-align: center; color: #909399; }
  `;

  _renderBase() {
    const r = this.record;
    const st = STATUS_MAP[r.status] || { label: r.status, color: '#999', bg: '#f4f4f5' };
    const days = daysUntil(r.due_date);
    const warnCls = r.overdue ? 'overdue' : (days <= 2 && r.status !== 'SYNCED' ? 'near' : '');
    const warnText = r.overdue ? `逾期${Math.abs(days)}天` : (days <= 2 && r.status !== 'SYNCED' ? `${days}天后到期` : '');

    return html`
      <h3>基本信息</h3>
      <div class="row-grid">
        <div class="kv"><div class="k">记录编号</div><div class="v" style="font-family:monospace">${r.record_no}</div></div>
        <div class="kv"><div class="k">老人姓名</div><div class="v">${r.elder_name}</div></div>
        <div class="kv"><div class="k">身份证号</div><div class="v">${r.elder_id_card || '-'}</div></div>
        <div class="kv"><div class="k">房间/床位</div><div class="v">${r.room_no} / ${r.bed_no}</div></div>
        <div class="kv"><div class="k">护理类型</div><div class="v">${r.care_type}</div></div>
        <div class="kv"><div class="k">记录时间</div><div class="v">${formatDate(r.record_date)}</div></div>
        <div class="kv"><div class="k">到期时间</div><div class="v" style="${r.overdue ? 'color:#f56c6c;font-weight:600' : (days <= 2 ? 'color:#e6a23c' : '')}">${formatDate(r.due_date)} ${warnText ? `(${warnText})` : ''}</div></div>
        <div class="kv"><div class="k">当前版本</div><div class="v">v${r.version} ${r.vital_signs_corrected ? html`<span class="edit-marker">生命体征已补正</span>` : ''}</div></div>
        <div class="kv full"><div class="k">照护内容</div>
          ${this.editMode ? html`
            <div class="form-row" style="margin-top:6px">
              <textarea class="form" .value=${this.form.care_content} @input=${e => this.setForm('care_content', e.target.value)}></textarea>
            </div>
          ` : html`<div class="long-text">${r.care_content}</div>`}
        </div>
      </div>

      ${r.abnormal_reported && !this.editMode ? html`
        <div class="abnormal-box">
          <div class="t">⚠ 异常上报</div>
          <div><b>异常原因：</b>${r.abnormal_reason || '（未填）'}</div>
          <div><b>复核结果：</b>${r.abnormal_review_result || '（待复核）'}</div>
        </div>
      ` : ''}

      ${this.editMode ? html`
        <div style="margin-top:18px">
          <h3>异常上报（若有）</h3>
          <div class="row-grid" style="margin-bottom:10px">
            <div class="kv full" style="display:flex;align-items:center;gap:10px">
              <label style="display:flex;align-items:center;gap:6px;font-size:13px">
                <input type="checkbox" ?checked=${this.form.abnormal_reported} @change=${e => this.setForm('abnormal_reported', e.target.checked)}>
                是否存在异常情况
              </label>
            </div>
          </div>
          ${this.form.abnormal_reported ? html`
            <div class="form-row">
              <label>异常原因</label>
              <textarea class="form" .value=${this.form.abnormal_reason} @input=${e => this.setForm('abnormal_reason', e.target.value)}></textarea>
            </div>
            <div class="form-row">
              <label>异常复核结果</label>
              <textarea class="form" .value=${this.form.abnormal_review_result} @input=${e => this.setForm('abnormal_review_result', e.target.value)}></textarea>
            </div>
          ` : ''}
        </div>
      ` : ''}
    `;
  }

  _renderMedication() {
    const r = this.record;
    const meds = this.editMode ? this.form.medication_detail : (Array.isArray(r.medication_detail) ? r.medication_detail : []);
    return html`
      <h3>药品发放记录 ${r.medication_issued ? html`<span style="color:#67c23a;font-size:12px;font-weight:400">（已发放）</span>` : html`<span style="color:#909399;font-size:12px;font-weight:400">（无）</span>`}</h3>
      ${meds.length || this.editMode ? html`
        <table class="med-table">
          <thead><tr><th style="width:30%">药品名称</th><th style="width:20%">剂量</th><th style="width:20%">发放时间</th><th>发放人</th>${this.editMode ? html`<th style="width:70px">操作</th>` : ''}</tr></thead>
          <tbody>
            ${meds.map((m, i) => html`
              <tr>
                ${this.editMode ? html`
                  <td><input placeholder="药品名称" .value=${m.name || ''} @input=${e => this.setMed(i, 'name', e.target.value)}></td>
                  <td><input placeholder="剂量" .value=${m.dose || ''} @input=${e => this.setMed(i, 'dose', e.target.value)}></td>
                  <td><input placeholder="时间" .value=${m.time || ''} @input=${e => this.setMed(i, 'time', e.target.value)}></td>
                  <td><input placeholder="发放人" .value=${m.operator || ''} @input=${e => this.setMed(i, 'operator', e.target.value)}></td>
                  <td><button class="btn danger" style="padding:3px 10px;font-size:12px" @click=${() => this.delMed(i)}>删除</button></td>
                ` : html`
                  <td>${m.name}</td><td>${m.dose}</td><td>${m.time}</td><td>${m.operator}</td>
                `}
              </tr>
            `)}
            ${meds.length === 0 && !this.editMode ? html`<tr><td colspan="4" style="text-align:center;padding:20px;color:#909399">暂无药品发放记录</td></tr>` : ''}
          </tbody>
        </table>
        ${this.editMode ? html`<div style="margin-top:10px"><button class="btn" @click=${this.addMed}>+ 新增药品</button></div>` : ''}
      ` : html`<div style="padding:16px;background:#fafbfc;border-radius:8px;color:#909399;font-size:13px">本次照护无药品发放记录。</div>`}
    `;
  }

  _renderVitals() {
    const r = this.record;
    const vitals = this.editMode ? this.form.vital_signs : (r.vital_signs || {});
    const keys = ['血压', '心率', '体温', '血氧', '血糖', '呼吸'];
    const allKeys = [...new Set([...keys, ...Object.keys(vitals)])];
    return html`
      <h3>生命体征 ${r.vital_signs_corrected ? html`<span class="edit-marker">已补正</span>` : ''}</h3>
      <div class="vital-list">
        ${allKeys.map(k => {
          const v = vitals[k] || '';
          return html`
            <div class="vital-item">
              <div class="k">${k}</div>
              ${this.editMode ? html`
                <input .value=${v} @input=${e => { if (!this.form.vital_signs_corrected && v && e.target.value && v !== e.target.value) this.setForm('vital_signs_corrected', true); this.setVital(k, e.target.value); }} placeholder="-">
              ` : html`
                <div class="v">${v || '-'}</div>
              `}
            </div>
          `;
        })}
      </div>
    `;
  }

  _renderEvidence() {
    const r = this.record;
    const req = r.evidence_required || [];
    const prov = this.editMode ? this.form.evidence_provided : (r.evidence_provided || []);
    const miss = r.missing_evidence || [];
    return html`
      <h3>证据材料清单</h3>
      ${req.length ? html`
        <div style="margin-bottom:14px">
          ${req.map(e => {
            const isProv = prov.includes(e);
            const isMiss = miss.includes(e);
            const cls = isProv ? 'provided' : (isMiss ? 'missing' : 'req');
            return html`
              <label class="chip ${cls}" @click=${this.editMode ? (e) => { e.preventDefault(); const event = { target: { dataset: { value: e.currentTarget.querySelector('input')?.dataset.value || '' } } }; } : () => {}}>
                ${this.editMode ? html`<input type="checkbox" style="display:none" data-value=${e} ?checked=${isProv} @change=${this.toggleProvided}>` : ''}
                ${isProv ? '✓ ' : (isMiss ? '✗ ' : '○ ')}${e}
                ${isMiss ? '（缺失）' : ''}
              </label>
            `;
          })}
        </div>
        ${(r.attachments || []).length ? html`
          <div class="med-table" style="border:1px solid #ebeef5;border-radius:8px;overflow:hidden">
            <table>
              <thead><tr><th style="width:50%">附件名称</th><th>证据类型</th><th>上传人</th><th>上传时间</th></tr></thead>
              <tbody>
                ${r.attachments.map(a => html`<tr><td>${a.file_name}</td><td>${a.evidence_type || '-'}</td><td>${r.submitter_name}</td><td>${formatDate(a.uploaded_at)}</td></tr>`)}
              </tbody>
            </table>
          </div>
        ` : ''}
        ${miss.length ? html`
          <div class="abnormal-box" style="margin-top:12px;background:#fef0f0;border-left-color:#f56c6c">
            <div class="t" style="color:#c45656">缺失证据提示</div>
            <div>当前缺少：${miss.join('、')}${this.canAudit ? '（审核通过可标记；或退回补正）' : (this.canEdit ? '（请在编辑模式上传/勾选后补正）' : '')}</div>
          </div>
        ` : ''}
      ` : html`<div style="color:#909399;font-size:13px;padding:14px;background:#fafbfc;border-radius:8px">该记录未设置必选证据。</div>`}
    `;
  }

  _renderProcess() {
    const records = (this.record.process_records || []).slice().reverse();
    const ACTION_LABEL = {
      CREATE: '创建', UPDATE: '编辑', SUBMIT: '提交审核', SUBMIT_FAIL: '提交失败',
      AUDIT_PASS: '审核通过', AUDIT_REJECT: '审核退回', AUDIT_FAIL: '审核失败',
      REVIEW_SYNC: '复核归档', REVIEW_FAIL: '复核失败',
      CORRECT: '补正后重提', MEDICATION_ISSUE: '药品发放新增',
      VITAL_SIGNS_CORRECT: '生命体征补正', EVIDENCE_WARNING: '证据缺失提示',
      ABNORMAL_REPORT: '异常上报', BATCH_SUBMIT: '批量提交', BATCH_AUDIT_PASS: '批量审核通过',
      BATCH_AUDIT_REJECT: '批量退回', BATCH_REVIEW: '批量复核归档',
      OVERDUE_ADVANCE: '逾期推进',
    };
    return html`
      <h3>处理记录 / 流转过程（共 ${records.length} 条）</h3>
      ${records.length ? html`
        <table class="timeline">
          <tbody>
            ${records.map(p => {
              const isFail = p.result === 'fail' || p.action.includes('FAIL');
              const isWarn = p.action.includes('WARN') || p.action.includes('REJECT') || p.action === 'ABNORMAL_REPORT' || p.action === 'CORRECT';
              const isOk = p.action.includes('PASS') || p.action.includes('SYNC') || p.action.includes('SUBMIT') || p.action === 'CREATE' || p.action.includes('ISSUE') || p.action.includes('CORRECT_') || p.action.includes('ADVANCE');
              const tlCls = isFail ? 'fail' : (isWarn ? 'warn' : (isOk ? 'ok' : ''));
              return html`
                <tr>
                  <td class="tl-line ${tlCls}"></td>
                  <td>
                    <div class="tl-card ${isFail ? 'err' : ''}">
                      <div class="head">
                        <span>
                          <span class="action">${ACTION_LABEL[p.action] || p.action}</span>
                          ${p.from_status || p.to_status ? html`<span style="margin:0 6px">${STATUS_MAP[p.from_status]?.label || p.from_status} → ${STATUS_MAP[p.to_status]?.label || p.to_status}</span>` : ''}
                          <span class="role" style="margin-left:6px">${ROLE_MAP[p.operator_role]?.label || p.operator_role}</span>
                          ${p.operator_name ? html` · ${p.operator_name}` : ''}
                        </span>
                        <span>${formatDate(p.created_at)} · v${p.version_snapshot}</span>
                      </div>
                      <div class="cont">${p.remark || '（无备注）'}</div>
                      ${isFail && p.error_message ? html`<div class="cont" style="color:#c45656;margin-top:4px">❌ ${p.error_message}</div>` : ''}
                    </div>
                  </td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      ` : html`<div class="long-text" style="color:#909399">暂无处理记录</div>`}
    `;
  }

  _renderNotes() {
    const notes = (this.record.audit_notes || []).slice().reverse();
    const TYPE_LABEL = {
      general: '通用备注', missing_evidence: '缺证据标记', abnormal: '异常记录',
      abnormal_reason: '异常原因', overdue: '逾期标记', due_warning: '到期预警',
      overdue_advance: '逾期推进',
    };
    return html`
      <h3>审计备注（共 ${notes.length} 条）</h3>
      ${notes.length ? html`
        <div class="notes-list">
          ${notes.map(n => html`
            <div class="note-item type-${n.note_type}">
              <div class="note-item head">
                <span><span class="type-label">${TYPE_LABEL[n.note_type] || n.note_type}</span> · ${n.operator_name}</span>
                <span>${formatDate(n.created_at)}</span>
              </div>
              <div class="cont">${n.content}</div>
            </div>
          `)}
        </div>
      ` : html`<div class="long-text" style="color:#909399">暂无审计备注</div>`}

      ${(this.record.correction_history || []).length ? html`
        <h3 style="margin-top:24px">补正历史（共 ${this.record.correction_history.length} 次）</h3>
        ${this.record.correction_history.map((c, i) => html`
          <div class="note-item" style="border-left-color:#e6a23c;background:#fdf6ec">
            <div class="note-item head">
              <span><span class="type-label" style="background:#fef6e4;color:#b88230">补正 #${i + 1}</span> · ${c.operator}</span>
              <span>${formatDate(c.time)}</span>
            </div>
            <div class="cont"><b>说明：</b>${c.note || '（无）'}<br><b>涉及字段：</b>${(c.fields || []).join('、') || '（未记录）'}</div>
          </div>
        `)}
      ` : ''}
    `;
  }

  _renderAuditPanel() {
    return html`
      <div class="audit-panel">
        <h4>✓ 审核办理（照护审核主管：${this.props.user.full_name}）</h4>
        <div class="form-row">
          <label>审核意见</label>
          <textarea class="form" id="audit-remark" placeholder="请填写审核意见（退回必填）"></textarea>
        </div>
        <div class="form-row">
          <label>异常原因补充（如有）</label>
          <textarea class="form" id="audit-abnormal" placeholder="异常相关说明"></textarea>
        </div>
        <div style="font-size:12px;color:#909399;margin-bottom:6px">
          ⚠ 缺失证据将自动标记：${(this.record.missing_evidence || []).length ? html`<span style="color:#f56c6c">${this.record.missing_evidence.join('、')}</span>` : '无'}
        </div>
        <div class="audit-btns">
          <button class="btn success" ?disabled=${this.processing} @click=${() => this.auditRecord(true)}>审核通过 → 送复核</button>
          <button class="btn danger" ?disabled=${this.processing} @click=${() => this.auditRecord(false)}>退回补正</button>
        </div>
      </div>
    `;
  }

  _renderReviewPanel() {
    const miss = this.record.missing_evidence || [];
    return html`
      <div class="review-panel">
        <h4>★ 复核归档（养老护理院复核负责人：${this.props.user.full_name}）</h4>
        <div style="font-size:13px;line-height:1.8;margin-bottom:10px">
          ${!this.record.auditor_id ? html`<div style="color:#f56c6c"><b>⚠ 规则校验：</b>护士长尚未处理，点击复核按钮将被后端拦截</div>` : ''}
          ${miss.length ? html`<div style="color:#f56c6c"><b>⚠ 缺材料：</b>${miss.join('、')}（继续将被拦截，将继续留在待处理列表）</div>` : ''}
          ${this.record.overdue ? html`<div style="color:#e6a23c"><b>⚠ 逾期记录：</b>归档后将标记已同步，逾期标记保留</div>` : ''}
          ${!this.record.auditor_id || miss.length ? '' : html`<div style="color:#67c23a">✓ 前置条件满足，可正常复核归档同步</div>`}
        </div>
        <div class="form-row">
          <label>复核归档备注</label>
          <textarea class="form" id="review-remark" placeholder="请填写复核归档意见"></textarea>
        </div>
        <div class="audit-btns">
          <button class="btn primary" ?disabled=${this.processing} @click=${this.reviewRecord}>确认复核归档同步</button>
          ${this.record.overdue ? html`<button class="btn" @click=${this.advanceOverdue}>发送逾期推进</button>` : ''}
        </div>
      </div>
    `;
  }

  _renderEditActions() {
    const isReturned = this.record.status === 'RETURNED';
    return html`
      <div style="margin-top:18px;padding:16px;background:linear-gradient(135deg,#fdf6ec,#fff);border:1px solid #f5dab1;border-radius:10px">
        <h4 style="margin:0 0 10px;color:#b88230">${isReturned ? '✎ 补正模式（退回后重提至待审核）' : '✎ 编辑模式'}</h4>
        ${isReturned ? html`
          <div class="form-row">
            <label>补正说明</label>
            <textarea class="form" .value=${this.form.correction_note} @input=${e => this.setForm('correction_note', e.target.value)} placeholder="请简要说明补正了哪些内容"></textarea>
          </div>
        ` : ''}
        <div class="audit-btns">
          <button class="btn" ?disabled=${this.processing} @click=${() => { this.editMode = false; }}>取消编辑</button>
          <button class="btn primary" ?disabled=${this.processing} @click=${this.saveEdit}>${isReturned ? '保存并重新提交审核' : '保存修改'}</button>
        </div>
      </div>
    `;
  }

  render() {
    if (this.loading && !this.record) return html`<div class="loader">加载中...</div>`;
    if (!this.record) return html`<div class="loader">记录不存在或无权限</div>`;

    const r = this.record;
    const st = STATUS_MAP[r.status] || { label: r.status, color: '#999', bg: '#f4f4f5' };
    const days = daysUntil(r.due_date);
    const warnCls = r.overdue ? 'overdue' : (days <= 2 && r.status !== 'SYNCED' ? 'near' : '');
    const warnText = r.overdue ? `逾期${Math.abs(days)}天` : (days <= 2 && r.status !== 'SYNCED' ? `临期${days}天` : '');

    const tabs = [
      { key: 'base', label: '基础信息' },
      { key: 'med', label: '药品发放' },
      { key: 'vitals', label: '生命体征' },
      { key: 'ev', label: `证据材料${r.missing_evidence?.length ? ` · ${r.missing_evidence.length}缺` : ''}` },
      { key: 'flow', label: `处理记录(${r.process_records?.length || 0})` },
      { key: 'notes', label: '审计/补正' },
    ];

    return html`
      <div class="back" @click=${() => history.length > 1 ? history.back() : this.props.navigate('/dashboard')}>← 返回列表/工作台</div>

      <div class="top-card">
        <div class="top-row">
          <div class="top-left">
            <h2>${r.elder_name} · ${r.care_type}</h2>
            <div class="no">记录编号：${r.record_no} · 创建于 ${formatDate(r.created_at)}</div>
            <div class="meta-tags">
              <span class="tag status" style="color:${st.color};background:${st.bg}">${st.label}</span>
              <span class="tag">${r.room_no} / ${r.bed_no}</span>
              <span class="tag">登记：${r.submitter_name}</span>
              ${r.auditor_name ? html`<span class="tag">审核：${r.auditor_name}</span>` : ''}
              ${r.reviewer_name ? html`<span class="tag">复核：${r.reviewer_name}</span>` : ''}
              <span class="tag">v${r.version}</span>
              ${warnText ? html`<span class="tag ${warnCls}">${warnText}</span>` : ''}
              ${r.abnormal_reported ? html`<span class="tag ab">异常上报</span>` : ''}
              ${r.missing_evidence?.length ? html`<span class="tag miss">缺${r.missing_evidence.length}项证据</span>` : ''}
              ${r.vital_signs_corrected ? html`<span class="tag" style="background:#fdf6ec;color:#e6a23c">体征已补正</span>` : ''}
              ${r.medication_issued ? html`<span class="tag" style="background:#ecf5ff;color:#409eff">药品已发放</span>` : ''}
            </div>
          </div>
          <div class="action-bar">
            ${this.canEdit && !this.editMode ? html`<button class="btn" @click=${this.startEdit}>✎ 编辑${r.status === 'RETURNED' ? '/补正' : ''}</button>` : ''}
            ${this.canSubmit && !this.editMode ? html`<button class="btn primary" ?disabled=${this.processing} @click=${this.submitRecord}>提交审核</button>` : ''}
            <button class="btn" @click=${this.load}>↻ 刷新</button>
          </div>
        </div>
      </div>

      <div class="body">
        <div class="tabs">
          ${tabs.map(t => html`
            <div class="tab ${this.activeTab === t.key ? 'active' : ''}" @click=${() => this.activeTab = t.key}>${t.label}</div>
          `)}
          ${r.correction_history?.length ? html`
            <div class="tab" style="margin-top:10px;font-size:11px;color:#909399;border-top:1px solid #f4f5f7;padding-top:12px">
              提示：状态/版本/证据变更<br>均会反映至详情中
            </div>
          ` : ''}
        </div>
        <div class="panel">
          ${this.activeTab === 'base' ? this._renderBase() : ''}
          ${this.activeTab === 'med' ? this._renderMedication() : ''}
          ${this.activeTab === 'vitals' ? this._renderVitals() : ''}
          ${this.activeTab === 'ev' ? this._renderEvidence() : ''}
          ${this.activeTab === 'flow' ? this._renderProcess() : ''}
          ${this.activeTab === 'notes' ? this._renderNotes() : ''}

          ${this.editMode && ['base', 'med', 'vitals', 'ev'].includes(this.activeTab) ? this._renderEditActions() : ''}
          ${!this.editMode && this.canAudit ? this._renderAuditPanel() : ''}
          ${!this.editMode && this.canReview ? this._renderReviewPanel() : ''}
        </div>
      </div>
    `;
  }
}
customElements.define('detail-view', DetailView);
