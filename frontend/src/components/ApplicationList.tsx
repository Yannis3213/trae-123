import { useState, useEffect, useCallback } from 'react';
import {
  api,
  type StudentApplication,
  type EvidenceSummary,
  type BatchResult,
  type User,
} from '../lib/api';

interface Props {
  user: User;
  onViewDetail: (id: string) => void;
  globalRefreshCounter: number;
}

export default function ApplicationList({ user, onViewDetail, globalRefreshCounter }: Props) {
  const [applications, setApplications] = useState<StudentApplication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState('');
  const [batchRemark, setBatchRemark] = useState('');
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [apps, stats] = await Promise.all([
        api.listApplications({ status: statusFilter, urgency: urgencyFilter }),
        api.getStatistics(),
      ]);
      setApplications(apps);
      setStatistics(stats);
      if (selectedId) {
        const found = apps.find((a) => a.id === selectedId);
        if (!found) {
          setSelectedId(null);
          setSelectedEvidence(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, urgencyFilter, selectedId]);

  useEffect(() => {
    loadData();
  }, [statusFilter, urgencyFilter, user.id, globalRefreshCounter]);

  const refreshAll = async () => {
    await loadData();
    if (selectedId) {
      try {
        const detail = await api.getApplication(selectedId);
        setSelectedEvidence(detail.evidence_summary);
      } catch {}
    }
  };

  const viewDetail = async (app: StudentApplication) => {
    setSelectedId(app.id);
    try {
      const detail = await api.getApplication(app.id);
      setSelectedEvidence(detail.evidence_summary);
    } catch {}
    onViewDetail(app.id);
  };

  const updateEvidenceForRow = async (appId: string) => {
    try {
      const detail = await api.getApplication(appId);
      setSelectedEvidence(detail.evidence_summary);
      setSelectedId(appId);
    } catch {}
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === applications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(applications.map((a) => a.id)));
    }
  };

  const handleBatch = async () => {
    if (!batchAction || selectedIds.size === 0) return;
    try {
      const res = await api.batchProcess([...selectedIds], batchAction, batchRemark);
      setBatchResults(res.results);
      setSelectedIds(new Set());
      setBatchAction('');
      setBatchRemark('');
      await refreshAll();
    } catch (e: any) {
      alert('批量处理失败: ' + e.message);
    }
  };

  const getUrgencyBadge = (u: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      normal: { cls: 'badge-normal', label: '正常' },
      warning: { cls: 'badge-warning', label: '临期' },
      overdue: { cls: 'badge-overdue', label: '逾期' },
    };
    const cfg = map[u] || map.normal;
    return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
  };

  const getStatusBadge = (s: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      待分派: { cls: 'badge-pending', label: '待分派' },
      已转办: { cls: 'badge-transferred', label: '已转办' },
      已回访: { cls: 'badge-visited', label: '已回访' },
    };
    const cfg = map[s] || map['待分派'];
    return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
  };

  const batchActions =
    user.role === 'registrar'
      ? [{ value: 'assign', label: '分派至审核主管' }]
      : user.role === 'auditor'
      ? [{ value: 'audit_pass', label: '审核通过至复核' }]
      : [];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
        {statistics && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>全部单据</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#1e3a8a' }}>
                {statistics.total}
              </div>
            </div>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>待分派</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#92400e' }}>
                {statistics.pending}
              </div>
            </div>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>已转办</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#1e40af' }}>
                {statistics.transferred}
              </div>
            </div>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                到期预警
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                <span className="badge badge-normal">正常 {statistics.urgency.normal}</span>
                <span className="badge badge-warning">临期 {statistics.urgency.warning}</span>
                <span className="badge badge-overdue">逾期 {statistics.urgency.overdue}</span>
              </div>
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '14px' }}>状态：</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">全部</option>
                <option value="待分派">待分派</option>
                <option value="已转办">已转办</option>
                <option value="已回访">已回访</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '14px' }}>预警：</label>
              <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
                <option value="">全部</option>
                <option value="normal">正常</option>
                <option value="warning">临期</option>
                <option value="overdue">逾期</option>
              </select>
            </div>
            <div style={{ flex: 1 }} />
            {selectedIds.size > 0 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>已选 {selectedIds.size} 条</span>
                <select value={batchAction} onChange={(e) => setBatchAction(e.target.value)}>
                  <option value="">选择批量操作...</option>
                  {batchActions.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="备注（可选）"
                  value={batchRemark}
                  onChange={(e) => setBatchRemark(e.target.value)}
                  style={{ width: '160px' }}
                />
                <button className="btn btn-primary" onClick={handleBatch} disabled={!batchAction}>
                  批量处理
                </button>
              </div>
            )}
          </div>

          {batchResults && (
            <div
              className="card"
              style={{
                marginBottom: '16px',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <h3 style={{ fontSize: '15px' }}>📋 批量处理结果（处理后已自动刷新列表）</h3>
                <button
                  className="btn btn-secondary"
                  onClick={() => setBatchResults(null)}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  关闭
                </button>
              </div>
              <table style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>学员姓名</th>
                    <th>单据ID</th>
                    <th>结果</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResults.map((r) => (
                    <tr key={r.application_id}>
                      <td>{r.student_name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                        {r.application_id.slice(0, 8)}...
                      </td>
                      <td>
                        {r.success ? (
                          <span className="badge badge-visited">✓ 成功</span>
                        ) : (
                          <span className="badge badge-overdue">✗ 失败</span>
                        )}
                      </td>
                      <td style={{ color: r.success ? '#166534' : '#991b1b' }}>{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === applications.length && applications.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>学员姓名</th>
                <th>身份证号</th>
                <th>报考专业</th>
                <th>状态</th>
                <th>预警</th>
                <th>当前处理人</th>
                <th>下一处理人</th>
                <th>责任人</th>
                <th>版本</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    加载中...
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    暂无数据
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr
                    key={app.id}
                    style={{ background: selectedId === app.id ? '#eff6ff' : undefined }}
                    onClick={() => updateEvidenceForRow(app.id)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(app.id)}
                        onChange={() => toggleSelect(app.id)}
                      />
                    </td>
                    <td style={{ fontWeight: 500 }}>{app.student_name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{app.id_card}</td>
                    <td>{app.program}</td>
                    <td>{getStatusBadge(app.status)}</td>
                    <td>{getUrgencyBadge(app.urgency)}</td>
                    <td>{app.current_handler_name || '-'}</td>
                    <td>{app.next_handler_name || '-'}</td>
                    <td>
                      {app.urgency === 'overdue' && (
                        <span className="badge badge-overdue" style={{ marginRight: '4px' }}>
                          ⚠ 超时
                        </span>
                      )}
                      {app.responsible_person_name}
                    </td>
                    <td style={{ fontSize: '12px', color: '#6b7280' }}>v{app.version}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-primary"
                        onClick={() => viewDetail(app)}
                        style={{ fontSize: '12px', padding: '4px 12px' }}
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div
        style={{
          width: '340px',
          background: '#f9fafb',
          borderLeft: '1px solid #e5e7eb',
          padding: '20px',
          overflow: 'auto',
        }}
      >
        <h3 style={{ fontSize: '15px', marginBottom: '16px', color: '#1e3a8a' }}>📎 证据摘要</h3>
        {!selectedId ? (
          <div
            style={{
              color: '#6b7280',
              fontSize: '13px',
              textAlign: 'center',
              padding: '40px 0',
            }}
          >
            点击左侧单据行查看证据摘要
          </div>
        ) : selectedEvidence ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px' }}>📄 报名资料</span>
                {selectedEvidence.materials_ok ? (
                  <span className="badge badge-visited">
                    ✓ 齐全 ({selectedEvidence.materials_count}份)
                  </span>
                ) : (
                  <span className="badge badge-overdue">✗ 缺失</span>
                )}
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px' }}>🏫 班级分配</span>
                {selectedEvidence.class_ok ? (
                  <span className="badge badge-visited">✓ 已分配</span>
                ) : (
                  <span className="badge badge-overdue">✗ 未分配</span>
                )}
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px' }}>💰 缴费确认</span>
                {selectedEvidence.payment_ok ? (
                  <span className="badge badge-visited">✓ 已确认</span>
                ) : (
                  <span className="badge badge-overdue">✗ 未确认</span>
                )}
              </div>
            </div>
            <div
              className="card"
              style={{
                padding: '14px',
                background: selectedEvidence.all_complete ? '#f0fdf4' : '#fef2f2',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>综合状态</span>
                {selectedEvidence.all_complete ? (
                  <span style={{ color: '#166534', fontWeight: 600 }}>✓ 全部完备</span>
                ) : (
                  <span style={{ color: '#991b1b', fontWeight: 600 }}>✗ 存在缺失</span>
                )}
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => onViewDetail(selectedId)}>
              进入详情办理 →
            </button>
            <button
              className="btn btn-secondary"
              onClick={refreshAll}
              style={{ fontSize: '13px' }}
            >
              🔄 刷新证据与列表
            </button>
          </div>
        ) : (
          <div style={{ color: '#6b7280', fontSize: '13px' }}>加载中...</div>
        )}

        <div style={{ marginTop: '24px', padding: '16px', background: '#eff6ff', borderRadius: '8px' }}>
          <h4 style={{ fontSize: '13px', marginBottom: '8px', color: '#1e40af' }}>💡 使用提示</h4>
          <ul
            style={{
              fontSize: '12px',
              color: '#374151',
              paddingLeft: '18px',
              lineHeight: 1.8,
            }}
          >
            <li>点击左侧单据行可查看证据摘要</li>
            <li>勾选左侧单据可批量处理</li>
            <li>点击表头可按状态/预警筛选</li>
            <li>逾期单据会高亮显示责任人</li>
            <li>右上角可快速切换角色</li>
            <li>批量/详情处理后自动刷新列表</li>
            <li>刷新按钮可同步最新数据</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
