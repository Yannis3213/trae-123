import { useEffect, useState } from 'react';
import { applicationApi } from '../api/client';
import type {
  ReplenishmentApplication,
  User,
  BatchProcessResponse,
} from '../types';
import {
  STATUS_DISPLAY,
  STATUS_COLOR,
  PRIORITY_DISPLAY,
  PRIORITY_COLOR,
  ACTION_LABELS,
} from '../types';
import { useAuthStore } from '../store/auth';

interface BatchProcessPanelProps {
  users: User[];
}

export default function BatchProcessPanel({ users }: BatchProcessPanelProps) {
  const { user } = useAuthStore();
  const [apps, setApps] = useState<ReplenishmentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<string>('');
  const [resultText, setResultText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchProcessResponse | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchData = () => {
    setLoading(true);
    applicationApi
      .list({ mine: true })
      .then((data) => {
        const actionable = data.filter(
          (a) => a.status !== 'archived' && (!user || a.current_handler === user.id)
        );
        setApps(actionable);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const getUserName = (id: string) =>
    users.find((u) => u.id === id)?.display_name || id;

  const classifyFailure = (msg: string): { label: string; color: string; detail: string } => {
    if (msg.includes('版本') || msg.includes('version') || msg.includes('旧版本')) {
      return { label: '版本冲突', color: '#ea580c', detail: '数据已被其他用户更新，请刷新页面后重试。后端使用乐观锁 version 字段拦截并发修改。' };
    }
    if (msg.includes('越权') || msg.includes('无权') || msg.includes('权限') || msg.includes('permission')) {
      return { label: '越权操作', color: '#dc2626', detail: '当前账号不是该单据的处理人，或角色不在动作白名单内。可办理人：当前处理人 / 创建人 / 责任人。请切换到正确账号后办理。' };
    }
    if (msg.includes('伪证据') || (msg.includes('证据') && msg.includes('退回'))) {
      return { label: '历史伪证据无效', color: '#c2410c', detail: msg + ' — 必须在退回时刻之后重新上传 is_evidence=true 的附件作为补正证据。请进入详情页查看附件分类并重新上传。' };
    }
    if (msg.includes('证据') || msg.includes('材料') || msg.includes('附件') || msg.includes('必填')) {
      return { label: '缺材料', color: '#b45309', detail: '该操作要求上传附件或填写办理结果作为必填证据。补正动作还要求证据在退回时刻之后上传。请进入详情页补正后再试。' };
    }
    if (msg.includes('逾期') || msg.includes('overdue') || msg.includes('截止')) {
      return { label: '已逾期', color: '#991b1b', detail: '单据已超过截止时间，批量处理被自动拦截。请进入详情页逐条处理，留下补正动作与异常原因。' };
    }
    if (msg.includes('状态') || msg.includes('status') || msg.includes('冲突')) {
      return { label: '状态冲突', color: '#c026d3', detail: '当前状态不允许执行该操作，或单据已被他人流转。请刷新列表确认最新状态。' };
    }
    if (msg.includes('归档') || msg.includes('archived')) {
      return { label: '已归档', color: '#64748b', detail: '该单据已归档，禁止任何修改。' };
    }
    return { label: '办理失败', color: '#dc2626', detail: msg };
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const isRowSelectable = (a: ReplenishmentApplication) =>
    !a.is_overdue && a.status !== 'exception_returned';

  const toggleSelectAll = () => {
    const selectable = apps.filter(isRowSelectable);
    if (selectedIds.size === selectable.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectable.map((a) => a.id)));
  };

  const availableBatchActions: { key: string; label: string }[] = [
    { key: 'sign', label: '批量签收' },
    { key: 'complete', label: '批量完成确认' },
    { key: 'archive', label: '批量归档' },
  ];

  const handleBatch = async () => {
    if (selectedIds.size === 0 || !batchAction || !user) return;
    setProcessing(true);
    setBatchResult(null);
    try {
      const items = Array.from(selectedIds).map((id) => {
        const app = apps.find((a) => a.id === id)!;
        return {
          application_id: id,
          action: batchAction,
          result: resultText || null,
          return_reason: null,
          current_version: app.version,
        };
      });
      const resp = await applicationApi.batchProcess({ items });
      setBatchResult(resp);
      fetchData();
      setSelectedIds(new Set());
    } catch (e: any) {
      console.error('Batch error:', e);
    } finally {
      setProcessing(false);
    }
  };

  const selectableApps = apps.filter(isRowSelectable);
  const overdueApps = apps.filter((a) => a.is_overdue);
  const blockedEvidenceApps = apps.filter((a) => a.status === 'exception_returned');

  return (
    <div>
      <div className="page-header">
        <div className="page-title">批量处理</div>
        <div className="page-subtitle">
          批量结果按单据逐条展示成功/失败原因；已逾期单据将被自动拦截，需在详情页留下补正动作和异常原因
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
          <select
            value={batchAction}
            onChange={(e) => setBatchAction(e.target.value)}
            style={{ minWidth: '160px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
          >
            <option value="">选择批量动作</option>
            {availableBatchActions.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="批量办理结果（可选）"
            value={resultText}
            onChange={(e) => setResultText(e.target.value)}
            style={{ flex: 1, minWidth: '240px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
          />
          <button
            className="btn btn-primary"
            onClick={handleBatch}
            disabled={!batchAction || selectedIds.size === 0 || processing}
          >
            {processing ? (
              <>
                <span className="spinner" /> 处理中
              </>
            ) : (
              <>执行批量（{selectedIds.size} 条）</>
            )}
          </button>
          <button className="btn" onClick={fetchData}>
            🔄 刷新
          </button>
        </div>

        {batchResult && (
          <div style={{ marginBottom: '16px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
            <div className="batch-result-summary">
              <span style={{ color: '#16a34a' }}>✅ 成功 {batchResult.total_success}</span>
              <span style={{ margin: '0 16px', color: '#d1d5db' }}>|</span>
              <span style={{ color: '#dc2626' }}>❌ 失败 {batchResult.total_failed}</span>
              <span style={{ margin: '0 16px', color: '#d1d5db' }}>|</span>
              <span>共 {batchResult.results.length} 条</span>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', marginBottom: '12px' }}>
              失败原因已按「版本冲突 / 越权 / 缺材料 / 逾期 / 状态冲突」自动分类，所有拦截均已同时写入对应补货申请的统一审计轨迹。
            </div>
            {batchResult.results.map((r) => {
              const failure = !r.success ? classifyFailure(r.message) : null;
              const expanded = expandedIds.has(r.application_id);
              return (
                <div
                  key={r.application_id}
                  className={`batch-result-item ${r.success ? 'success' : 'failed'}`}
                  style={{ flexWrap: 'wrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', flex: 1 }}>
                    <strong>{r.application_no}</strong>
                    <span>{r.success ? '✅' : '❌'}</span>
                    {failure && (
                      <span
                        className="tag tag-red"
                        style={{ background: failure.color, color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}
                      >
                        {failure.label}
                      </span>
                    )}
                    <span style={{ color: r.success ? '#166534' : '#b91c1c' }}>{r.message}</span>
                  </div>
                  {failure && (
                    <button
                      className="btn"
                      style={{ marginLeft: 'auto', padding: '2px 10px', fontSize: '12px', minWidth: 'auto' }}
                      onClick={() => toggleExpand(r.application_id)}
                    >
                      {expanded ? '收起详情' : '查看详情'}
                    </button>
                  )}
                  {expanded && failure && (
                    <div
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        padding: '10px 14px',
                        background: '#fff',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#374151',
                      }}
                    >
                      <div style={{ marginBottom: '6px' }}>
                        <strong style={{ color: failure.color }}>异常类型：</strong>
                        {failure.label}
                      </div>
                      <div style={{ marginBottom: '6px' }}>
                        <strong>服务端消息：</strong>
                        {r.message}
                      </div>
                      <div>
                        <strong>处理建议：</strong>
                        {failure.detail}
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#92400e' }}>
                        ℹ️ 该异常已自动写入单据 {r.application_no} 的「异常日志」统一轨迹，可在详情页查看完整审计记录。
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {overdueApps.length > 0 && (
          <div
            style={{
              padding: '12px 16px',
              background: '#fef2f2',
              color: '#b91c1c',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '14px',
            }}
          >
            ⚠️ 以下 {overdueApps.length} 条单据已逾期，将被批量处理拦截，需逐条处理：
            <ul style={{ margin: '8px 0 0 20px' }}>
              {overdueApps.map((a) => (
                <li key={a.id}>
                  <strong>{a.application_no}</strong> — {a.title}（{a.store_name}，当前处理人：{getUserName(a.current_handler)}）
                </li>
              ))}
            </ul>
          </div>
        )}

        {blockedEvidenceApps.length > 0 && (
          <div
            style={{
              padding: '12px 16px',
              background: '#fff7ed',
              color: '#9a3412',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '14px',
            }}
          >
            ⚠️ 以下 {blockedEvidenceApps.length} 条单据为「异常回传」状态且缺少有效补正证据，不可批量推进：
            <ul style={{ margin: '8px 0 0 20px' }}>
              {blockedEvidenceApps.map((a) => (
                <li key={a.id}>
                  <strong>{a.application_no}</strong> — {a.title}（{a.store_name}，当前处理人：{getUserName(a.current_handler)}）
                  — 需进入详情页上传退回时刻之后的 is_evidence=true 附件作为有效补正证据
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === selectableApps.length}
                    onChange={toggleSelectAll}
                    style={{ minWidth: 'auto' }}
                  />
                </th>
                <th>单据号</th>
                <th>门店</th>
                <th>标题</th>
                <th>责任人</th>
                <th>当前处理人</th>
                <th>优先级</th>
                <th>状态</th>
                <th>异常标签</th>
                <th>截止时间</th>
                <th>预警</th>
                <th>版本</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="empty-state">
                    <span className="spinner" /> 加载中...
                  </td>
                </tr>
              ) : apps.length === 0 ? (
                <tr>
                  <td colSpan={12} className="empty-state">
                    暂无可批量处理的单据
                  </td>
                </tr>
              ) : (
                apps.map((app) => {
                  const blockedForEvidence = app.status === 'exception_returned';
                  const rowDisabled = app.is_overdue || blockedForEvidence;
                  return (
                    <tr key={app.id} style={{ background: rowDisabled ? '#fff7ed' : undefined }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(app.id)}
                          onChange={() => toggleSelect(app.id)}
                          disabled={rowDisabled}
                          style={{ minWidth: 'auto' }}
                          title={
                            app.is_overdue ? '已逾期，批量处理自动拦截'
                            : blockedForEvidence ? '异常回传单需先在详情页补正有效证据，不可批量推进'
                            : ''
                          }
                        />
                      </td>
                      <td>
                        <strong>{app.application_no}</strong>
                      </td>
                      <td>{app.store_name}</td>
                      <td>{app.title}</td>
                      <td>{getUserName(app.responsible_person)}</td>
                      <td>
                        <strong>{getUserName(app.current_handler)}</strong>
                      </td>
                      <td>
                        <span
                          className="priority-dot"
                          style={{ background: PRIORITY_COLOR[app.priority] }}
                        />
                        {PRIORITY_DISPLAY[app.priority]}
                      </td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ background: STATUS_COLOR[app.status] }}
                        >
                          {STATUS_DISPLAY[app.status]}
                        </span>
                      </td>
                      <td>
                        {app.exception_tags.length === 0 ? (
                          <span style={{ color: '#9ca3af' }}>无</span>
                        ) : (
                          app.exception_tags.map((t, i) => (
                            <span key={i} className={`tag ${t.includes('逾期') || t.includes('异常') ? 'tag-red' : 'tag-blue'}`} style={{ marginRight: '4px' }}>
                              {t}
                            </span>
                          ))
                        )}
                      </td>
                      <td>{new Date(app.deadline).toLocaleString('zh-CN')}</td>
                      <td className={app.is_overdue ? 'warning-overdue' : app.is_near_deadline ? 'warning-near' : 'warning-normal'}>
                        {app.is_overdue ? '已逾期' : app.is_near_deadline ? '临近截止' : '正常'}
                        {blockedForEvidence && !app.is_overdue && (
                          <span style={{ color: '#9a3412', marginLeft: '4px' }}>（缺补正证据）</span>
                        )}
                      </td>
                      <td>v{app.version}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
