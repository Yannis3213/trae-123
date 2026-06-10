import { createSignal, For, Show, onMount, createMemo } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { api, useAuth } from '../store/auth.jsx';

export default function Customers() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [list, setList] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [keyword, setKeyword] = createSignal('');
  const [editTarget, setEditTarget] = createSignal(null);
  const [form, setForm] = createSignal({});

  async function load() {
    setLoading(true);
    const r = await api.listCustomers(keyword());
    if (r.success) setList(r.data);
    setLoading(false);
  }

  onMount(load);

  function startEdit(c) {
    setForm({ ...c });
    setEditTarget(c);
  }

  async function saveEdit() {
    if (!form().customer_name?.trim() || !form().customer_code?.trim()) {
      alert('客户编码和名称必填');
      return;
    }
    const r = await api.updateCustomer(editTarget().id, form());
    if (r.success) { setEditTarget(null); await load(); }
    else alert('保存失败：' + (r.error?.message || '未知错误'));
  }

  function reqList() {
    return ['customer_name', 'contact_person', 'contact_phone', 'address', 'voltage_level'];
  }

  return (
    <div>
      <div class="breadcrumb">
        <a href="/">首页</a><span>/</span><span>用电客户</span>
      </div>

      <div class="card">
        <div class="card-title">
          <span>用电客户资料（业务区模块 1/3）</span>
          <div>
            <span class="text-sm text-muted">客户经理可修改；缺项将在合同单提交时拦截</span>
          </div>
        </div>
        <div class="filter-bar" style="padding:0;margin:0 0 16px 0;box-shadow:none">
          <input placeholder="搜索客户名称/编码" style="width:320px" value={keyword()} onInput={e => setKeyword(e.target.value)} />
          <button class="btn btn-primary" onClick={load}>查询</button>
          <button class="btn btn-default" onClick={() => nav('/contracts')}>→ 到合同单列表</button>
        </div>

        <div class="table-scroll" style="box-shadow:none">
          <table>
            <thead>
              <tr>
                <th>客户编码</th>
                <th>客户名称</th>
                <th>联系人</th>
                <th>联系电话</th>
                <th>地址</th>
                <th>电压等级</th>
                <th>月用电(kWh)</th>
                <th>行业</th>
                <th>完整性</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <For each={list()} fallback={<tr><td colspan="10" class="empty">暂无客户</td></tr>}>
                {c => {
                  const missing = reqList().filter(f => !c[f]);
                  return (
                    <tr>
                      <td class="text-bold text-primary">{c.customer_code}</td>
                      <td>{c.customer_name}</td>
                      <td>{c.contact_person || <span class="text-danger">-</span>}</td>
                      <td>{c.contact_phone || <span class="text-danger">-</span>}</td>
                      <td>{c.address || <span class="text-danger">-</span>}</td>
                      <td>{c.voltage_level || <span class="text-danger">-</span>}</td>
                      <td>{c.monthly_usage_kwh?.toLocaleString?.() || '-'}</td>
                      <td>{c.industry || '-'}</td>
                      <td>
                        {missing.length === 0
                          ? <span class="tag tag-success">✓ 完整</span>
                          : <span class="tag tag-danger">缺：{missing.length}项</span>}
                      </td>
                      <td>
                        <button class="btn btn-default btn-sm" onClick={() => startEdit(c)}>编辑</button>
                      </td>
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
            <div class="modal-header"><h3>✏️ 编辑用电客户</h3><span class="close-btn" onClick={() => setEditTarget(null)}>×</span></div>
            <div class="modal-body">
              <div class="grid-2">
                {[
                  ['customer_code', '客户编码'],
                  ['customer_name', '客户名称'],
                  ['contact_person', '联系人'],
                  ['contact_phone', '联系电话'],
                  ['address', '地址'],
                  ['voltage_level', '电压等级'],
                  ['monthly_usage_kwh', '月用电量(kWh)'],
                  ['industry', '行业'],
                ].map(([k, l]) => (
                  <div class="field-row">
                    <label>{l}{reqList().includes(k) ? <span class="text-danger"> *</span> : ''}</label>
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
