import { createSignal, For, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { api } from '../store/auth.jsx';

export default function Pricing() {
  const nav = useNavigate();
  const [list, setList] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [keyword, setKeyword] = createSignal('');
  const [editTarget, setEditTarget] = createSignal(null);
  const [form, setForm] = createSignal({});

  async function load() {
    setLoading(true);
    const r = await api.listPricing(keyword());
    if (r.success) setList(r.data);
    setLoading(false);
  }

  onMount(load);

  function startEdit(p) {
    setForm({ ...p });
    setEditTarget(p);
  }

  async function saveEdit() {
    if (!form().base_price || !form().contract_term_months) {
      alert('基础电价和合同期限必填');
      return;
    }
    const r = await api.updatePricing(editTarget().id, form());
    if (r.success) { setEditTarget(null); await load(); }
    else alert('保存失败：' + (r.error?.message || '未知错误'));
  }

  function reqList() { return ['base_price', 'contract_term_months']; }

  return (
    <div>
      <div class="breadcrumb">
        <a href="/">首页</a><span>/</span><span>报价测算</span>
      </div>

      <div class="card">
        <div class="card-title">
          <span>报价测算（业务区模块 2/3）</span>
          <div>
            <span class="text-sm text-muted">合同提交前必须关联报价测算，且基础项完整</span>
          </div>
        </div>
        <div class="filter-bar" style="padding:0;margin:0 0 16px 0;box-shadow:none">
          <input placeholder="搜索测算编码" style="width:320px" value={keyword()} onInput={e => setKeyword(e.target.value)} />
          <button class="btn btn-primary" onClick={load}>查询</button>
          <button class="btn btn-default" onClick={() => nav('/contracts')}>→ 到合同单列表</button>
        </div>

        <div class="table-scroll" style="box-shadow:none">
          <table>
            <thead>
              <tr>
                <th>测算编码</th><th>客户</th><th>基础电价</th><th>峰/谷</th>
                <th>期限(月)</th><th>年预计电量</th><th>年预计金额</th><th>折扣</th>
                <th>状态</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              <For each={list()} fallback={<tr><td colspan="10" class="empty">暂无报价测算</td></tr>}>
                {p => {
                  const missing = reqList().filter(f => p[f] === null || p[f] === undefined || p[f] === '');
                  return (
                    <tr>
                      <td class="text-bold text-primary">{p.calculation_code}</td>
                      <td>{p.customer_name || '-'}</td>
                      <td>{p.base_price} 元/kWh</td>
                      <td>{p.peak_price || '-'} / {p.valley_price || '-'}</td>
                      <td>{p.contract_term_months}</td>
                      <td>{p.expected_annual_kwh?.toLocaleString?.() || '-'}</td>
                      <td>¥{(p.estimated_annual_amount || 0).toLocaleString()}</td>
                      <td>{p.discount_rate || 0}%</td>
                      <td>
                        {p.status === 'approved' ? <span class="tag tag-success">已核准</span> : <span class="tag tag-warning">草稿</span>}
                        {missing.length > 0 && <span class="tag tag-danger ml-1">缺项</span>}
                      </td>
                      <td><button class="btn btn-default btn-sm" onClick={() => startEdit(p)}>编辑</button></td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </div>

      <Show when={editTarget()}>
        <div class="modal-mask" onClick={e => e.target === e.currentTarget && setEditTarget(null)}>
          <div class="modal" style="max-width:640px">
            <div class="modal-header"><h3>✏️ 编辑报价测算</h3><span class="close-btn" onClick={() => setEditTarget(null)}>×</span></div>
            <div class="modal-body">
              <div class="grid-2">
                {[
                  ['calculation_code', '测算编码'],
                  ['contract_term_months', '合同期限(月)*'],
                  ['base_price', '基础电价(元/kWh)*'],
                  ['peak_price', '峰时电价'],
                  ['valley_price', '谷时电价'],
                  ['expected_annual_kwh', '年预计电量(kWh)'],
                  ['estimated_annual_amount', '年预计金额(元)'],
                  ['discount_rate', '折扣率(%)'],
                  ['status', '状态（draft/approved）'],
                ].map(([k, l]) => (
                  <div class="field-row">
                    <label>{l}</label>
                    <input value={form()[k] ?? ''} onInput={e => setForm({ ...form(), [k]: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-default" onClick={() => setEditTarget(null)}>取消</button>
              <button class="btn btn-primary" onClick={saveEdit}>保存</button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
