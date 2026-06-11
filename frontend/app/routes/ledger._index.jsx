import { useState, useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { api, getCurrentUser } from '../utils/api';
import { STATUS, STATUS_NAMES } from '../constants';
import { StatusBadge, WarningBadge, StatCard } from '../components/Badges';
import ListFilter from '../components/ListFilter';
import DetailModal from '../components/DetailModal';

export default function LedgerPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [detailId, setDetailId] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) { navigate('/login'); return; }
    loadData();
    loadStats();
  }, [navigate]);

  const loadData = async (extraFilters = {}) => {
    setLoading(true);
    const res = await api.sideRecords.list({ ...filters, ...extraFilters });
    if (res.success) setRecords(res.data);
    setLoading(false);
  };

  const loadStats = async () => {
    const res = await api.sideRecords.statistics();
    if (res.success) setStats(res.data);
  };

  const handleSearch = (f) => loadData(f);
  const refresh = () => { loadData(); loadStats(); };

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">旁站记录台账</h2>
        <p className="text-sm text-gray-500 mt-1">沉淀所有处理结果，支持按旁站记录线索筛选，追溯问题通知和整改复核状态</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
          {Object.values(STATUS).map(s => (
            <StatCard key={s} label={STATUS_NAMES[s]} value={stats.byStatus[s] || 0}
              color={
                s === STATUS.SYNCED ? 'green' :
                s === STATUS.REVIEW_PASSED ? 'blue' :
                s === STATUS.OVERDUE ? 'red' :
                s === STATUS.MATERIAL_MISSING ? 'orange' :
                s === STATUS.RETURNED ? 'orange' :
                s === STATUS.STATUS_CONFLICT ? 'purple' : 'gray'
              } />
          ))}
        </div>
      )}

      <ListFilter
        filters={filters}
        setFilters={setFilters}
        statusOptions={Object.values(STATUS)}
        onSearch={handleSearch}
        showClue={true}
      />

      <div className="card">
        <div className="text-sm text-gray-500 mb-3">
          共 <span className="font-semibold text-gray-700">{records.length}</span> 条记录
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>记录单号</th>
                <th>项目名称</th>
                <th>旁站部位</th>
                <th>工作内容</th>
                <th>线索</th>
                <th>登记人</th>
                <th>审核人</th>
                <th>归档人</th>
                <th>记录日期</th>
                <th>截止日期</th>
                <th>状态</th>
                <th>预警</th>
                <th>问题通知</th>
                <th>整改复核</th>
                <th style={{ width: 80 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={15} className="empty-state">加载中...</td></tr>}
              {!loading && records.length === 0 && <tr><td colSpan={15} className="empty-state">暂无数据</td></tr>}
              {records.map(r => (
                <tr key={r.id}>
                  <td className="font-mono text-blue-600">{r.recordNo}</td>
                  <td>{r.projectName}</td>
                  <td>{r.location}</td>
                  <td className="max-w-[160px] truncate" title={r.workContent}>{r.workContent}</td>
                  <td><span className="tag">{r.sideRecordClue || '—'}</span></td>
                  <td>{r.registrarName || '—'}</td>
                  <td>{r.reviewerName || '—'}</td>
                  <td>{r.finalArchiverName || '—'}</td>
                  <td>{r.recordDate}</td>
                  <td>{r.deadline}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td><WarningBadge group={r.warningGroup} /></td>
                  <td className="text-sm">{r.problemNoticeStatus || '—'}</td>
                  <td className="text-sm">{r.rectificationReviewStatus || '—'}</td>
                  <td>
                    <button className="text-blue-600 hover:underline text-sm" onClick={() => setDetailId(r.id)}>
                      详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} onRefresh={refresh} />}
    </div>
  );
}
