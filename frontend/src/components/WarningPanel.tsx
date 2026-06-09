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

  const emptyHint = (tabLabel: string) => {
    if (user.role === 'registrar') return `暂无您登记的${tabLabel}会诊申请单`;
    if (user.role === 'auditor') return `核验池暂无${tabLabel}单据，如有退回请等待登记秘书补正后再次提交`;
    if (user.role === 'reviewer') return `复核池暂无${tabLabel}单据，请等待质控医生核验通过`;
    return `暂无${tabLabel}数据`;
  };

  const ownershipHint = (c: Consultation) => {
    const parts: string[] = [];
    parts.push(`登记:${c.registrar_name || '—'}`);
    if (c.auditor_name || c.current_stage !== 'registration') {
      parts.push(`核验:${c.auditor_name || '待认领'}`);
    }
    if (c.reviewer_name || c.current_stage === 'review' || c.is_archived) {
      parts.push(`复核:${c.reviewer_name || '待进入'}`);
    }
    return parts.join(' / ');
  };

  const tabs = [
    { key: 'overdue' as const, label: '逾期', count: data.overdue_count, list: data.overdue_list, cls: 'danger' },
    { key: 'warning' as const, label: '临期', count: data.warning_count, list: data.warning_list, cls: 'warning' },
    { key: 'normal' as const, label: '正常', count: data.normal_count, list: data.normal_list, cls: 'success' },
  ];

  const cur = tabs.find(t => t.key === activeTab)!;

  return (
    <div>
      <div className="alert info" style={{ marginBottom: 16 }}>
        到期预警按「{roleLabels[user.role]}」角色权限展示，后端已严格校验可见范围。
        {user.role === 'registrar' && ' 仅展示您本人创建单据的预警。'}
        {user.role === 'auditor' && ' 仅展示核验阶段分配给您或待认领单据的预警。'}
        {user.role === 'reviewer' && ' 仅展示复核阶段单据的预警。'}
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
              <th>责任链归属</th>
              <th>截止时间</th>
              <th>版本</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {cur.list.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>{emptyHint(cur.label)}</td></tr>
            )}
            {cur.list.map(c => (
              <tr key={c.id}>
                <td>{c.patient_id}</td>
                <td>{c.patient_name}</td>
                <td>{c.department}</td>
                <td><span className={`badge ${c.status}`}>{statusLabels[c.status]}</span></td>
                <td><span className={`badge ${c.urgency}`}>{urgencyLabels[c.urgency]}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ownershipHint(c)}</td>
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
