import { useState, useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { api, getCurrentUser } from '../utils/api';
import { STATUS, WARNING_GROUPS, WARNING_GROUP_NAMES } from '../constants';
import { StatusBadge, WarningBadge, StatCard } from '../components/Badges';
import DetailModal from '../components/DetailModal';
import BatchModal from '../components/BatchModal';

export default function WarningPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [showBatch, setShowBatch] = useState(false);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) { navigate('/login'); return; }
    setUser(u);
    loadData();
    loadStats();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    const res = await api.sideRecords.warnings();
    if (res.success) setRecords(res.data);
    setLoading(false);
  };

  const loadStats = async () => {
    const res = await api.sideRecords.statistics();
    if (res.success) setStats(res.data);
  };

  const toggleSelect = (id) => {
    setSelected(selected.includes(id) ? selected.filter(i => i !== id) : [...selected, id]);
  };
  const toggleSelectAll = (list) => {
    if (selected.length === list.length) setSelected([]);
    else setSelected(list.map(r => r.id));
  };

  const refresh = () => { loadData(); loadStats(); };

  const filtered = groupFilter === 'all'
    ? records
    : records.filter(r => r.warningGroup === groupFilter);

  const grouped = {
    approaching: records.filter(r => r.warningGroup === WARNING_GROUPS.APPROACHING),
    overdue: records.filter(r => r.warningGroup === WARNING_GROUPS.OVERDUE)
  };

  const renderGroup = (title, list, color) => {
    if (list.length === 0) return null;
    return (
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className={`text-base font-semibold ${
            color === 'red' ? 'text-red-600' : 'text-orange-600'
          }`}>
            {title} <span className="text-sm font-normal text-gray-500">({list.length})</span>
          </h3>
          <div className="flex items-center gap-3">
            <label className="text-sm flex items-center gap-1">
              <input type="checkbox" checked={selected.length === list.length && list.length > 0}
                onChange={() => toggleSelectAll(list)} />
              全选
            </label>
            {selected.filter(id => list.map(r => r.id).includes(id)).length > 0 && (
              <button className="btn btn-warning btn-sm" onClick={() => setShowBatch(true)}>
                批量推进（将逐条拦截）
              </button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>记录单号</th>
                <th>项目名称</th>
                <th>工作内容</th>
                <th>线索</th>
                <th>当前处理人</th>
                <th>责任人</th>
                <th>截止日期</th>
                <th>状态</th>
                <th>异常原因</th>
                <th>最后提醒</th>
                <th style={{ width: 100 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map(r => (
                <tr key={r.id}>
                  <td><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                  <td className="font-mono text-blue-600">{r.recordNo}</td>
                  <td>{r.projectName}</td>
                  <td className="max-w-[180px] truncate">{r.workContent}</td>
                  <td><span className="tag">{r.sideRecordClue || '—'}</span></td>
                  <td>{r.currentHandlerName || '—'}</td>
                  <td>{r.registrarName || '—'}</td>
                  <td className={color === 'red' ? 'text-red-600 font-medium' : 'text-orange-600 font-medium'}>
                    {r.deadline}
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="max-w-[160px] truncate text-xs text-red-600" title={r.abnormalReason}>
                    {r.abnormalReason || '—'}
                  </td>
                  <td className="text-xs text-gray-500">{r.lastReminderTime || '—'}</td>
                  <td>
                    <button className="text-blue-600 hover:underline text-sm" onClick={() => setDetailId(r.id)}>
                      补正/查看
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">到期预警</h2>
        <p className="text-sm text-gray-500 mt-1">按正常、临期、逾期分组展示，节点超时自动落到责任人；逾期批量推进时将逐条拦截</p>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatCard label="正常" value={stats.byWarningGroup?.normal || 0} color="green" />
          <StatCard label="临期（3天内）" value={stats.byWarningGroup?.approaching || 0} color="orange" />
          <StatCard label="逾期" value={stats.byWarningGroup?.overdue || 0} color="red" />
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {[
          { key: 'all', label: '全部' },
          { key: WARNING_GROUPS.APPROACHING, label: '临期' },
          { key: WARNING_GROUPS.OVERDUE, label: '逾期' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setGroupFilter(tab.key)}
            className={`px-4 py-2 rounded text-sm ${
              groupFilter === tab.key
                ? 'bg-blue-600 text-white font-medium'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <div className="empty-state">加载中...</div>}

      {!loading && records.length === 0 && (
        <div className="card">
          <div className="empty-state">
            ✅ 暂无到期预警单据
          </div>
        </div>
      )}

      {!loading && groupFilter === 'all' && (
        <>
          {renderGroup('🚨 逾期单据（已超过截止日期）', grouped.overdue, 'red')}
          {renderGroup('⚠️ 临期单据（3天内到期）', grouped.approaching, 'orange')}
        </>
      )}

      {!loading && groupFilter !== 'all' && (
        renderGroup(
          groupFilter === WARNING_GROUPS.OVERDUE ? '🚨 逾期单据' : '⚠️ 临期单据',
          filtered,
          groupFilter === WARNING_GROUPS.OVERDUE ? 'red' : 'orange'
        )
      )}

      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} onRefresh={refresh} />}
      {showBatch && (
        <BatchModal
          selectedIds={selected}
          onClose={() => { setShowBatch(false); setSelected([]); }}
          onRefresh={refresh}
          moduleType={user?.role === 'registrar' ? 'registration' : user?.role === 'supervisor' ? 'verification' : 'archiving'}
          userRole={user?.role}
        />
      )}
    </div>
  );
}
