import { createSignal, For, Show, onMount, createMemo } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { api, STATUS_TAGS, STAGE_NAMES, ROLE_NAMES } from '../store/auth.jsx';

export default function Warnings() {
  const nav = useNavigate();
  const [items, setItems] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [groupBy, setGroupBy] = createSignal('level');

  onMount(async () => {
    const r = await api.getOverdueResponsibles();
    if (r.success) setItems(r.data);
    setLoading(false);
  });

  const byLevel = createMemo(() => ({
    overdue: items().filter(i => i.warning_level === 'overdue'),
    warning: items().filter(i => i.warning_level === 'warning'),
    normal: items().filter(i => i.warning_level === 'normal'),
  }));

  const byRole = createMemo(() => {
    const groups = {};
    items().forEach(i => {
      const k = i.handler_role || '未分配';
      if (!groups[k]) groups[k] = [];
      groups[k].push(i);
    });
    return groups;
  });

  function tagFor(level) { return `warning-level-${level}`; }

  return (
    <div>
      <div class="breadcrumb">
        <a href="/contracts">首页</a>
        <span>/</span>
        <span>到期预警</span>
      </div>

      <div class="grid-3 mb-4">
        <div class="stat-card info">
          <div class="stat-label">🟢 正常</div>
          <div class="stat-value">{byLevel().normal.length}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">🟡 临期（≤3天）</div>
          <div class="stat-value text-warning">{byLevel().warning.length}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">🔴 逾期</div>
          <div class="stat-value text-danger">{byLevel().overdue.length}</div>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-title">
          <span>分组方式</span>
          <div class="flex gap-2">
            <button class={`btn ${groupBy() === 'level' ? 'btn-primary' : 'btn-default'} btn-sm`} onClick={() => setGroupBy('level')}>按预警等级</button>
            <button class={`btn ${groupBy() === 'role' ? 'btn-primary' : 'btn-default'} btn-sm`} onClick={() => setGroupBy('role')}>按责任人</button>
          </div>
        </div>

        <div class="alert alert-info"><span class="alert-icon">⏰</span>临期和逾期合同单需重点跟进，逾期会记录到 exception_records 并计入责任人考核。</div>
      </div>

      <Show when={groupBy() === 'level'}>
        <For each={[
          { key: 'overdue', title: '🔴 逾期队列（立即处理）', class: 'danger', items: byLevel().overdue },
          { key: 'warning', title: '🟡 临期队列（3天内到期）', class: 'warning', items: byLevel().warning },
          { key: 'normal', title: '🟢 正常队列', class: 'success', items: byLevel().normal },
        ]}>
          {group => (
            <div class="card">
              <div class="card-title">
                <span>{group.title}（{group.items.length}）</span>
              </div>
              <Show when={group.items.length}>
                <table>
                  <thead>
                    <tr>
                      <th>合同单号</th><th>合同/客户</th><th>当前状态</th><th>环节</th>
                      <th>责任人</th><th>截止</th><th>剩余/逾期</th><th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={group.items}>
                      {i => (
                        <tr>
                          <td class="text-bold text-primary">{i.contract_no}</td>
                          <td>
                            <div>{i.contract_name}</div>
                            <div class="text-sm text-muted">{i.customer_name}</div>
                          </td>
                          <td><span class={`tag ${STATUS_TAGS[i.status] || 'tag-muted'}`}>{i.status}</span></td>
                          <td>{STAGE_NAMES[i.current_stage]}</td>
                          <td>
                            <div>{i.handler_name || '<未分配>'}</div>
                            <div class="text-sm text-muted">{ROLE_NAMES[i.handler_role] || '-'}</div>
                          </td>
                          <td>{i.deadline}</td>
                          <td>
                            <span class={tagFor(i.warning_level)}>
                              {i.warning_level === 'overdue'
                                ? `已逾期 ${i.overdue_days} 天`
                                : i.warning_level === 'warning'
                                  ? `剩余 ${(() => { try { return (new Date(i.deadline) - new Date()) / 86400000 | 0; } catch { return '-'; } })()} 天`
                                  : '正常'}
                            </span>
                          </td>
                          <td>
                            <button class="btn btn-primary btn-sm" onClick={() => nav(`/contracts/${i.id}`)}>办理</button>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Show>
              <Show when={!group.items.length}><div class="empty">该组暂无数据 🎉</div></Show>
            </div>
          )}
        </For>
      </Show>

      <Show when={groupBy() === 'role'}>
        <For each={Object.entries(byRole())}>
          {([role, items]) => (
            <div class="card">
              <div class="card-title">
                <span>
                  <span class="tag tag-primary">{ROLE_NAMES[role] || role}</span>
                  <span class="ml-2">名下待办（{items.length}）</span>
                </span>
              </div>
              <Show when={items.length}>
                <table>
                  <thead>
                    <tr>
                      <th>合同单号</th><th>合同名称</th><th>客户</th><th>状态</th><th>预警</th><th>截止</th><th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={items}>
                      {i => (
                        <tr>
                          <td class="text-bold">{i.contract_no}</td>
                          <td>{i.contract_name}</td>
                          <td>{i.customer_name}</td>
                          <td><span class={`tag ${STATUS_TAGS[i.status] || 'tag-muted'}`}>{i.status}</span></td>
                          <td><span class={tagFor(i.warning_level)}>{i.warning_level === 'overdue' ? `逾期${i.overdue_days}天` : (i.warning_level === 'warning' ? '临期' : '正常')}</span></td>
                          <td>{i.deadline}</td>
                          <td><button class="btn btn-primary btn-sm" onClick={() => nav(`/contracts/${i.id}`)}>办理</button></td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Show>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
