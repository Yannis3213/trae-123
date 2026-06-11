import { useState, useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { api, getCurrentUser } from '../utils/api';
import { STATUS, ROLES } from '../constants';
import { StatusBadge, WarningBadge, StatCard } from '../components/Badges';
import ListFilter from '../components/ListFilter';
import DetailModal from '../components/DetailModal';
import BatchModal from '../components/BatchModal';

const MODULE_TYPE = 'verification';
const VISIBLE_STATUSES = [STATUS.PENDING_REVIEW, STATUS.MATERIAL_MISSING, STATUS.OVERDUE, STATUS.STATUS_CONFLICT];

export default function VerificationPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [selected, setSelected] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [showBatch, setShowBatch] = useState(false);
  const [stats, setStats] = useState(null);
  const [user, setUser] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) { navigate('/login'); return; }
    setUser(u);
    if (u.role !== ROLES.SUPERVISOR) {
      navigate('/ledger');
      return;
    }
    loadData();
    loadStats();
  }, [navigate, refreshKey]);

  const loadData = async (extraFilters = {}) => {
    setLoading(true);
    setSelected([]);
    const statusFilter = { statuses: VISIBLE_STATUSES.join(',') };
    const res = await api.sideRecords.list({ ...filters, ...extraFilters, ...statusFilter });
    if (res.success) {
      const filtered = res.data.filter(r =>
        VISIBLE_STATUSES.includes(r.status) &&
        (!r.currentHandlerId || r.currentHandlerId === user?.id)
      );
      setRecords(filtered);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    const res = await api.sideRecords.statistics();
    if (res.success) setStats(res.data);
  };

  const toggleSelect = (id) => {
    setSelected(selected.includes(id) ? selected.filter(i => i !== id) : [...selected, id]);
  };

  const toggleSelectAll = () => {
    if (selected.length === records.length) setSelected([]);
    else setSelected(records.map(r => r.id));
  };

  const handleSearch = (f) => loadData(f);

  const refresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">过程核验</h2>
        <p className="text-sm text-gray-500 mt-1">专业监理工程师核对过程证据、异常原因，办理审核流转</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <StatCard label="待审核" value={stats.byStatus[STATUS.PENDING_REVIEW]} color="blue" />
          <StatCard label="缺料" value={stats.byStatus[STATUS.MATERIAL_MISSING]} color="orange" />
          <StatCard label="逾期" value={stats.byStatus[STATUS.OVERDUE]} color="red" />
          <StatCard label="状态冲突" value={stats.byStatus[STATUS.STATUS_CONFLICT]} color="purple" />
          <StatCard label="审核通过" value={stats.byStatus[STATUS.REVIEW_PASSED]} color="green" />
        </div>
      )}

      <ListFilter
        filters={filters}
        setFilters={setFilters}
        statusOptions={VISIBLE_STATUSES}
        onSearch={handleSearch}
      />

      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm text-gray-500">
            共 <span className="font-semibold text-gray-700">{records.length}</span> 条
            {selected.length > 0 && <span className="ml-3 text-blue-600">已选 {selected.length} 条</span>}
          </div>
          <div className="flex gap-2">
            {selected.length > 0 && (
              <button className="btn btn-warning" onClick={() => setShowBatch(true)}>批量处理</button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={selected.length === records.length && records.length > 0}
                    onChange={toggleSelectAll} />
                </th>
                <th>记录单号</th>
                <th>项目名称</th>
                <th>旁站部位</th>
                <th>工作内容</th>
                <th>线索</th>
                <th>登记人</th>
                <th>截止日期</th>
                <th>状态</th>
                <th>预警</th>
                <th>问题通知</th>
                <th>整改复核</th>
                <th style={{ width: 100 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={13} className="empty-state">加载中...</td></tr>}
              {!loading && records.length === 0 && <tr><td colSpan={13} className="empty-state">暂无待核验单据</td></tr>}
              {records.map(r => (
                <tr key={r.id}>
                  <td><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                  <td className="font-mono text-blue-600">{r.recordNo}</td>
                  <td>{r.projectName}</td>
                  <td>{r.location}</td>
                  <td className="max-w-[180px] truncate" title={r.workContent}>{r.workContent}</td>
                  <td><span className="tag">{r.sideRecordClue || '—'}</span></td>
                  <td>{r.registrarName}</td>
                  <td>{r.deadline}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td><WarningBadge group={r.warningGroup} /></td>
                  <td className="text-sm">{r.problemNoticeStatus || '—'}</td>
                  <td className="text-sm">{r.rectificationReviewStatus || '—'}</td>
                  <td>
                    <button className="text-blue-600 hover:underline text-sm" onClick={() => setDetailId(r.id)}>
                      详情/办理
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} onRefresh={refresh} />}
      {showBatch && (
        <BatchModal selectedIds={selected} onClose={() => { setShowBatch(false); setSelected([]); }}
          onRefresh={refresh} moduleType={MODULE_TYPE} userRole={user?.role} />
      )}
    </div>
  );
}
