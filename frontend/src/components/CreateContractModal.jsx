import { createSignal } from 'solid-js';
import { api } from '../store/auth.jsx';

export default function CreateContractModal(props) {
  const [customers, setCustomers] = createSignal([]);
  const [pricing, setPricing] = createSignal([]);
  const [form, setForm] = createSignal({
    contract_name: '',
    customer_id: '',
    pricing_id: '',
    contract_amount: 0,
    term_start_date: '',
    term_end_date: '',
    sign_date: '',
    deadline: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
  });
  const [saving, setSaving] = createSignal(false);
  const [err, setErr] = createSignal('');

  (async () => {
    const [c, p] = await Promise.all([api.listCustomers(), api.listPricing()]);
    if (c.success) setCustomers(c.data);
    if (p.success) setPricing(p.data);
  })();

  function updateField(k, v) {
    setForm({ ...form(), [k]: v });
    if (k === 'customer_id') setForm({ ...form(), [k]: v, pricing_id: '' });
  }

  async function submit() {
    if (!form().contract_name.trim()) return setErr('请填写合同名称');
    if (!form().customer_id) return setErr('请选择用电客户');
    if (!form().deadline) return setErr('请填写截止日期');
    setSaving(true); setErr('');
    const payload = { ...form(), customer_id: Number(form().customer_id), pricing_id: form().pricing_id ? Number(form().pricing_id) : null };
    const r = await api.createContract(payload);
    setSaving(false);
    if (r.success) { props.onDone && props.onDone(r.data); }
    else setErr(r.error?.message || '保存失败');
  }

  const pricingOptions = () => pricing().filter(p => !form().customer_id || p.customer_id == form().customer_id);

  return (
    <div class="modal-mask" onClick={e => e.target === e.currentTarget && props.onClose()}>
      <div class="modal">
        <div class="modal-header">
          <h3>📝 新登记售电合同单</h3>
          <span class="close-btn" onClick={props.onClose}>×</span>
        </div>
        <div class="modal-body">
          <div class="grid-2">
            <div class="field-row">
              <label class="required">合同名称</label>
              <input value={form().contract_name} onInput={e => updateField('contract_name', e.target.value)} placeholder="如：XX年度购售电合同" />
            </div>
            <div class="field-row">
              <label class="required">用电客户</label>
              <select value={form().customer_id} onChange={e => updateField('customer_id', e.target.value)}>
                <option value="">请选择</option>
                {customers().map(c => <option value={c.id}>{c.customer_name}</option>)}
              </select>
            </div>
            <div class="field-row">
              <label>报价测算</label>
              <select value={form().pricing_id} onChange={e => updateField('pricing_id', e.target.value)}>
                <option value="">暂不关联</option>
                {pricingOptions().map(p => <option value={p.id}>{p.calculation_code}（{(p.estimated_annual_amount||0).toLocaleString()}元）</option>)}
              </select>
            </div>
            <div class="field-row">
              <label>合同金额（元）</label>
              <input type="number" value={form().contract_amount} onInput={e => updateField('contract_amount', Number(e.target.value) || 0)} />
            </div>
            <div class="field-row">
              <label>合同开始日期</label>
              <input type="date" value={form().term_start_date} onInput={e => updateField('term_start_date', e.target.value)} />
            </div>
            <div class="field-row">
              <label>合同结束日期</label>
              <input type="date" value={form().term_end_date} onInput={e => updateField('term_end_date', e.target.value)} />
            </div>
            <div class="field-row">
              <label>签订日期</label>
              <input type="date" value={form().sign_date} onInput={e => updateField('sign_date', e.target.value)} />
            </div>
            <div class="field-row">
              <label class="required">办理截止日期</label>
              <input type="date" value={form().deadline} onInput={e => updateField('deadline', e.target.value)} />
            </div>
          </div>
          {err() && <div class="alert alert-danger mt-3"><span class="alert-icon">⚠️</span>{err()}</div>}
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onClick={props.onClose}>取消</button>
          <button class="btn btn-primary" onClick={submit} disabled={saving()}>
            {saving() ? '保存中...' : '登记提交'}
          </button>
        </div>
      </div>
    </div>
  );
}
