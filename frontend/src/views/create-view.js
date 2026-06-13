import { LitElement, css, html } from 'lit';
import { api } from '../api.js';
import { STATUS_MAP } from '../utils.js';

export class CreateView extends LitElement {
  static properties = {
    props: { type: Object },
    form: { type: Object },
    medRows: { type: Array },
    vitals: { type: Object },
    submitting: { type: Boolean },
  };

  constructor() {
    super();
    this.form = {
      elder_name: '',
      elder_id_card: '',
      room_no: '',
      bed_no: '',
      care_type: '日常护理',
      care_content: '',
      record_date: new Date().toISOString().slice(0, 16),
    };
    this.medRows = [];
    this.vitals = { 血压: '', 心率: '', 体温: '', 血氧: '', 血糖: '' };
    this.submitting = false;
  }

  static styles = css`
    :host { display: block; }
    .wrap { background: #fff; border-radius: 12px; padding: 24px 28px; border: 1px solid #ebeef5; box-shadow: 0 1px 3px rgba(0,0,0,0.05); max-width: 1100px; margin: 0 auto; }
    h2 { margin: 0 0 6px; font-size: 18px; }
    .sub { color: #909399; font-size: 13px; margin-bottom: 20px; }
    .sec-title { font-size: 14px; font-weight: 600; color: #303133; margin: 20px 0 12px; padding-left: 10px; border-left: 3px solid #409eff; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    @media (max-width: 900px) { .grid { grid-template-columns: repeat(2, 1fr); } }
    .field { display: flex; flex-direction: column; }
    .field label { font-size: 12px; color: #606266; margin-bottom: 5px; }
    .field label .req { color: #f56c6c; }
    .field input, .field select, .field textarea { padding: 8px 11px; border: 1px solid #dcdfe6; border-radius: 6px; font-size: 13px; font-family: inherit; outline: none; }
    .field input:focus, .field select:focus, .field textarea:focus { border-color: #409eff; }
    .field textarea { resize: vertical; min-height: 80px; }
    .full { grid-column: 1 / -1; }

    .med-table { width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid #ebeef5; border-radius: 8px; overflow: hidden; }
    .med-table th { background: #fafbfc; text-align: left; padding: 8px 12px; font-size: 12px; color: #606266; font-weight: 500; border-bottom: 1px solid #ebeef5; }
    .med-table td { padding: 6px 10px; border-bottom: 1px solid #f4f5f7; }
    .med-table td input { width: 100%; padding: 5px 8px; border: 1px solid #ebeef5; border-radius: 4px; font-size: 13px; }
    .med-table td input:focus { border-color: #409eff; outline: none; }
    .add-btn, .del-btn { padding: 5px 12px; border-radius: 4px; border: 1px solid #dcdfe6; background: #fff; font-size: 12px; cursor: pointer; }
    .del-btn { color: #f56c6c; border-color: #fbc4c4; background: #fef0f0; }
    .add-btn { color: #409eff; border-color: #a0cfff; background: #ecf5ff; }

    .vitals-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
    .chip { display: inline-block; padding: 3px 10px; border-radius: 12px; background: #ecf5ff; color: #409eff; font-size: 11px; margin-right: 6px; cursor: pointer; }
    .chip.checked { background: #409eff; color: #fff; }

    .actions { margin-top: 28px; display: flex; gap: 10px; justify-content: flex-end; padding-top: 18px; border-top: 1px solid #ebeef5; }
    .btn { padding: 9px 20px; border-radius: 6px; border: 1px solid #dcdfe6; background: #fff; font-size: 14px; cursor: pointer; }
    .btn.primary { background: linear-gradient(90deg, #1e40af, #3b82f6); color: #fff; border-color: #3b82f6; }
    .btn.primary:hover { filter: brightness(1.05); }
    .btn:disabled { opacity: 0.7; cursor: not-allowed; }

    .evidence-checks { display: flex; flex-wrap: wrap; gap: 10px; }
  `;

  setField(k, v) { this.form = { ...this.form, [k]: v }; }
  setVital(k, v) { this.vitals = { ...this.vitals, [k]: v }; }
  setMed(i, k, v) {
    const rows = [...this.medRows];
    rows[i] = { ...rows[i], [k]: v };
    this.medRows = rows;
  }
  addMed() {
    this.medRows = [...this.medRows, { name: '', dose: '', time: '08:00', operator: this.props?.user?.full_name || '' }];
  }
  delMed(i) {
    this.medRows = this.medRows.filter((_, idx) => idx !== i);
  }

  toggleEvidence(e) {
    const v = e.target.dataset.value;
    const cur = this._ev;
    if (cur.includes(v)) this._ev = cur.filter(x => x !== v);
    else this._ev = [...cur, v];
    this.requestUpdate();
  }

  get _ev() {
    if (!this.__ev) this.__ev = ['护理记录表'];
    return this.__ev;
  }
  set _ev(v) { this.__ev = v; }

  async doSave(submit = false) {
    if (!this.form.elder_name) { this.props.notify?.('error', '请填写老人姓名'); return; }
    if (!this.form.care_content) { this.props.notify?.('error', '请填写照护内容'); return; }

    this.submitting = true;
    const med = this.medRows.filter(m => m.name).map(m => ({ ...m }));
    const vitals = {};
    Object.keys(this.vitals).forEach(k => { if (this.vitals[k]) vitals[k] = this.vitals[k]; });

    try {
      const payload = {
        ...this.form,
        record_date: new Date(this.form.record_date).toISOString(),
        medication_detail: med,
        vital_signs: vitals,
        evidence_required: [...this._ev],
        evidence_provided: [],
      };
      const created = await api.createRecord(payload);
      this.props.notify?.('success', `已创建记录 ${created.record_no}`);
      if (submit) {
        const ev = [...this._ev];
        await api.submitRecord(created.id, { version: 1, evidence_provided: ev });
        this.props.notify?.('success', '已提交至护士长审核');
      }
      if (this.props.loadStats) this.props.loadStats();
      this.props.navigate(`/record/${created.id}`);
    } catch (e) {
      this.props.notify?.('error', e.message);
    } finally {
      this.submitting = false;
    }
  }

  render() {
    const careTypes = ['日常护理', '康复护理', '特护护理', '慢病护理', '术后护理', '失智护理', '临终关怀'];
    const evTypes = ['护理记录表', '用药签名单', '生命体征记录表', '皮肤评估表', '伤口评估单',
      '康复训练记录', '鼻饲记录', '家属知情同意书', '异常上报单', '家属告知记录',
      'DVT预防记录', '血糖监测记录', '疼痛评估表', '行为观察记录'];

    return html`
      <div class="wrap">
        <h2>新增照护记录登记</h2>
        <div class="sub">请完整填写老人信息、照护内容、药品发放、生命体征等；可保存草稿或直接提交审核。</div>

        <div class="sec-title">基本信息</div>
        <div class="grid">
          <div class="field"><label>老人姓名<span class="req">*</span></label><input .value=${this.form.elder_name} @input=${e => this.setField('elder_name', e.target.value)}></div>
          <div class="field"><label>身份证号</label><input .value=${this.form.elder_id_card} @input=${e => this.setField('elder_id_card', e.target.value)}></div>
          <div class="field"><label>房间号</label><input .value=${this.form.room_no} @input=${e => this.setField('room_no', e.target.value)} placeholder="如：A-201"></div>
          <div class="field"><label>床位号</label><input .value=${this.form.bed_no} @input=${e => this.setField('bed_no', e.target.value)} placeholder="如：1"></div>
          <div class="field"><label>护理类型<span class="req">*</span></label>
            <select .value=${this.form.care_type} @change=${e => this.setField('care_type', e.target.value)}>
              ${careTypes.map(c => html`<option>${c}</option>`)}
            </select>
          </div>
          <div class="field"><label>记录时间<span class="req">*</span></label><input type="datetime-local" .value=${this.form.record_date} @input=${e => this.setField('record_date', e.target.value)}></div>
          <div class="field full"><label>照护内容<span class="req">*</span></label>
            <textarea placeholder="详细记录照护过程、老人状态、特殊情况等" .value=${this.form.care_content} @input=${e => this.setField('care_content', e.target.value)}></textarea>
          </div>
        </div>

        <div class="sec-title">药品发放记录（若有）</div>
        <table class="med-table">
          <thead><tr><th>药品名称</th><th>剂量</th><th>发放时间</th><th>发放人</th><th style="width:60px"></th></tr></thead>
          <tbody>
            ${this.medRows.map((m, i) => html`
              <tr>
                <td><input placeholder="如：硝苯地平缓释片" .value=${m.name} @input=${e => this.setMed(i, 'name', e.target.value)}></td>
                <td><input placeholder="如：10mg" .value=${m.dose} @input=${e => this.setMed(i, 'dose', e.target.value)}></td>
                <td><input placeholder="如：08:00" .value=${m.time} @input=${e => this.setMed(i, 'time', e.target.value)}></td>
                <td><input placeholder="发放人" .value=${m.operator} @input=${e => this.setMed(i, 'operator', e.target.value)}></td>
                <td><button class="del-btn" @click=${() => this.delMed(i)}>删除</button></td>
              </tr>
            `)}
          </tbody>
        </table>
        <div style="margin-top:8px"><button class="add-btn" @click=${this.addMed}>+ 新增药品记录</button></div>

        <div class="sec-title">生命体征</div>
        <div class="vitals-grid">
          ${Object.keys(this.vitals).map(k => html`
            <div class="field"><label>${k}</label><input .value=${this.vitals[k]} @input=${e => this.setVital(k, e.target.value)} placeholder="请输入"></div>
          `)}
        </div>

        <div class="sec-title">所需证据材料</div>
        <div class="evidence-checks">
          ${evTypes.map(ev => html`
            <label class="chip ${this._ev.includes(ev) ? 'checked' : ''}" style="cursor:pointer">
              <input type="checkbox" style="display:none" data-value=${ev} @change=${this.toggleEvidence} ?checked=${this._ev.includes(ev)}>
              ${this._ev.includes(ev) ? '✓ ' : ''}${ev}
            </label>
          `)}
        </div>

        <div class="actions">
          <button class="btn" @click=${() => this.props.navigate('/dashboard')}>取消</button>
          <button class="btn" ?disabled=${this.submitting} @click=${() => this.doSave(false)}>保存草稿</button>
          <button class="btn primary" ?disabled=${this.submitting} @click=${() => this.doSave(true)}>保存并提交审核</button>
        </div>
      </div>
    `;
  }
}
customElements.define('create-view', CreateView);
