import { useState, useEffect } from 'react';
import { api, statusLabels, urgencyLabels, formatDateTime, roleLabels } from '../lib/api';
import type { User, Consultation } from '../types';

interface Props {
  user: User;
  onOpen: (id: string) => void;
}

interface WarningData {
  normal_list: Consultation[];
  warning_list: Consultation[];
  overdue_list: Consultation[];
  normal_count: number;
  warning_count: number;
  overdue_count: number;
}

export default function WarningPanel({ user, onOpen }: Props) {
  const [data, setData] = useState<WarningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overdue' | 'warning' | 'normal'>('overdue');

  const load = async () => {
    setLoading(true);
    try {
      const d: any = await api.getWarnings({});
      setData(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  if (loading || !data) return <div>加载中...</div>;

  const tabs = [
    { key: 'overdue' as const, label: '逾期', count: data.overdue_count, list: data.overdue_list, cls: 'danger' },
    { key: 'warning' as const, label: '临期', count: data.warning_count, list: data.warning_list, cls: 'warning' },
    { key: 'normal' as const, label: '正常', count: data.normal_count, list: data.normal_list, cls: 'success' },
  ];

  const cur = tabs.find(t => t.key === activeTab)!;

  return (
    <div>
      <div className="alert info" style={{ marginBottom: 16 }}>
        到期预警按「{roleLabels[user.role]}」角色可见范围展示。
        {user.role === 'registrar' && ' 仅展示您本人创建单据的预警。'}
        {user.role === 'auditor' && ' 仅展示核验阶段您处理或待认领的预警。'}
        {user.role === 'reviewer' && ' 展示全部预警。'}
        逾期责任归属按责任节点责任人计算。
      </div>
      <div className="stat-cards">
        {tabs.map(t => (
          <div key={t.key} className={`stat-card ${t.cls}`} style={{ cursor: 'pointer' }} onClick={() => setActiveTab(t.key)}>
            <div className="label">{t.label}</div>
            <div className="value">{t.count}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            className={activeTab === t.key ? 'primary' : ''}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}（{t.count}）
          </button>
        ))}
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>{cur.label}会诊申请单</div>
        <table>
          <thead>
            <tr>
              <th>病案号</th>
              <th>患者姓名</th>
              <th>科室</th>
              <th>状态</th>
              <th>紧急度</th>
              <th>截止时间</th>
              <th>版本</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {cur.list.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>暂无{cur.label}数据</td></tr>
            )}
            {cur.list.map(c => (
              <tr key={c.id}>
                <td>{c.patient_id}</td>
                <td>{c.patient_name}</td>
                <td>{c.department}</td>
                <td><span className={`badge ${c.status}`}>{statusLabels[c.status]}</span></td>
                <td><span className={`badge ${c.urgency}`}>{urgencyLabels[c.urgency]}</span></td>
                <td>{formatDateTime(c.deadline)}</td>
                <td>v{c.version}</td>
                <td><button onClick={() => onOpen(c.id)}>处理</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
