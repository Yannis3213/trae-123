'use client';

import { useEffect, useState } from 'react';
import {
  fetchApplications,
  Application,
  getUser,
  User,
  batchProcess,
  BatchProcessResponse,
  BatchResultItem,
} from '@/lib/api';
import Link from 'next/link';

export default function BatchPage() {
  const [user, setUser] = useState<User | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [action, setAction] = useState('');
  const [remark, setRemark] = useState('');
  const [evidence, setEvidence] = useState('');
  const [processing, setProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchProcessResponse | null>(null);
  const [error, setError] = useState('');
  const [queueFilter, setQueueFilter] = useState('');

  useEffect(() => {
    setUser(getUser());
    loadData();
  }, [queueFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (queueFilter) params.queue = queueFilter;
      const res = await fetchApplications(params);
      setApps(res.items.filter((a) => a.status !== '签收完成'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
    setBatchResult(null);
  };

  const toggleSelectAll = () => {
    if (selected.size === apps.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(apps.map((a) => a.id)));
    }
    setBatchResult(null);
  };

  const handleBatch = async () => {
    if (selected.size === 0) return;
    if (!action) return;

    setProcessing(true);
    setError('');
    setBatchResult(null);

    try {
      const items = Array.from(selected).map((id) => {
        const app = apps.find((a) => a.id === id);
        return { application_id: id, version: app?.version || 1 };
      });

      const res = await batchProcess(action, items, remark, evidence);
      setBatchResult(res);

      const successIds = res.results.filter((r) => r.success).map((r) => r.application_id);
      const newSelected = new Set(selected);
      successIds.forEach((id) => newSelected.delete(id));
      setSelected(newSelected);

      loadData();
    } catch (err: any) {
      setError(err.message || '批量处理失败');
    } finally {
      setProcessing(false);
    }
  };

  const availableActions = getBatchActions(user?.role || '');

  if (!user) return <div>加载中...</div>;

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600 }}>📦 批量处理</h2>
        <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
          月底集中处理 · 逐条校验版本、状态、权限 · 失败不影响成功 · 每条返回原因
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="batch-bar">
        <span>
          已选 <strong style={{ color: '#1e40af', fontSize: '16px' }}>{selected.size}</strong> 项
        </span>

        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          disabled={selected.size === 0}
        >
          <option value="">选择批量操作...</option>
          {availableActions.map((a) => (
            <option key={a.action} value={a.action}>{a.label}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="备注（可选）"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          style={{ width: '200px' }}
        />

        {(action === '审核通过' || action === '复核通过') && (
          <input
            type="text"
            placeholder="审核证据 *"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            style={{ width: '240px' }}
          />
        )}

        <button
          className="btn btn-primary"
          onClick={handleBatch}
          disabled={selected.size === 0 || !action || processing}
        >
          {processing ? '处理中...' : `批量${action || '处理'}`}
        </button>
      </div>

      {batchResult && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-title">
            批量处理结果
            <span style={{ marginLeft: '12px', fontSize: '13px', fontWeight: 'normal' }}>
              成功 <span style={{ color: '#16a34a', fontWeight: 600 }}>{batchResult.success_count}</span>
              ，失败 <span style={{ color: '#dc2626', fontWeight: 600 }}>{batchResult.fail_count}</span>
              ，共 {batchResult.total} 条
            </span>
          </div>
          <div style={{ maxHeight: '300px', overflow: 'auto' }}>
            {batchResult.results.map((r) => (
              <div
                key={r.application_id}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px dashed #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                }}
              >
                <div>
                  <span style={{ fontFamily: 'monospace' }}>{r.application_no}</span>
                  <span style={{ marginLeft: '8px' }}>{r.success ? '✅' : '❌'}</span>
                </div>
                <div style={{ color: r.success ? '#16a34a' : '#dc2626' }}>
                  {r.message}
                  {r.new_status && ` → ${r.new_status}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="filter-bar">
          <select value={queueFilter} onChange={(e) => setQueueFilter(e.target.value)}>
            <option value="">全部待处理</option>
            {user.role === '运营主管' && (
              <>
                <option value="my">我签收的</option>
                <option value="returned">异常回传</option>
              </>
            )}
            {user.role === '支行行长' && (
              <>
                <option value="my">我签收的</option>
              </>
            )}
          </select>

          <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748b' }}>
            共 {apps.length} 条待处理
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>
        ) : apps.length === 0 ? (
          <div className="empty-state">暂无待处理申请</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={selected.size === apps.length && apps.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>申请编号</th>
                <th>客户姓名</th>
                <th>账户类型</th>
                <th>金额</th>
                <th>状态</th>
                <th>到期状态</th>
                <th>版本</th>
                <th>当前处理人</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} style={selected.has(app.id) ? { background: '#eff6ff' } : undefined}>
                  <td className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={selected.has(app.id)}
                      onChange={() => toggleSelect(app.id)}
                    />
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{app.application_no}</td>
                  <td>{app.customer_name}</td>
                  <td>{app.account_type}</td>
                  <td>¥{app.amount.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${statusBadge(app.status)}`}>{app.status}</span>
                  </td>
                  <td>
                    <span className={`badge ${dueBadge(app.due_status)}`}>{app.due_status}</span>
                  </td>
                  <td>v{app.version}</td>
                  <td>{app.current_handler || '-'}</td>
                  <td>
                    <Link href={`/applications/${app.id}`} className="btn btn-sm">详情</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-title">批量处理说明</div>
        <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.8 }}>
          <p>• <strong>逐条校验</strong>：每条申请独立校验角色、处理人、状态、版本，失败不影响其他</p>
          <p>• <strong>版本冲突</strong>：提交版本与当前版本不一致时，保留原值并提示</p>
          <p>• <strong>越权拦截</strong>：非当前处理人或非对应角色操作会被拒绝</p>
          <p>• <strong>缺证据拦截</strong>：审核通过必须提供已核查材料清单</p>
          <p>• <strong>状态冲突</strong>：当前状态不匹配操作要求时，保留原值并提示需谁补正</p>
          <p>• <strong>结果明细</strong>：每条返回成功/失败及原因，可在详情中查看操作记录</p>
        </div>
      </div>
    </div>
  );
}

function statusBadge(s: string) {
  switch (s) {
    case '待签收': return 'badge-blue';
    case '异常回传': return 'badge-red';
    case '签收完成': return 'badge-green';
    default: return 'badge-gray';
  }
}

function dueBadge(d: string) {
  switch (d) {
    case '正常': return 'badge-green';
    case '临期': return 'badge-yellow';
    case '逾期': return 'badge-red';
    default: return 'badge-gray';
  }
}

function getBatchActions(role: string): { action: string; label: string }[] {
  switch (role) {
    case '运营主管':
      return [
        { action: '签收', label: '批量签收' },
        { action: '审核通过', label: '批量审核通过' },
        { action: '退回补正', label: '批量退回补正' },
      ];
    case '支行行长':
      return [
        { action: '签收', label: '批量签收' },
        { action: '复核通过', label: '批量复核通过' },
        { action: '退回补正', label: '批量退回补正' },
      ];
    default:
      return [];
  }
}
