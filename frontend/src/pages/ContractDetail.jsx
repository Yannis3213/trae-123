import { createSignal, For, Show, onMount, createMemo } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { api, STATUS_TAGS, STAGE_NAMES, ROLE_NAMES, useAuth, WARNING_LABEL, ACTION_NAMES } from '../store/auth.jsx';
import PatchModal from '../components/PatchModal.jsx';

const EVIDENCE_LABEL = {
  contract_scan: '合同扫描件',
  customer_authorization: '客户授权委托书',
  supplementary_material: '补正材料说明',
  trade_confirmation: '交易确认单',
  price_check_report: '价格核查报告',
  risk_assessment: '风险评估报告',
  compliance_check: '合规性检查',
};

const ACTIONS_BY_ROLE = {
  customer_manager: {
    '待提交': [{ k: 'submit', label: '提交审核 → 待审核', ev: ['contract_scan', 'customer_authorization'] }],
    '已退回': [{ k: 'resubmit', label: '重新提交 → 待审核', ev: ['supplementary_material'] }],
    '重新提交': [{ k: 'submit', label: '再提交 → 待复核', ev: ['contract_scan', 'customer_authorization'] }],
  },
  trade_specialist: {
    '待审核': [
      { k: 'approve', label: '审核通过 → 待复核', ev: ['trade_confirmation', 'price_check_report'] },
      { k: 'reject', label: '退回 → 已退回', ev: [] },
    ],
  },
  risk_manager: {
    '待复核': [
      { k: 'finalize', label: '复核完成 → 已完成', ev: ['risk_assessment', 'compliance_check'] },
      { k: 'reject', label: '退回 → 重新提交', ev: [] },
    ],
  },
};

const STEP_ORDER = [
  { stage: 'customer_manager', label: '客户经理补齐材料' },
  { stage: 'trade_specialist', label: '交易专员办理' },
  { stage: 'risk_manager', label: '风控经理收口' },
];

export default function ContractDetail() {
  const { user } = useAuth();
  const params = useParams();
  const nav = useNavigate();
  const [c, setC] = createSignal(null);
  const [tab, setTab] = createSignal('basic');
  const [loading, setLoading] = createSignal(true);
  const [action, setAction] = createSignal('');
  const [opinion, setOpinion] = createSignal('');
  const [auditRemark, setAuditRemark] = createSignal('');
  const [evidence, setEvidence] = createSignal({});
  const [customerPatch, setCustomerPatch] = createSignal(null);
  const [pricingPatch, setPricingPatch] = createSignal(null);
  const [bindPricingId, setBindPricingId] = createSignal(null);
  const [allPricing, setAllPricing] = createSignal([]);
  const [err, setErr] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [showCustomerPatch, setShowCustomerPatch] = createSignal(false);
  const [showPricingPatch, setShowPricingPatch] = createSignal(false);
  const [newAttach, setNewAttach] = createSignal({ file_name: '', file_type: '' });

  async function load() {
    setLoading(true);
    const [r, p] = await Promise.all([
      api.getContract(params.id),
      api.listPricing(),
    ]);
    if (r.success) { setC(r.data); setAction(''); setEvidence({}); setErr(''); setBindPricingId(null); }
    if (p.success) setAllPricing(p.data);
    setLoading(false);
  }

  onMount(load);

  function applyPatch(custPatch, prcPatch) {
    if (custPatch && Object.keys(custPatch).length) {
      setCustomerPatch(prev => prev ? { ...prev, ...custPatch } : custPatch);
      setC(prev => prev ? { ...prev, customer: { ...prev.customer, ...custPatch } } : prev);
    }
    if (prcPatch && Object.keys(prcPatch).length) {
      setPricingPatch(prev => prev ? { ...prev, ...prcPatch } : prcPatch);
      setC(prev => {
        if (!prev) return prev;
        const base = prev.pricing || (bindPricingId() ? allPricing().find(p => p.id === bindPricingId()) : null) || {};
        return { ...prev, pricing: { ...base, ...prcPatch } };
      });
    }
  }

  const myActions = createMemo(() => {
    if (!c()) return [];
    return (ACTIONS_BY_ROLE[user().role] || {})[c().status] || [];
  });
  const selectedAction = createMemo(() => myActions().find(a => a.k === action()));
  const needEvidence = () => selectedAction()?.ev || [];

  function stepClass(idx) {
    if (!c()) return '';
    const stageIdx = STEP_ORDER.findIndex(s => s.stage === c().current_stage);
    if (c().status === '已完成') return 'done';
    if (idx < stageIdx) return 'done';
    if (idx === stageIdx) {
      if (c().status === '已退回' || c().status === '重新提交') return 'reject';
      return 'active';
    }
    return '';
  }

  function warnClass() {
    if (!c()) return '';
    return `warning-level-${c().warning_level}`;
  }

  async function submit() {
    if (!action()) return setErr('请选择办理动作');
    if (c().version != c().version) return;
    setSubmitting(true); setErr('');
    const r = await api.processContract({
      contract_id: c().id,
      action: action(),
      version: c().version,
      opinion: opinion(),
      audit_remark: auditRemark(),
      evidence: evidence(),
      customer_patch: customerPatch(),
      pricing_patch: pricingPatch(),
      pricing_id: bindPricingId() || undefined,
    });
    setSubmitting(false);
    if (r.success) {
      await load();
      setCustomerPatch(null); setPricingPatch(null); setBindPricingId(null); setOpinion(''); setAuditRemark('');
    } else {
      setErr(`[${r.error?.type}] ${r.error?.message}`);
    }
  }

  async function uploadAttach() {
    if (!newAttach().file_name.trim()) return alert('请输入文件名');
    const r = await api.addAttachment(c().id, { ...newAttach(), file_size: 1024 * 500 });
    if (r.success) { setNewAttach({ file_name: '', file_type: '' }); await load(); }
  }

  function tagFor(level) { return `warning-level-${level}`; }

  return (
    <div>
      <div class="breadcrumb">
        <a href="/contracts">售电合同单列表</a>
        <span>/</span>
        <span>{c()?.contract_no || '加载中...'}</span>
      </div>

      <Show when={loading()}><div class="card text-center">加载中...</div></Show>

      <Show when={c() && !loading()}>
        <div class="card">
          <div class="card-title">
            <div>
              <span class="text-xl text-bold">{c().contract_name}</span>
              <span class="text-muted ml-3 text-sm">单号：</span>
              <span class="tag tag-primary ml-1">{c().contract_no}</span>
              <span class={`tag ml-2 ${STATUS_TAGS[c().status] || 'tag-muted'}`}>{c().status}</span>
              <span class="tag tag-info ml-2">V{c().version}</span>
              <span class={`ml-2 ${tagFor(c().warning_level)}`}>
                {WARNING_LABEL[c().warning_level]}
                <Show when={c().warning_level === 'overdue'}>（逾期{c().overdue_days}天）</Show>
              </span>
            </div>
            <div>
              <button class="btn btn-default btn-sm" onClick={() => nav('/contracts')}>← 返回列表</button>
            </div>
          </div>

          <div class="steps">
            {STEP_ORDER.map((s, i) => (
              <div class={`step ${stepClass(i)}`}>
                <div class="step-circle">{i + 1}</div>
                <div class="step-label">{s.label}</div>
                <div class="text-muted text-sm">环节：{STAGE_NAMES[s.stage]}</div>
              </div>
            ))}
          </div>

          <div class="grid-2">
            <div class="alert alert-info">
              <span class="alert-icon">📍</span>
              <div>
                <div><b>当前环节：</b>{STAGE_NAMES[c().current_stage]}</div>
                <Show when={c().previous_handler_id}><div class="text-sm mt-1"><b>上一处理人意见：</b>{c().previous_opinion || '（无）'}</div></Show>
                <Show when={c().audit_remark}><div class="text-sm mt-1"><b>审计备注：</b>{c().audit_remark}</div></Show>
              </div>
            </div>
            <div class="alert alert-warning">
              <span class="alert-icon">⏰</span>
              <div>
                <div><b>办理截止日期：</b>{c().deadline}</div>
                <div class="text-sm mt-1"><b>预警等级：</b>
                  <span class={`ml-1 ${warnClass()}`}>{WARNING_LABEL[c().warning_level]}</span>
                </div>
                <div class="text-sm mt-1"><b>金额：</b>¥{(c().contract_amount || 0).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="detail-tabs">
          {[
            ['basic', '合同基础信息'],
            ['customer', '用电客户'],
            ['pricing', '报价测算'],
            ['attach', '附件'],
            ['records', '处理记录（审计轨迹）'],
            ['audit', '审计备注'],
            ['exceptions', '异常原因'],
          ].map(([k, l]) => (
            <div class={`detail-tab ${tab() === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</div>
          ))}
        </div>

        <Show when={tab() === 'basic'}>
          <div class="card">
            <div class="card-title">基础信息</div>
            <div class="info-list">
              <div class="info-item"><div class="label">合同单号</div><div class="value">{c().contract_no}</div></div>
              <div class="info-item"><div class="label">状态</div><div class="value">{c().status}</div></div>
              <div class="info-item"><div class="label">当前环节</div><div class="value">{STAGE_NAMES[c().current_stage]}</div></div>
              <div class="info-item"><div class="label">版本</div><div class="value">V{c().version}</div></div>
              <div class="info-item"><div class="label">合同名称</div><div class="value">{c().contract_name}</div></div>
              <div class="info-item"><div class="label">合同金额</div><div class="value">¥{(c().contract_amount || 0).toLocaleString()}</div></div>
              <div class="info-item"><div class="label">签订日期</div><div class="value">{c().sign_date || '-'}</div></div>
              <div class="info-item"><div class="label">办理截止</div><div class="value">{c().deadline}</div></div>
              <div class="info-item"><div class="label">合同开始</div><div class="value">{c().term_start_date || '-'}</div></div>
              <div class="info-item"><div class="label">合同结束</div><div class="value">{c().term_end_date || '-'}</div></div>
            </div>
          </div>
        </Show>

        <Show when={tab() === 'customer'}>
          <div class="card">
            <div class="card-title">
              <span>用电客户信息</span>
              <button class="btn btn-default btn-sm" onClick={() => setShowCustomerPatch(true)}>
                ✏️ 补正客户资料
              </button>
            </div>
            <Show when={c().missing_fields?.customer?.length}>
              <div class="alert alert-danger mb-3">
                <span class="alert-icon">⚠️</span>
                <div><b>检测到缺项：</b>{c().missing_fields.customer.join('、')}
                <span class="text-sm ml-2">（提交前请补正）</span></div>
              </div>
            </Show>
            <Show when={c().customer}>
              <div class="info-list">
                {[
                  ['客户编码', 'customer_code'],
                  ['客户名称', 'customer_name'],
                  ['联系人', 'contact_person'],
                  ['联系电话', 'contact_phone'],
                  ['地址', 'address'],
                  ['电压等级', 'voltage_level'],
                  ['月用电量(kWh)', 'monthly_usage_kwh'],
                  ['行业', 'industry'],
                ].map(([k, f]) => (
                  <div class="info-item">
                    <div class="label">
                      {k}
                      <Show when={['customer_name', 'contact_person', 'contact_phone', 'address', 'voltage_level'].includes(f) && !c().customer[f]}>
                        <span class="text-danger text-bold ml-1">!</span>
                      </Show>
                    </div>
                    <div class="value">{c().customer[f] || '-'}</div>
                  </div>
                ))}
              </div>
            </Show>
          </div>
        </Show>

        <Show when={tab() === 'pricing'}>
          <div class="card">
            <div class="card-title">
              <span>报价测算</span>
              <Show when={c().pricing || bindPricingId()}>
                <button class="btn btn-default btn-sm" onClick={() => setShowPricingPatch(true)}>
                  ✏️ 补正报价资料
                </button>
              </Show>
            </div>
            <Show when={c().missing_fields?.pricing?.length && !bindPricingId()}>
              <div class="alert alert-danger mb-3">
                <span class="alert-icon">⚠️</span>
                <div><b>检测到缺项：</b>{c().missing_fields.pricing.join('、')}</div>
              </div>
            </Show>
            <Show when={c().pricing}>
              <div class="info-list-3">
                {[
                  ['测算编码', 'calculation_code'],
                  ['基础电价(元/kWh)', 'base_price'],
                  ['合同期限(月)', 'contract_term_months'],
                  ['峰时电价', 'peak_price'],
                  ['谷时电价', 'valley_price'],
                  ['年预计电量(kWh)', 'expected_annual_kwh'],
                  ['年预计金额(元)', 'estimated_annual_amount'],
                  ['折扣率(%)', 'discount_rate'],
                  ['状态', 'status'],
                ].map(([k, f]) => (
                  <div class="info-item">
                    <div class="label">{k}</div>
                    <div class="value">{c().pricing[f] ?? '-'}</div>
                  </div>
                ))}
              </div>
            </Show>
            <Show when={!c().pricing && !bindPricingId()}>
              <div class="alert alert-warning mb-3">
                <span class="alert-icon">💡</span>
                <div>未关联报价测算，请从下方选择一个报价测算绑定（办理时随补正一起提交）</div>
              </div>
              <div class="field-row">
                <label>选择报价测算绑定</label>
                <select value={bindPricingId() || ''} onChange={e => setBindPricingId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">-- 请选择 --</option>
                  <For each={allPricing().filter(p => !c().pricing_id || p.id !== c().pricing_id)}>
                    {p => (
                      <option value={p.id}>
                        {p.calculation_code} - {p.customer_name} - 基础电价 {p.base_price} 元/kWh - 年金额 ¥{(p.estimated_annual_amount || 0).toLocaleString()}
                      </option>
                    )}
                  </For>
                </select>
              </div>
            </Show>
            <Show when={!c().pricing && bindPricingId()}>
              {(() => {
                const sel = allPricing().find(p => p.id === bindPricingId());
                if (!sel) return null;
                return (
                  <div>
                    <div class="alert alert-success mb-3" style="padding:8px 12px;">
                      <span class="alert-icon">✅</span>
                      <div><b>已选择报价测算绑定：</b>{sel.calculation_code}（办理时提交关联）</div>
                    </div>
                    <div class="card mt-2" style="background: #f6ffed; border: 1px solid #b7eb8f;">
                      <div class="card-title" style="margin-bottom:8px;padding-bottom:8px;">
                        <span>即将绑定的报价测算预览</span>
                        <button class="btn btn-default btn-sm" onClick={() => setShowPricingPatch(true)}>
                          ✏️ 补正报价资料
                        </button>
                      </div>
                      <div class="info-list-3">
                        {[['测算编码','calculation_code'],['基础电价','base_price'],['合同期限(月)','contract_term_months'],['峰时电价','peak_price'],['谷时电价','valley_price'],['年预计电量','expected_annual_kwh'],['年预计金额','estimated_annual_amount'],['折扣率(%)','discount_rate'],['状态','status']].map(([k,f]) => (
                          <div class="info-item"><div class="label">{k}</div><div class="value">{sel[f] ?? '-'}</div></div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </Show>
          </div>
        </Show>

        <Show when={tab() === 'attach'}>
          <div class="card">
            <div class="card-title">附件列表</div>
            <div class="flex gap-3 mb-4">
              <input placeholder="文件名" style="flex:1" value={newAttach().file_name} onInput={e => setNewAttach({...newAttach(), file_name: e.target.value})} />
              <input placeholder="文件类型" style="width:160px" value={newAttach().file_type} onInput={e => setNewAttach({...newAttach(), file_type: e.target.value})} />
              <button class="btn btn-primary" onClick={uploadAttach}>➕ 添加</button>
            </div>
            <Show when={c().attachments.length}>
              <table>
                <thead><tr><th>文件名</th><th>类型</th><th>上传环节</th><th>上传人</th><th>上传时间</th></tr></thead>
                <tbody>
                  <For each={c().attachments}>
                    {a => (
                      <tr>
                        <td>📎 {a.file_name}</td>
                        <td>{a.file_type || '-'}</td>
                        <td>{STAGE_NAMES[a.stage] || a.stage || '-'}</td>
                        <td>{a.uploaded_by_name || '-'}</td>
                        <td>{a.uploaded_at}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
            <Show when={!c().attachments.length}><div class="empty">暂无附件</div></Show>
          </div>
        </Show>

        <Show when={tab() === 'records'}>
          <div class="card">
            <div class="card-title">处理记录 · 审计轨迹</div>
            <Show when={c().records.length}>
              <For each={c().records}>
                {r => (
                  <div class={`record-item ${r.action === 'reject' ? 'reject' : (r.action === 'approve' || r.action === 'finalize' || r.action === 'submit' || r.action === 'resubmit') ? 'approve' : ''}`}>
                    <div class="record-head">
                      <div>
                        <span class="text-bold">{r.handler_name}</span>
                        <span class="tag tag-muted ml-2">{ROLE_NAMES[r.handler_role] || r.handler_role}</span>
                        <span class="tag tag-info ml-1">{STAGE_NAMES[r.stage] || r.stage}</span>
                        <span class="ml-2">
                          动作：<b>{ACTION_NAMES[r.action] || r.action}</b>
                          <Show when={r.from_status}>
                            <span class="text-muted ml-1">{r.from_status} → <b class="text-primary">{r.to_status}</b></span>
                          </Show>
                        </span>
                      </div>
                      <div>
                        <span class="text-muted text-sm">{r.created_at}</span>
                        <span class="tag tag-purple ml-2">V{r.version}</span>
                      </div>
                    </div>
                    <Show when={r.opinion}><div class="mt-2">💬 <span class="text-muted">意见：</span>{r.opinion}</div></Show>
                    <Show when={r.evidence_json}>
                      <div class="mt-2">
                        {(() => {
                          try {
                            const ev = JSON.parse(r.evidence_json);
                            return Object.entries(ev).map(([k, v]) => (
                              <span class={`evidence-item ${v ? '' : 'no'}`}>
                                {EVIDENCE_LABEL[k] || k}：{v ? '已提供' : '缺失'}
                              </span>
                            ));
                          } catch { return ''; }
                        })()}
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
            <Show when={!c().records.length}><div class="empty">暂无处理记录</div></Show>
          </div>
        </Show>

        <Show when={tab() === 'audit'}>
          <div class="card">
            <div class="card-title">审计备注</div>
            <Show when={c().audit_notes.length}>
              <For each={c().audit_notes}>
                {n => (
                  <div class="record-item" style="border-left-color: var(--purple)">
                    <div class="record-head">
                      <div>📝 {n.noted_by_name || '系统'} 的备注</div>
                      <div class="text-muted text-sm">{n.created_at}</div>
                    </div>
                    <div class="mt-2">{n.note}</div>
                  </div>
                )}
              </For>
            </Show>
            <Show when={!c().audit_notes.length}><div class="empty">暂无审计备注</div></Show>
          </div>
        </Show>

        <Show when={tab() === 'exceptions'}>
          <div class="card">
            <div class="card-title">异常原因记录</div>
            <Show when={c().exceptions.length}>
              <For each={c().exceptions}>
                {e => (
                  <div class="record-item reject">
                    <div class="record-head">
                      <div>
                        <span class={`tag ${
                          e.exception_type === '材料问题' ? 'tag-danger' :
                          e.exception_type === '权限问题' ? 'tag-warning' :
                          e.exception_type === '时限问题' ? 'tag-warning' :
                          'tag-danger'
                        }`}>{e.exception_type}</span>
                        <span class="ml-2 text-muted">{e.exception_code}</span>
                        <Show when={e.stage}><span class="tag tag-info ml-2">{STAGE_NAMES[e.stage]}</span></Show>
                      </div>
                      <div class="text-muted text-sm">{e.created_at}</div>
                    </div>
                    <div class="mt-2">🔴 {e.message}</div>
                    <Show when={e.detail_json}>
                      <div class="mt-2 text-sm">
                        <span class="text-muted">详情：</span>
                        {(() => { try { return Object.entries(JSON.parse(e.detail_json)).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('、') : v}`).join('；'); } catch { return e.detail_json; } })()}
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
            <Show when={!c().exceptions.length}><div class="empty">暂无异常记录</div></Show>
          </div>
        </Show>

        <div class="card">
          <div class="card-title">
            <span>办理操作（当前：<span class="text-primary">{user().real_name} - {ROLE_NAMES[user().role]}</span>）</span>
          </div>

          <div class="grid-2">
            <div class="field-row">
              <label class="required">办理动作</label>
              <select value={action()} onChange={e => { setAction(e.target.value); setEvidence({}); }}>
                <option value="">请选择</option>
                {myActions().length === 0 && <option value="" disabled>当前状态无可执行动作</option>}
                {myActions().map(a => <option value={a.k}>{a.label}</option>)}
              </select>
            </div>
            <div class="field-row">
              <label>审计备注（写入审计轨迹）</label>
              <input value={auditRemark()} onInput={e => setAuditRemark(e.target.value)} placeholder="可选，会记录到审计备注表" />
            </div>
          </div>

          <div class="field-row">
            <label>办理意见</label>
            <textarea rows="2" value={opinion()} onInput={e => setOpinion(e.target.value)} placeholder="必填（推荐）：处理意见会保留给下一环节"></textarea>
          </div>

          <Show when={needEvidence().length > 0}>
            <div class="field-row">
              <label class="required">必备证据</label>
              <div class="flex flex-wrap gap-2 mt-2">
                {needEvidence().map(k => (
                  <label style="display:flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background: white;">
                    <input type="checkbox" checked={!!evidence()[k]} onChange={() => setEvidence({ ...evidence(), [k]: !evidence()[k] })} />
                    <span>{EVIDENCE_LABEL[k] || k}</span>
                  </label>
                ))}
              </div>
            </div>
          </Show>

          <div class="flex gap-2 mt-2">
            <Show when={customerPatch() && Object.keys(customerPatch()).length}>
              <div class="alert alert-success" style="padding:6px 12px;margin:0">
                ✅ 已暂存客户补正：{Object.keys(customerPatch()).join('、')}（办理时提交）
              </div>
            </Show>
            <Show when={pricingPatch() && Object.keys(pricingPatch()).length}>
              <div class="alert alert-success" style="padding:6px 12px;margin:0">
                ✅ 已暂存报价补正：{Object.keys(pricingPatch()).join('、')}（办理时提交）
              </div>
            </Show>
            <Show when={bindPricingId() && !c().pricing}>
              <div class="alert alert-success" style="padding:6px 12px;margin:0">
                ✅ 已选择报价测算 #{bindPricingId()} 绑定（办理时提交）
              </div>
            </Show>
          </div>
          <div class="flex gap-2 mt-2 flex-wrap">
            <Show when={c().missing_fields?.customer?.length}>
              <button class="btn btn-warning btn-sm" onClick={() => setShowCustomerPatch(true)}>
                ⚠️ 补正客户缺项：{c().missing_fields.customer.join('、')}
              </button>
            </Show>
            <Show when={!c().pricing && !bindPricingId()}>
              <button class="btn btn-warning btn-sm" onClick={() => setTab('pricing')}>
                ⚠️ 请绑定报价测算（点击跳转）
              </button>
            </Show>
            <Show when={!c().pricing && bindPricingId() && !pricingPatch()}>
              <button class="btn btn-info btn-sm" onClick={() => setShowPricingPatch(true)}>
                ✏️ 补正报价资料（可选）
              </button>
            </Show>
            <Show when={c().pricing && c().missing_fields?.pricing?.length}>
              <button class="btn btn-warning btn-sm" onClick={() => setShowPricingPatch(true)}>
                ⚠️ 补正报价缺项：{c().missing_fields.pricing.join('、')}
              </button>
            </Show>
          </div>

          <Show when={err()}>
            <div class="alert alert-danger mt-3"><span class="alert-icon">⚠️</span>{err()}</div>
          </Show>

          <div class="flex justify-end mt-3 gap-2">
            <button class="btn btn-primary" onClick={submit} disabled={!action() || submitting()}>
              {submitting() ? '提交中...' : `确认办理（V${c().version}）`}
            </button>
          </div>
        </div>

        <Show when={showCustomerPatch()}>
          <PatchModal
            title="补正用电客户资料"
            record={c().customer}
            fields={[
              { k: 'customer_name', label: '客户名称' },
              { k: 'contact_person', label: '联系人' },
              { k: 'contact_phone', label: '联系电话' },
              { k: 'address', label: '地址' },
              { k: 'voltage_level', label: '电压等级' },
              { k: 'monthly_usage_kwh', label: '月用电量' },
              { k: 'industry', label: '行业' },
            ]}
            onClose={() => setShowCustomerPatch(false)}
            onDone={(patch) => { applyPatch(patch, null); setShowCustomerPatch(false); }}
          />
        </Show>

        <Show when={showPricingPatch()}>
          <PatchModal
            title="补正报价测算资料"
            record={(() => {
              if (c().pricing) return c().pricing;
              if (bindPricingId()) return allPricing().find(p => p.id === bindPricingId()) || {};
              return {};
            })()}
            fields={[
              { k: 'base_price', label: '基础电价' },
              { k: 'contract_term_months', label: '合同期限(月)' },
              { k: 'peak_price', label: '峰时电价' },
              { k: 'valley_price', label: '谷时电价' },
              { k: 'expected_annual_kwh', label: '年预计电量' },
              { k: 'estimated_annual_amount', label: '年预计金额' },
              { k: 'discount_rate', label: '折扣率(%)' },
            ]}
            onClose={() => setShowPricingPatch(false)}
            onDone={(patch) => { applyPatch(null, patch); setShowPricingPatch(false); }}
          />
        </Show>
      </Show>
    </div>
  );
}
