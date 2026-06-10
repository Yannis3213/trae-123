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

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    const selectable = apps.filter((a) => !a.is_overdue);
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

  const selectableApps = apps.filter((a) => !a.is_overdue);
  const overdueApps = apps.filter((a) => a.is_overdue);

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
            {batchResult.results.map((r) => (
              <div
                key={r.application_id}
                className={`batch-result-item ${r.success ? 'success' : 'failed'}`}
              >
                <strong>{r.application_no}</strong>
                <span style={{ marginLeft: '10px' }}>{r.success ? '✅' : '❌'}</span>
                <span style={{ marginLeft: '10px' }}>{r.message}</span>
              </div>
            ))}
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
                  <strong>{a.application_no}</strong> — {a.title}（{a.store_name}）
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
                <th>优先级</th>
                <th>状态</th>
                <th>截止时间</th>
                <th>预警</th>
                <th>版本</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="empty-state">
                    <span className="spinner" /> 加载中...
                  </td>
                </tr>
              ) : apps.length === 0 ? (
                <tr>
                  <td colSpan={10} className="empty-state">
                    暂无可批量处理的单据
                  </td>
                </tr>
              ) : (
                apps.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(app.id)}
                        onChange={() => toggleSelect(app.id)}
                        disabled={app.is_overdue}
                        style={{ minWidth: 'auto' }}
                      />
                    </td>
                    <td>
                      <strong>{app.application_no}</strong>
                    </td>
                    <td>{app.store_name}</td>
                    <td>{app.title}</td>
                    <td>{getUserName(app.responsible_person)}</td>
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
                    <td>{new Date(app.deadline).toLocaleString('zh-CN')}</td>
                    <td className={app.is_overdue ? 'warning-overdue' : app.is_near_deadline ? 'warning-near' : 'warning-normal'}>
                      {app.is_overdue ? '已逾期（拦截）' : app.is_near_deadline ? '临近截止' : '正常'}
                    </td>
                    <td>v{app.version}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
