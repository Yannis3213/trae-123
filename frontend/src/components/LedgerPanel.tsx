import { useState, useEffect } from 'react';
import { api, statusLabels, urgencyLabels, formatDateTime, roleLabels } from '../lib/api';
import type { User, Consultation } from '../types';

interface Props {
  user: User;
  onOpen: (id: string) => void;
}

interface LedgerItem {
  consultation: Consultation;
  process_count: number;
  abnormal_count: number;
  schedule_verified: boolean;
  feedback_verified: boolean;
}

export default function LedgerPanel({ user, onOpen }: Props) {
  const [list, setList] = useState<LedgerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [patientId, setPatientId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: pageSize };
      if (keyword) params.keyword = keyword;
      if (patientId) params.patient_id = patientId;
      const data: any = await api.getLedger(params);
      setList(data.list || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, user]);

  const handleSearch = () => { setPage(1); load(); };
  const handleReset = () => { setKeyword(''); setPatientId(''); setPage(1); setTimeout(load, 0); };

  return (
    <div>
      <div className="alert info" style={{ marginBottom: 16 }}>
        会诊申请单台账按「{roleLabels[user.role]}」角色权限展示已归档单据，后端已严格校验可见范围。
        {user.role === 'registrar' && ' 仅展示您本人创建的归档单据。'}
        {user.role === 'auditor' && ' 仅展示核验阶段您参与处理过的归档单据。'}
        {user.role === 'reviewer' && ' 仅展示复核阶段流转归档的单据。'}
      </div>
      <div className="filter-bar">
        <div className="form-item">
          <label>病案号</label>
          <input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="按病案号筛选" />
        </div>
        <div className="form-item">
          <label>关键词</label>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索患者/病案号/原因" />
        </div>
        <button className="primary" onClick={handleSearch}>查询</button>
        <button onClick={handleReset}>重置</button>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>
          会诊申请单台账（已归档）<span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 400, marginLeft: 8 }}>共 {total} 条</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>病案号</th>
              <th>患者姓名</th>
              <th>科室</th>
              <th>会诊类型</th>
              <th>最终状态</th>
              <th>处理次数</th>
              <th>异常次数</th>
              <th>排班核验</th>
              <th>反馈核验</th>
              <th>归档时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40 }}>加载中...</td></tr>}
            {!loading && list.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>暂无归档数据</td></tr>
            )}
            {list.map(item => {
              const c = item.consultation;
              return (
                <tr key={c.id}>
                  <td>{c.patient_id}</td>
                  <td>{c.patient_name}</td>
                  <td>{c.department}</td>
                  <td>{c.consultation_type}</td>
                  <td><span className={`badge ${c.status}`}>{statusLabels[c.status]}</span></td>
                  <td>{item.process_count}</td>
                  <td style={{ color: item.abnormal_count > 0 ? 'var(--danger)' : 'inherit' }}>{item.abnormal_count}</td>
                  <td>{item.schedule_verified ? '✓' : '✗'}</td>
                  <td>{item.feedback_verified ? '✓' : '✗'}</td>
                  <td>{formatDateTime(c.updated_at)}</td>
                  <td><button onClick={() => onOpen(c.id)}>查看档案</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>第 {page} 页</span>
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>上一页</button>
          <button disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)}>下一页</button>
        </div>
      </div>
    </div>
  );
}
