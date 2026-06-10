import { createSignal, For, Show, onMount, createMemo } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { api, useAuth } from '../store/auth.jsx';

export default function BatchResult() {
  const nav = useNavigate();
  const { user, batchResults } = useAuth();
  const [results, setResults] = createSignal([]);
  const [filter, setFilter] = createSignal('all');

  onMount(() => {
    if (batchResults && batchResults()) {
      setResults(batchResults());
    } else {
      nav('/contracts');
    }
  });

  const filtered = createMemo(() => {
    if (filter() === 'success') return results().filter(r => r.success);
    if (filter() === 'failed') return results().filter(r => !r.success);
    return results();
  });

  const successCount = () => results().filter(r => r.success).length;
  const failedCount = () => results().filter(r => !r.success).length;

  return (
    <div>
      <div class="breadcrumb">
        <a href="/contracts">售电合同单列表</a>
        <span>/</span>
        <span>批量处理结果</span>
      </div>

      <div class="grid-3 mb-4">
        <div class="stat-card">
          <div class="stat-label">共处理</div>
          <div class="stat-value">{results().length}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">成功</div>
          <div class="stat-value text-success">{successCount()}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">失败 / 拦截</div>
          <div class="stat-value text-danger">{failedCount()}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>逐条结果（{user().real_name}）</span>
          <div class="flex gap-2">
            {[
              ['all', '全部'],
              ['success', '仅成功'],
              ['failed', '仅失败/拦截'],
            ].map(([k, l]) => (
              <button class={`btn ${filter() === k ? 'btn-primary' : 'btn-default'} btn-sm`} onClick={() => setFilter(k)}>
                {l}
              </button>
            ))}
            <button class="btn btn-default btn-sm" onClick={() => nav('/contracts')}>返回列表</button>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>合同单号</th>
              <th>结果</th>
              <th>原因 / 说明</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <For each={filtered()} fallback={<tr><td colspan="4" class="empty">暂无结果</td></tr>}>
              {r => (
                <tr>
                  <td class="text-bold">{r.contract_no}</td>
                  <td>
                    {r.success
                      ? <span class="tag tag-success">✅ 成功</span>
                      : <span class="tag tag-danger">❌ 失败/拦截</span>}
                  </td>
                  <td style="max-width:640px;word-break:break-all">
                    {r.reason}
                  </td>
                  <td>
                    <button class="btn btn-primary btn-sm" onClick={() => nav(`/contracts/${r.contract_id}`)}>
                      查看详情
                    </button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>

        <div class="alert alert-info mt-4">
          <span class="alert-icon">ℹ️</span>
          <div>
            失败记录已写入 <b>exception_records</b> 表，可在详情页「异常原因」页签查看；
            成功记录已同步写入 <b>processing_records</b> 和 <b>audit_notes</b> 表，合同单状态已回写。
            刷新列表后所有数据保持一致。
          </div>
        </div>
      </div>
    </div>
  );
}
