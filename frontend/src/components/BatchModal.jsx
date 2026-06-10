import { createSignal, For, Show } from 'solid-js';
import { api, useAuth, ROLE_NAMES } from '../store/auth.jsx';

const ACTIONS_BY_ROLE = {
  customer_manager: [
    { key: 'submit', label: '提交（待提交→待审核 / 重新提交→待复核）', needEvidence: ['contract_scan', 'customer_authorization'] },
    { key: 'resubmit', label: '重新提交（已退回→待审核）', needEvidence: ['supplementary_material'] },
    { key: 'return', label: '退回补正', needEvidence: [] },
  ],
  trade_specialist: [
    { key: 'approve', label: '审核通过（待审核→待复核）', needEvidence: ['trade_confirmation', 'price_check_report'] },
    { key: 'reject', label: '审核退回（待审核→已退回）', needEvidence: [] },
  ],
  risk_manager: [
    { key: 'finalize', label: '复核完成（待复核→已完成）', needEvidence: ['risk_assessment', 'compliance_check'] },
    { key: 'reject', label: '复核退回（待复核→重新提交）', needEvidence: [] },
  ],
};

const EVIDENCE_LABEL = {
  contract_scan: '合同扫描件',
  customer_authorization: '客户授权委托书',
  supplementary_material: '补正材料说明',
  trade_confirmation: '交易确认单',
  price_check_report: '价格核查报告',
  risk_assessment: '风险评估报告',
  compliance_check: '合规性检查',
};

export default function BatchModal(props) {
  const { user, setBatchResults } = useAuth();
  const [action, setAction] = createSignal('');
  const [opinion, setOpinion] = createSignal('');
  const [evidence, setEvidence] = createSignal({});
  const [err, setErr] = createSignal('');
  const [processing, setProcessing] = createSignal(false);
  const [lastResults, setLastResults] = createSignal(null);

  const actions = ACTIONS_BY_ROLE[user().role] || [];
  const currentAction = () => actions.find(a => a.key === action());
  const needEvidence = () => currentAction()?.needEvidence || [];

  async function doSubmit() {
    if (!action()) return setErr('请选择办理动作');
    setProcessing(true); setErr('');
    const items = props.contracts.map(c => ({ contract_id: c.id, version: c.version }));
    const r = await api.batchProcess({ action: action(), items, opinion: opinion(), evidence: evidence() });
    setProcessing(false);
    if (r.success) {
      setLastResults(r.data);
      setBatchResults(r.data);
      const allOk = r.data.every(x => x.success);
      if (allOk) {
        setTimeout(() => props.onDone && props.onDone(r.data), 1200);
      }
    } else setErr(r.error?.message || '执行失败');
  }

  function toggleEvidence(k) {
    setEvidence({ ...evidence(), [k]: !evidence()[k] });
  }

  return (
    <div class="modal-mask" onClick={e => e.target === e.currentTarget && !processing() && !lastResults() && props.onClose()}>
      <div class="modal" style="max-width:760px">
        <div class="modal-header">
          <h3>📦 批量处理（{user().real_name} - {ROLE_NAMES[user().role]}）</h3>
          <span class="close-btn" onClick={() => !processing() && props.onClose()}>×</span>
        </div>
        <div class="modal-body">
          <div class="alert alert-info mb-3"><span class="alert-icon">ℹ️</span>共选中 <b>{props.contracts.length}</b> 份合同单，将按当前角色权限逐条办理，不满足条件的将被拦截。</div>

          <div class="field-row">
            <label class="required">办理动作</label>
            <select value={action()} onChange={e => { setAction(e.target.value); setEvidence({}); setLastResults(null); }}>
              <option value="">请选择动作</option>
              {actions.map(a => <option value={a.key}>{a.label}</option>)}
            </select>
          </div>

          <div class="field-row">
            <label>办理意见</label>
            <textarea rows="3" value={opinion()} onInput={e => setOpinion(e.target.value)} placeholder="可选，将写入审计轨迹"></textarea>
          </div>

          <Show when={needEvidence().length > 0}>
            <div class="field-row">
              <label class="required">必备证据（需提供所有）</label>
              <div class="flex flex-wrap gap-2 mt-2">
                <For each={needEvidence()}>
                  {k => (
                    <label style="display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--border);border-radius:4px;cursor:pointer;background: white;">
                      <input type="checkbox" checked={!!evidence()[k]} onChange={() => toggleEvidence(k)} />
                      <span>{EVIDENCE_LABEL[k] || k}</span>
                    </label>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <Show when={err()}>
            <div class="alert alert-danger mt-3"><span class="alert-icon">⚠️</span>{err()}</div>
          </Show>

          <Show when={lastResults()}>
            <div class="section-title">执行结果（{lastResults().filter(x=>x.success).length}/{lastResults().length} 成功）</div>
            <div style="max-height:260px;overflow-y:auto">
              <For each={lastResults()}>
                {r => (
                  <div class={`batch-result-item ${r.success ? 'success' : 'failed'}`}>
                    <div>
                      <span class="text-bold mr-2">{r.contract_no}</span>
                      <span>{r.success ? '✅ 成功' : '❌ 失败'}：{r.reason}</span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onClick={props.onClose} disabled={processing()}>
            {lastResults() ? '关闭' : '取消'}
          </button>
          <Show when={!lastResults()}>
            <button class="btn btn-primary" onClick={doSubmit} disabled={processing() || !action()}>
              {processing() ? '执行中...' : '开始批量处理'}
            </button>
          </Show>
          <Show when={lastResults()}>
            <button class="btn btn-primary" onClick={() => props.onDone && props.onDone(lastResults())}>
              查看批量结果页
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
