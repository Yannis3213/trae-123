import { useState, useEffect } from 'react';
import { api, statusLabels, urgencyLabels } from '../lib/api';
import type { User, Consultation } from '../types';

interface Props {
  user: User;
  onOpen: (id: string) => void;
}

export default function Dashboard({ user, onOpen }: Props) {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [statData, listData]: any[] = await Promise.all([
        api.getStatistics(),
        api.listConsultations({ page_size: 10 }),
      ]);
      setStats(statData || {});
      setRecent(listData?.list || []);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>加载中...</div>;

  const statList = [
    { label: '待确认', key: 'pending', cls: '' },
    { label: '异常', key: 'abnormal', cls: 'danger' },
    { label: '已复查', key: 'rechecked', cls: 'success' },
    { label: '已归档', key: 'archived', cls: '' },
    { label: '临期', key: 'urgency_warning', cls: 'warning' },
    { label: '逾期', key: 'urgency_overdue', cls: 'danger' },
    { label: '正常', key: 'urgency_normal', cls: 'success' },
  ];

  return (
    <div>
      <div className="section-title" style={{ marginTop: 0 }}>处理概览</div>
      <div className="stat-cards">
        {statList.map(s => (
          <div key={s.key} className={`stat-card ${s.cls}`}>
            <div className="label">{s.label}</div>
            <div className="value">{stats[s.key] || 0}</div>
          </div>
        ))}
      </div>

      <div className="section-title">最近会诊申请单</div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>病案号</th>
              <th>患者姓名</th>
              <th>科室</th>
              <th>会诊类型</th>
              <th>状态</th>
              <th>紧急程度</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>暂无数据</td></tr>
            )}
            {recent.map(c => (
              <tr key={c.id}>
                <td>{c.patient_id}</td>
                <td>{c.patient_name}</td>
                <td>{c.department}</td>
                <td>{c.consultation_type}</td>
                <td><span className={`badge ${c.status}`}>{statusLabels[c.status]}</span></td>
                <td><span className={`badge ${c.urgency}`}>{urgencyLabels[c.urgency]}</span></td>
                <td>{formatDateTime(c.created_at)}</td>
                <td><button onClick={() => onOpen(c.id)}>查看</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
