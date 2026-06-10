import { createSignal, For, Show, onMount, createMemo, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { api, STATUS_TAGS, STAGE_NAMES, useAuth, WARNING_LABEL } from '../store/auth.jsx';
import BatchModal from '../components/BatchModal.jsx';
import CreateContractModal from '../components/CreateContractModal.jsx';

export default function Contracts() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [list, setList] = createSignal([]);
  const [stats, setStats] = createSignal({});
  const [loading, setLoading] = createSignal(true);
  const [fStatus, setFStatus] = createSignal('');
  const [fStage, setFStage] = createSignal('');
  const [fWarning, setFWarning] = createSignal('');
  const [fKeyword, setFKeyword] = createSignal('');
  const [selected, setSelected] = createSignal(new Set());
  const [showBatch, setShowBatch] = createSignal(false);
  const [showCreate, setShowCreate] = createSignal(false);
  const [refreshKey, setRefreshKey] = createSignal(0);

  async function load() {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      api.listContracts({
        status: fStatus(),
        stage: fStage(),
        warning_level: fWarning(),
        keyword: fKeyword(),
      }),
      api.getContractStats(),
    ]);
    if (r1.success) setList(r1.data);
    if (r2.success) setStats(r2.data);
    setLoading(false);
  }

  onMount(load);
  createEffect(() => { refreshKey(); load(); });

  const selectedArray = createMemo(() => Array.from(selected()));

  function toggleAll() {
    if (selected().size === list().length && list().length > 0) setSelected(new Set());
    else setSelected(new Set(list().map(x => x.id)));
  }

  function toggleOne(id) {
    const n = new Set(selected());
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  }

  function openBatch() {
    if (selected().size === 0) { alert('请先勾选合同单'); return; }
    setShowBatch(true);
  }

  function tagFor(level) {
    if (!level) return '';
    return `warning-level-${level}`;
  }

  return (
    <div>
      <div class="breadcrumb">
        <a href="/">首页</a>
        <span>/</span>
        <span>售电合同单列表</span>
      </div>

      <div class="grid-4 mb-4">
        <div class="stat-card">
          <div class="stat-label">合同单总数</div>
          <div class="stat-value">{stats().total || 0}</div>
        </div>
        <div class="stat-card info">
          <div class="stat-label">正常</div>
          <div class="stat-value text-primary">{stats().normal || 0}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">临期（≤3天）</div>
          <div class="stat-value text-warning">{stats().warning || 0}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">逾期</div>
          <div class="stat-value text-danger">{stats().overdue || 0}</div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-item">
          <label>状态：</label>
          <select value={fStatus()} onChange={e => setFStatus(e.target.value)}>
            <option value="">全部</option>
            <option>待提交</option>
            <option>待审核</option>
            <option>待复核</option>
            <option>已退回</option>
            <option>重新提交</option>
            <option>已完成</option>
          </select>
        </div>
        <div class="filter-item">
          <label>环节：</label>
          <select value={fStage()} onChange={e => setFStage(e.target.value)}>
            <option value="">全部</option>
            <option value="customer_manager">客户经理</option>
            <option value="trade_specialist">交易专员</option>
            <option value="risk_manager">风控经理</option>
            <option value="completed">已完成</option>
          </select>
        </div>
        <div class="filter-item">
          <label>预警：</label>
          <select value={fWarning()} onChange={e => setFWarning(e.target.value)}>
            <option value="">全部</option>
            <option value="normal">正常</option>
            <option value="warning">临期</option>
            <option value="overdue">逾期</option>
          </select>
        </div>
        <div class="filter-item">
          <label>关键字：</label>
          <input placeholder="合同号/名称/客户" value={fKeyword()} onInput={e => setFKeyword(e.target.value)} />
        </div>
        <button class="btn btn-primary" onClick={load}>🔍 查询</button>
        <button class="btn btn-default" onClick={() => { setFStatus(''); setFStage(''); setFWarning(''); setFKeyword(''); load(); }}>
          重置
        </button>
      </div>

      <div class="toolbar">
        <div>
          <span class="text-muted text-sm">
            共 {list().length} 条，已勾选
            <span class="text-primary text-bold ml-2 mr-2">{selected().size}</span>条
          </span>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-default" onClick={() => setShowCreate(true)}>➕ 新登记合同单</button>
          <button class="btn btn-warning" onClick={openBatch} disabled={selected().size === 0}>
            📦 批量处理 ({selected().size})
          </button>
        </div>
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th style="width:40px">
                <input type="checkbox" class="checkbox"
                  checked={list().length > 0 && selected().size === list().length}
                  onChange={toggleAll} />
              </th>
              <th>合同单号</th>
              <th>合同名称</th>
              <th>用电客户</th>
              <th>金额(元)</th>
              <th>状态</th>
              <th>当前环节</th>
              <th>截止日期</th>
              <th>预警</th>
              <th>版本</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <For each={list()} fallback={<tr><td colspan="11" class="empty">暂无数据</td></tr>}>
              {c => (
                <tr>
                  <td>
                    <input type="checkbox" class="checkbox"
                      checked={selected().has(c.id)}
                      onChange={() => toggleOne(c.id)} />
                  </td>
                  <td class="text-bold text-primary">{c.contract_no}</td>
                  <td>{c.contract_name}</td>
                  <td>{c.customer_name || '-'}</td>
                  <td>{(c.contract_amount || 0).toLocaleString()}</td>
                  <td><span class={`tag ${STATUS_TAGS[c.status] || 'tag-muted'}`}>{c.status}</span></td>
                  <td>{STAGE_NAMES[c.current_stage] || c.current_stage}</td>
                  <td>{c.deadline}</td>
                  <td>
                    <Show when={c.warning_level}>
                      <span class={tagFor(c.warning_level)}>
                        {WARNING_LABEL[c.warning_level]}
                        <Show when={c.warning_level === 'overdue'}>（{c.overdue_days}天）</Show>
                      </span>
                    </Show>
                  </td>
                  <td>V{c.version}</td>
                  <td>
                    <button class="btn btn-primary btn-sm" onClick={() => nav(`/contracts/${c.id}`)}>办理</button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      <Show when={showBatch()}>
        <BatchModal
          contracts={list().filter(c => selected().has(c.id))}
          onClose={() => setShowBatch(false)}
          onDone={() => { setShowBatch(false); setSelected(new Set()); setRefreshKey(k => k + 1); nav('/batch-result'); }}
        />
      </Show>

      <Show when={showCreate()}>
        <CreateContractModal
          onClose={() => setShowCreate(false)}
          onDone={() => { setShowCreate(false); setRefreshKey(k => k + 1); }}
        />
      </Show>
    </div>
  );
}
