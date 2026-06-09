import { h, useState, useEffect, useMemo } from 'preact';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import CreateModal from '../components/CreateModal.jsx';
import BatchModal from '../components/BatchModal.jsx';

const DEADLINE_LABEL = { normal: '正常', warning: '临期', overdue: '逾期' };

export default function RecordList({ user, showToast }) {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ status: '', deadline_status: '', child_name: '', archived: false });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeRecord, setActiveRecord] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [constants, setConstants] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [listRes, constRes] = await Promise.all([
        api.getRecords({ ...filters, archived: filters.archived ? 'true' : undefined }),
        api.getConstants()
      ]);
      setRecords(listRes.records);
      setStats(listRes.stats);
      setConstants(constRes);
      if (listRes.records.length > 0) {
        const currentActiveId = activeRecord ? activeRecord.id : null;
        const stillExists = currentActiveId && listRes.records.find(r => r.id === currentActiveId);
        setActiveRecord(stillExists || listRes.records[0]);
        const nextSelected = new Set();
        selectedIds.forEach(id => {
          if (listRes.records.find(r => r.id === id)) nextSelected.add(id);
        });
        setSelectedIds(nextSelected);
      } else {
        setActiveRecord(null);
        setSelectedIds(new Set());
      }
    } catch (err) {
      showToast(err.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filters]);

  useEffect(() => {
    const onFocus = () => loadData();
    window.addEventListener('focus', onFocus);
    window.addEventListener('hashchange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('hashchange', onFocus);
    };
  }, []);

  const toggleSelect = (id, e) => {
    if (e) e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
    const rec = records.find(r => r.id === id);
    if (rec) setActiveRecord(rec);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map(r => r.id)));
      if (records.length > 0) setActiveRecord(records[records.length - 1]);
    }
  };

  const canBatchAccept = user.role === 'supervisor';
  const canBatchVerify = user.role === 'principal';
  const canCreate = user.role === 'registrar';

  const handleBatchDone = () => {
    setSelectedIds(new Set());
    setShowBatch(false);
    loadData();
  };

  const handleCreateDone = () => {
    setShowCreate(false);
    loadData();
  };

  const deadlineClass = (s) => `deadline-badge deadline-${s}`;
  const deadlineLabel = (s) => DEADLINE_LABEL[s] || s;

  return (
    <div class="main">
      <div class="content">
        <div class="stats-row">
          <div class="stat-card"><div class="label">待处理总数</div><div class="value">{stats ? stats.total : 0}</div></div>
          <div class="stat-card"><div class="label">待接单</div><div class="value">{stats ? stats.pending_review : 0}</div></div>
          <div class="stat-card"><div class="label">已接单</div><div class="value">{stats ? stats.accepted : 0}</div></div>
          <div class="stat-card"><div class="label">待补正</div><div class="value">{stats ? stats.correction : 0}</div></div>
          <div class="stat-card success"><div class="label">已验收</div><div class="value">{stats ? stats.verified : 0}</div></div>
          <div class="stat-card warning"><div class="label">临期</div><div class="value">{stats ? stats.warning : 0}</div></div>
          <div class="stat-card danger"><div class="label">逾期</div><div class="value">{stats ? stats.overdue : 0}</div></div>
        </div>

        <div class="filters">
          <label>状态：
            <select value={filters.status} onInput={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">全部</option>
              {constants && Object.entries(constants.status_names).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label>预警：
            <select value={filters.deadline_status} onInput={(e) => setFilters({ ...filters, deadline_status: e.target.value })}>
              <option value="">全部</option>
              <option value="normal">正常</option>
              <option value="warning">临期</option>
              <option value="overdue">逾期</option>
            </select>
          </label>
          <label>幼儿姓名：
            <input type="text" placeholder="输入姓名搜索"
              value={filters.child_name}
              onInput={(e) => setFilters({ ...filters, child_name: e.target.value })} />
          </label>
          <label>
            <input type="checkbox" checked={filters.archived}
              onChange={(e) => setFilters({ ...filters, archived: e.target.checked })} />
            <span style={{ marginLeft: 4 }}>包含已归档</span>
          </label>
          <button class="secondary" onClick={() => { setFilters({ status: '', deadline_status: '', child_name: '', archived: false }); setSelectedIds(new Set()); }}>重置</button>
        </div>

        <div class="page-layout">
          <div class="record-list-wrap">
            <div class="table-wrapper">
              <div class="table-header">
                <h3>晨检记录队列（{records.length}条）</h3>
                <div class="actions">
                  {canCreate && <button class="primary" onClick={() => setShowCreate(true)}>+ 新增晨检记录</button>}
                  {selectedIds.size > 0 && (canBatchAccept || canBatchVerify) && (
                    <button class="primary" onClick={() => setShowBatch(true)}>
                      批量处理（{selectedIds.size}）
                    </button>
                  )}
                </div>
              </div>
              {loading ? (
                <div class="empty">加载中...</div>
              ) : records.length === 0 ? (
                <div class="empty">暂无晨检记录</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th class="checkbox-cell">
                        <input type="checkbox"
                          checked={selectedIds.size === records.length && records.length > 0}
                          onChange={toggleSelectAll}
                          onClick={(e) => e.stopPropagation()} />
                      </th>
                      <th>幼儿姓名</th>
                      <th>班级</th>
                      <th>晨检日期</th>
                      <th>体温</th>
                      <th>健康状态</th>
                      <th>当前状态</th>
                      <th>预警</th>
                      <th>当前处理人</th>
                      <th>证据</th>
                      <th>更新时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id}
                        class={activeRecord && activeRecord.id === r.id ? 'selected' : ''}
                        onClick={() => { setActiveRecord(r); navigate(`/record/${r.id}`); }}>
                        <td class="checkbox-cell" onClick={(e) => toggleSelect(r.id, e)}>
                          <input type="checkbox" checked={selectedIds.has(r.id)}
                            onChange={() => {}} onClick={(e) => e.stopPropagation()} />
                        </td>
                        <td class="link-cell">{r.child_name}</td>
                        <td>{r.class_name}</td>
                        <td>{r.check_date}</td>
                        <td>{r.temperature ? `${r.temperature}℃` : '-'}</td>
                        <td>
                          {r.health_status === 'abnormal'
                            ? <span class="tag-abnormal">异常{r.abnormal_type ? `(${r.abnormal_type})` : ''}</span>
                            : <span class="tag-normal">正常</span>}
                        </td>
                        <td><span class={`badge badge-${r.status}`}>{r.status_name}</span></td>
                        <td>
                          {!r.archived
                            ? <span class={deadlineClass(r.deadline_status)}>{deadlineLabel(r.deadline_status)}</span>
                            : <span class="deadline-badge deadline-normal">已归档</span>}
                        </td>
                        <td>{r.current_handler ? `${r.current_handler_role_name || ''}·${r.current_handler}` : '-'}</td>
                        <td>{r.evidence_count}份</td>
                        <td style={{ fontSize: 12, color: '#999' }}>{new Date(r.updated_at).toLocaleString('zh-CN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div class="evidence-sidebar">
            {activeRecord && activeRecord.child ? (
              <>
                <div class="evidence-card child-card">
                  <h4>👶 幼儿档案摘要</h4>
                  <div class="row"><span class="label">姓名</span><span>{activeRecord.child.name}</span></div>
                  <div class="row"><span class="label">班级</span><span>{activeRecord.child.class_name}</span></div>
                  <div class="row"><span class="label">出生日期</span><span>{activeRecord.child.birth_date || '-'}</span></div>
                  <div class="row"><span class="label">联系电话</span><span>{activeRecord.child.parent_phone || '-'}</span></div>
                  <div class="row"><span class="label">过敏史</span><span>{activeRecord.child.allergies || '无'}</span></div>
                </div>
                <div class="evidence-card">
                  <h4>📋 晨检登记摘要</h4>
                  <div class="summary-item"><span class="label">日期</span>{activeRecord.check_date}</div>
                  <div class="summary-item"><span class="label">体温</span>{activeRecord.temperature ? `${activeRecord.temperature}℃` : '-'}</div>
                  <div class="summary-item"><span class="label">状态</span>{activeRecord.health_status === 'abnormal' ? '异常' : '正常'}</div>
                  {activeRecord.abnormal_type && (
                    <div class="summary-item"><span class="label">异常</span>{activeRecord.abnormal_type}</div>
                  )}
                  {activeRecord.abnormal_reason && (
                    <div class="summary-item"><span class="label">说明</span>{activeRecord.abnormal_reason}</div>
                  )}
                </div>
                <div class="evidence-card">
                  <h4>🔔 异常通知摘要</h4>
                  {activeRecord.attachments && activeRecord.attachments.filter(a => a.type === 'abnormal_notice').length > 0 ? (
                    activeRecord.attachments.filter(a => a.type === 'abnormal_notice').map(a => (
                      <div key={a.id} class="summary-item">
                        <span class="label">{a.name}</span>{a.content || '已上传'}
                      </div>
                    ))
                  ) : (
                    <div class="empty">{activeRecord.health_status === 'abnormal' ? '⚠️ 异常记录缺少异常通知书' : '暂无异常通知'}</div>
                  )}
                </div>
                <div class="evidence-card">
                  <h4>📎 证据清单（{activeRecord.attachments ? activeRecord.attachments.length : 0}）</h4>
                  {activeRecord.attachments && activeRecord.attachments.length > 0 ? (
                    activeRecord.attachments.map(a => (
                      <div key={a.id} class="summary-item">
                        <span class="label">
                          {a.type === 'registration' ? '登记' : a.type === 'child_profile' ? '档案' : a.type === 'abnormal_notice' ? '通知' : '其他'}
                        </span>
                        {a.name}
                      </div>
                    ))
                  ) : (
                    <div class="empty">暂无证据附件</div>
                  )}
                </div>
              </>
            ) : (
              <div class="evidence-card"><div class="empty">点击列表行查看证据摘要</div></div>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateModal user={user} onClose={() => setShowCreate(false)} onSuccess={handleCreateDone} showToast={showToast} />
      )}
      {showBatch && (
        <BatchModal
          user={user}
          selectedIds={Array.from(selectedIds)}
          records={records}
          onClose={() => setShowBatch(false)}
          onSuccess={handleBatchDone}
          showToast={showToast}
        />
      )}
    </div>
  );
}
