import React, { useState, useEffect } from 'react';
import { visitsApi, statsApi, authApi } from '../lib/api';
import {
  STATUS_LABELS, PRIORITY_LABELS, EXCEPTION_LABELS,
  formatDate, getDeadlineStatus, priorityStyle, statusStyle, hasRole
} from '../lib/auth';
import CreateOrderModal from './CreateOrderModal';
import BatchModal from './BatchModal';

export default function VisitList() {
  const [list, setList] = useState([]);
  const [stats, setStats] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [createModal, setCreateModal] = useState(false);
  const [batchModal, setBatchModal] = useState(false);
  const [batchResults, setBatchResults] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    assignee_id: '',
    deadline_status: '',
    search: ''
  });
  const [toast, setToast] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [listRes, statsRes, docsRes] = await Promise.all([
        visitsApi.list(filters),
        statsApi.get(),
        authApi.getDoctors()
      ]);
      if (listRes.success) setList(listRes.data || []);
      if (statsRes.success) setStats(statsRes.data);
      if (docsRes.success) setDoctors(docsRes.users || []);
    } catch (err) {
      showToast(err.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === list.length) setSelected(new Set());
    else setSelected(new Set(list.map(o => o.id)));
  };

  const handleBatch = async (action, payload) => {
    try {
      const res = await visitsApi.batch({ ids: [...selected], action, payload });
      if (res.success) {
        showToast(res.message);
        setBatchResults(res);
        setSelected(new Set());
        setBatchModal(false);
        loadData();
      }
    } catch (err) {
      showToast(err.message || '批量操作失败', 'error');
    }
  };

  const handleOverdueBatch = async () => {
    try {
      const res = await visitsApi.overdueBatch({ ids: [...selected] });
      if (res.success) {
        showToast(res.message);
        setBatchResults(res);
        setSelected(new Set());
        loadData();
      }
    } catch (err) {
      showToast(err.message || '逾期批量推进失败', 'error');
    }
  };

  const getActionsForRole = () => {
    const actions = [];
    if (hasRole('nurse')) {
      actions.push({ key: 'assign', label: '批量分派兽医师', needPayload: true, payloadField: 'assignee_id', labelField: '选择兽医师' });
    }
    if (hasRole('doctor')) {
      actions.push({ key: 'start_process', label: '批量开始接诊' });
      actions.push({ key: 'resume_process', label: '批量补充材料恢复处理', needPayload: true, payloadField: 'evidence_provided', labelField: '提供的证据材料' });
      actions.push({ key: 'transfer', label: '批量转办（待补充材料）', needPayload: true, payloadField: 'evidence_provided', labelField: '提供的证据材料' });
      actions.push({ key: 'schedule_follow_up', label: '批量完成治疗安排回访', needPayload: true, payloadField: 'evidence_provided', labelField: '提供的证据材料' });
      actions.push({ key: 'submit_review', label: '批量提交院长复核' });
      actions.push({ key: 'reprocess', label: '批量开始补正', needPayload: true, payloadField: 'correction_action', labelField: '补正动作说明' });
      actions.push({ key: 'submit_correction', label: '批量补正完成提交复核', needPayload: true, payloadField: 'evidence_provided', labelField: '补正材料' });
    }
    if (hasRole('director')) {
      actions.push({ key: 'archive', label: '批量复核归档' });
      actions.push({ key: 'return_for_correction', label: '批量退回补正', needPayload: true, payloadField: 'exception_reason', labelField: '退回原因' });
      actions.push({ key: 'overdue_advance', label: '逾期批量推进', isOverdueAction: true });
    }
    return actions;
  };

  const overdueSelected = list.filter(o => selected.has(o.id) && getDeadlineStatus(o.deadline).status === 'overdue').length;

  return (
    <div>
      {toast && (
        <div className={toast.type === 'error' ? 'error-box' : 'success-box'}>
          {toast.msg}
        </div>
      )}

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h4>就诊单总数</h4>
            <div className="num">{stats.total}</div>
          </div>
          <div className="stat-card normal">
            <h4>正常</h4>
            <div className="num">{stats.byDeadline.normal}</div>
          </div>
          <div className="stat-card approaching">
            <h4>临期（24小时内）</h4>
            <div className="num">{stats.byDeadline.approaching}</div>
          </div>
          <div className="stat-card overdue">
            <h4>逾期</h4>
            <div className="num">{stats.byDeadline.overdue}</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <span>宠物就诊单列表</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {hasRole('nurse') && (
              <button className="btn btn-primary" onClick={() => setCreateModal(true)}>
                ➕ 新建就诊单
              </button>
            )}
            {hasRole('director') && stats && stats.byDeadline.overdue > 0 && (
              <button className="btn btn-danger" onClick={handleOverdueBatch}>
                ⚠️ 一键逾期推进（{stats.byDeadline.overdue}条）
              </button>
            )}
          </div>
        </div>

        <div className="filter-bar">
          <div className="form-group">
            <label>搜索</label>
            <input
              placeholder="单号/宠物名/主人/电话"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>状态</label>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">全部</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>优先级</label>
            <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
              <option value="">全部</option>
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>到期情况</label>
            <select value={filters.deadline_status} onChange={(e) => setFilters({ ...filters, deadline_status: e.target.value })}>
              <option value="">全部</option>
              <option value="overdue">🔴 逾期</option>
              <option value="approaching">🟡 临期（24h内）</option>
              <option value="normal">🟢 正常</option>
            </select>
          </div>
          {hasRole('nurse', 'director') && (
            <div className="form-group">
              <label>责任人（兽医师）</label>
              <select value={filters.assignee_id} onChange={(e) => setFilters({ ...filters, assignee_id: e.target.value })}>
                <option value="">全部</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>&nbsp;</label>
            <button className="btn" onClick={() => { setFilters({ status: '', priority: '', assignee_id: '', deadline_status: '', search: '' }); }}>
              重置筛选
            </button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="batch-bar">
            <span>已选择 <strong>{selected.size}</strong> 条单据{overdueSelected > 0 && `（其中 ${overdueSelected} 条逾期）`}</span>
            <button className="btn btn-primary btn-sm" onClick={() => setBatchModal(true)}>批量处理</button>
            <button className="btn btn-sm" onClick={() => setSelected(new Set())}>取消选择</button>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <input type="checkbox" checked={selected.size === list.length && list.length > 0} onChange={toggleAll} />
                </th>
                <th>单号</th>
                <th>宠物信息</th>
                <th>主人</th>
                <th>优先级</th>
                <th>状态</th>
                <th>责任人</th>
                <th>截止时间</th>
                <th>到期</th>
                <th>材料</th>
                <th>异常/补正</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="12" className="empty">加载中...</td></tr>
              )}
              {!loading && list.length === 0 && (
                <tr><td colSpan="12" className="empty">暂无数据</td></tr>
              )}
              {list.map(o => {
                const dl = getDeadlineStatus(o.deadline);
                const ps = priorityStyle(o.priority);
                const ss = statusStyle(o.status);
                const isOverdue = dl.status === 'overdue';
                const isCorrection = ['returned_for_correction', 'reprocessing'].includes(o.status);
                return (
                  <tr key={o.id} style={isOverdue ? { background: '#fef2f2' } : (isCorrection ? { background: '#fff7ed' } : {})}>
                    <td className="checkbox-cell">
                      <input
                        type="checkbox"
                        checked={selected.has(o.id)}
                        onChange={() => toggleSelect(o.id)}
                      />
                    </td>
                    <td>
                      <a href={`/detail/${o.id}`}>{o.order_no}</a>
                      {isOverdue && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 2 }}>⚠️ 逾期</div>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{o.pet_name}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>
                        {o.pet_type}{o.pet_breed ? ` · ${o.pet_breed}` : ''}{o.pet_age ? ` · ${o.pet_age}岁` : ''}
                      </div>
                    </td>
                    <td>
                      <div>{o.owner_name}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{o.owner_phone}</div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: ps.bg, color: ps.color }}>
                        {ps.label}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ background: ss.bg, color: ss.color }}>
                        {STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td>{o.assignee?.name || '-'}</td>
                    <td style={{ fontSize: 12 }}>{formatDate(o.deadline)}</td>
                    <td>
                      <span className="badge" style={{ background: `${dl.color}20`, color: dl.color }}>
                        {dl.label}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: o.material_status === 'complete' ? '#dcfce7' : '#fef3c7',
                        color: o.material_status === 'complete' ? '#166534' : '#92400e',
                        fontSize: 11
                      }}>
                        {o.material_status === 'complete' ? '齐全' : '不全'}
                      </span>
                    </td>
                    <td style={{ maxWidth: 160 }}>
                      {o.exception_type ? (
                        <div>
                          <span className="exception-tag">
                            {EXCEPTION_LABELS[o.exception_type]}
                          </span>
                          {o.exception_reason && (
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.3, wordBreak: 'break-all' }}>
                              {o.exception_reason.length > 30 ? o.exception_reason.slice(0, 30) + '...' : o.exception_reason}
                            </div>
                          )}
                        </div>
                      ) : o.correction_action ? (
                        <div>
                          <span className="badge" style={{ background: '#fed7aa', color: '#9a3412', fontSize: 11 }}>补正中</span>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.3 }}>
                            {o.correction_action.length > 30 ? o.correction_action.slice(0, 30) + '...' : o.correction_action}
                          </div>
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      <a className="btn btn-sm btn-primary" href={`/detail/${o.id}`}>办理</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {batchResults && (
        <div className="card">
          <div className="card-title">
            <span>📊 批量处理结果</span>
            <button className="btn btn-sm" onClick={() => setBatchResults(null)}>关闭</button>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div style={{ color: '#16a34a', fontWeight: 600 }}>成功：{batchResults.successCount} 条</div>
            <div style={{ color: '#dc2626', fontWeight: 600 }}>失败：{batchResults.failCount} 条</div>
            <div style={{ color: '#64748b' }}>总计：{batchResults.total} 条</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>单号</th>
                <th>结果</th>
                <th>状态变更</th>
                <th>异常类型</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {batchResults.results.map((r, i) => (
                <tr key={i} style={!r.success ? { background: '#fef2f2' } : {}}>
                  <td>{r.order_no || r.id}</td>
                  <td>
                    <span className="badge" style={{
                      background: r.success ? '#dcfce7' : '#fee2e2',
                      color: r.success ? '#166534' : '#991b1b'
                    }}>
                      {r.success ? '✅ 成功' : '❌ 失败'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {r.success ? (
                      <span>{STATUS_LABELS[r.from] || r.from} → {STATUS_LABELS[r.to] || r.to}</span>
                    ) : (
                      <span style={{ color: '#64748b' }}>{r.currentStatusLabel || '-'}</span>
                    )}
                  </td>
                  <td>
                    {r.exceptionType ? (
                      <span className="exception-tag">{EXCEPTION_LABELS[r.exceptionType] || r.exceptionType}</span>
                    ) : '-'}
                  </td>
                  <td style={{ fontSize: 12, color: r.success ? '#16a34a' : '#dc2626', maxWidth: 300, wordBreak: 'break-all' }}>
                    {r.success ? (r.correctionAction || r.message) : (r.reason || r.message)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createModal && (
        <CreateOrderModal
          doctors={doctors}
          onClose={() => setCreateModal(false)}
          onSuccess={() => {
            setCreateModal(false);
            loadData();
            showToast('就诊单创建成功');
          }}
        />
      )}

      {batchModal && (
        <BatchModal
          ids={[...selected]}
          actions={getActionsForRole()}
          doctors={doctors}
          onClose={() => setBatchModal(false)}
          onSubmit={handleBatch}
        />
      )}
    </div>
  );
}
