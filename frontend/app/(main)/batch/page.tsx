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
  parseErrorMessage,
  formatDateTime,
  getResponsiblePerson,
  VALID_EXCEPTION_TYPES,
} from '@/lib/api';
import Link from 'next/link';

export default function BatchPage() {
  const [user, setUser] = useState<User | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [action, setAction] = useState('');
  const [remark, setRemark] = useState('');
  const [evidence, setEvidence] = useState('');
  const [exceptionType, setExceptionType] = useState<string>(VALID_EXCEPTION_TYPES[0]);
  const [exceptionReason, setExceptionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchProcessResponse | null>(null);
  const [error, setError] = useState('');
  const [queueFilter, setQueueFilter] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setUser(getUser());
    loadData();
  }, [queueFilter]);

  const loadData = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (queueFilter) params.queue = queueFilter;
      const res = await fetchApplications(params);
      const filtered = res.items.filter((a) => a.status !== '签收完成');
      setApps(filtered);
      const newSelected = new Set(selected);
      filtered.forEach((a) => {
        if (!newSelected.has(a.id)) newSelected.delete(a.id);
      });
      setSelected(newSelected);
    } catch (err: any) {
      const parsed = parseErrorMessage(err);
      setError(parsed.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    setCurrentIndex(0);

    try {
      const items = Array.from(selected).map((id) => {
        const app = apps.find((a) => a.id === id);
        return { application_id: id, version: app?.version || 1 };
      });

      const res = await batchProcess(action, items, remark, evidence, exceptionType, exceptionReason);
      setBatchResult(res);
      setCurrentIndex(items.length);

      const successIds = res.results.filter((r) => r.success).map((r) => r.application_id);
      const newSelected = new Set(selected);
      successIds.forEach((id) => newSelected.delete(id));
      setSelected(newSelected);

      setTimeout(() => loadData(true), 500);
    } catch (err: any) {
      const parsed = parseErrorMessage(err);
      setError(parsed.message);
    } finally {
      setProcessing(false);
    }
  };

  const availableActions = getBatchActions(user?.role || '');

  const selectedApps = apps.filter((a) => selected.has(a.id));
  const hasOverdue = selectedApps.some((a) => a.due_status === '逾期');

  if (!user) return <div>加载中...</div>;

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600 }}>📦 批量处理</h2>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
            月底集中处理 · 逐条校验版本、状态、权限 · 失败不影响成功 · 每条返回原因
            {hasOverdue && <span style={{ color: '#dc2626', marginLeft: '8px' }}>⚠️ 已选中包含逾期申请，将被逐条拦截</span>}
          </p>
        </div>
        <button
          className="btn btn-sm"
          onClick={() => loadData(true)}
          disabled={refreshing || processing}
        >
          {refreshing ? '刷新中...' : '🔄 刷新'}
        </button>
      </div>

      {error && <div className="alert alert-error">
        {error}
        <button className="btn btn-sm" style={{ marginLeft: '12px' }} onClick={() => loadData()}>
          重试
        </button>
      </div>}

      <div className="batch-bar">
        <span>
          已选 <strong style={{ color: '#1e40af', fontSize: '16px' }}>{selected.size}</strong> 项
          {processing && <span style={{ marginLeft: '12px', color: '#64748b' }}>
            处理中... {currentIndex}/{selected.size}
          </span>}
        </span>

        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setBatchResult(null);
            setExceptionReason('');
          }}
          disabled={selected.size === 0 || processing}
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
          disabled={processing}
        />

        {(action === '审核通过' || action === '复核通过') && (
          <input
            type="text"
            placeholder="审核证据 *"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            style={{ width: '240px' }}
            disabled={processing}
          />
        )}

        {action === '退回补正' && (
          <>
            <select
              value={exceptionType}
              onChange={(e) => setExceptionType(e.target.value)}
              disabled={processing}
              style={{ width: '140px' }}
            >
              {VALID_EXCEPTION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="退回原因 *（如：缺身份证复印件、住址证明无效等）"
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value)}
              style={{ width: '360px' }}
              disabled={processing}
            />
          </>
        )}

        <button
          className="btn btn-primary"
          onClick={handleBatch}
          disabled={
            selected.size === 0 ||
            !action ||
            processing ||
            ((action === '审核通过' || action === '复核通过') && !evidence.trim()) ||
            (action === '退回补正' && !exceptionReason.trim())
          }
        >
          {processing ? `处理中 ${currentIndex}/${selected.size}...` : `批量${action || '处理'}`}
        </button>
      </div>

      {batchResult && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              批量处理结果
              <span style={{ marginLeft: '12px', fontSize: '13px', fontWeight: 'normal' }}>
                成功 <span style={{ color: '#16a34a', fontWeight: 600 }}>{batchResult.success_count}</span>
                ，失败 <span style={{ color: '#dc2626', fontWeight: 600 }}>{batchResult.fail_count}</span>
                ，共 {batchResult.total} 条
              </span>
            </span>
            <button className="btn btn-sm" onClick={() => setBatchResult(null)}>
              收起
            </button>
          </div>
          <div style={{ maxHeight: '300px', overflow: 'auto' }}>
            {batchResult.results.map((r) => {
              const parsed = parseErrorMessage({ message: r.message });
              return (
                <div
                  key={r.application_id}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px dashed #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    alignItems: 'flex-start',
                    background: r.success ? '#f0fdf4' : '#fef2f2',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                    <div>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.application_no}</span>
                      <span style={{ marginLeft: '8px' }}>{r.success ? '✅' : '❌'}</span>
                      <span style={{ marginLeft: '8px', color: '#64748b' }}>
                        提交版本 v{r.version}
                        {r.new_version && ` → 当前版本 v${r.new_version}`}
                      </span>
                    </div>
                    {parsed.code !== 'E000' && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                        错误码: {parsed.code}
                        {parsed.whoFix && ` · 需${parsed.whoFix}处理`}
                      </div>
                    )}
                    {r.success && r.exception_reason && (
                      <div style={{
                        marginTop: '6px',
                        padding: '8px 10px',
                        background: '#fff7ed',
                        border: '1px solid #fed7aa',
                        borderRadius: '4px',
                        fontSize: '12px',
                        lineHeight: 1.6,
                      }}>
                        <div style={{ fontWeight: 600, color: '#9a3412', marginBottom: '2px' }}>
                          📋 补正要求
                        </div>
                        <div>
                          <span className="badge badge-red" style={{ marginRight: '6px' }}>
                            {r.exception_type}
                          </span>
                          <span style={{ color: '#7c2d12' }}>{r.exception_reason}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#a16207', marginTop: '4px' }}>
                          已推送至客户经理待补正队列，请客户经理尽快处理后重提
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{
                    color: r.success ? '#16a34a' : '#dc2626',
                    textAlign: 'right',
                    maxWidth: '45%',
                    wordBreak: 'break-word',
                    marginLeft: '12px',
                  }}>
                    {r.message}
                    {r.new_status && (
                      <div style={{ fontSize: '11px', marginTop: '2px' }}>
                        状态变更 → {r.new_status}
                        {r.new_role && `（${r.new_role}）`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748b' }}>
            💡 成功项已从列表移除，失败项请根据错误码处理后重试。
            {batchResult.fail_count > 0 && (
              <span style={{ marginLeft: '8px' }}>
                可前往详情页查看具体原因后单条处理。
              </span>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="filter-bar">
          <select value={queueFilter} onChange={(e) => setQueueFilter(e.target.value)} disabled={processing}>
            <option value="">全部待处理</option>
            {user.role === '运营主管' && (
              <>
                <option value="pending">待签收</option>
                <option value="my">我签收的</option>
                <option value="returned">异常回传</option>
              </>
            )}
            {user.role === '支行行长' && (
              <>
                <option value="pending">待签收</option>
                <option value="my">我签收的</option>
              </>
            )}
          </select>

          <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748b' }}>
            共 <strong>{apps.length}</strong> 条待处理
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '16px' }}>⏳ 加载中...</div>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
            <div>加载失败</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: '12px' }} onClick={() => loadData()}>
              重新加载
            </button>
          </div>
        ) : apps.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
            <div>暂无待处理申请</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              所有申请已处理完毕
            </div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={selected.size === apps.length && apps.length > 0}
                    onChange={toggleSelectAll}
                    disabled={processing}
                  />
                </th>
                <th>申请编号</th>
                <th>客户姓名</th>
                <th>账户类型</th>
                <th>金额</th>
                <th>当前阶段</th>
                <th>状态</th>
                <th>到期状态</th>
                <th>版本</th>
                <th>责任人</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr
                  key={app.id}
                  style={{
                    background:
                      selected.has(app.id) ? '#eff6ff' :
                      app.due_status === '逾期' ? '#fef2f2' :
                      app.due_status === '临期' ? '#fefce8' : undefined,
                    opacity: processing && selected.has(app.id) ? 0.5 : 1,
                  }}
                >
                  <td className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={selected.has(app.id)}
                      onChange={() => toggleSelect(app.id)}
                      disabled={processing}
                    />
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{app.application_no}</td>
                  <td>{app.customer_name}</td>
                  <td>{app.account_type}</td>
                  <td>¥{app.amount.toLocaleString()}</td>
                  <td>
                    <span className="badge badge-gray">{app.current_role || '-'}</span>
                  </td>
                  <td>
                    <span className={`badge ${statusBadge(app.status)}`}>{app.status}</span>
                  </td>
                  <td>
                    <span className={`badge ${dueBadge(app.due_status)}`}>{app.due_status}</span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>v{app.version}</td>
                  <td>{getResponsiblePerson(app)}</td>
                  <td style={{ fontSize: '12px', color: '#64748b' }}>
                    {formatDateTime(app.created_at)}
                  </td>
                  <td>
                    <Link href={`/applications/${app.id}`} className="btn btn-sm">
                      详情
                    </Link>
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
          <p>• <strong>批量退回补正</strong>：必须选择异常类型并填写退回原因，批量将申请打回客户经理补正队列</p>
          <p>• <strong>退回异常原因（E012）</strong>：退回补正必须填写具体原因，说明需要补正哪些材料</p>
          <p>• <strong>退回规则</strong>：仅运营主管和支行行长可退回，退回后状态变为「异常回传」，阶段变为客户经理</p>
          <p>• <strong>退回持久化</strong>：每条退回自动写入异常原因表、处理记录表，详情页可追溯完整补正要求</p>
          <p>• <strong>版本冲突（E002）</strong>：提交版本与当前版本不一致时，保留原值并提示刷新</p>
          <p>• <strong>阶段越权（E004）</strong>：非本阶段角色操作会被拒绝</p>
          <p>• <strong>处理人不符（E007）</strong>：非当前签收人操作会被拒绝，需先签收</p>
          <p>• <strong>缺证据拦截（E011）</strong>：审核通过必须提供已核查材料清单</p>
          <p>• <strong>状态冲突（E005）</strong>：当前状态不匹配操作要求时，保留原值并提示需谁补正</p>
          <p>• <strong>并发冲突（E013）</strong>：更新影响0行时提示并发冲突，需刷新重试</p>
          <p>• <strong>逾期拦截</strong>：逾期申请需先处理超时责任，批量推进时逐条拦截</p>
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
