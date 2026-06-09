import React, { useState, useEffect } from 'react';
import { api, type User } from '../lib/api';
import type { DictData } from './App';

interface Props {
  user: User;
  dict: DictData | null;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { hour12: false });
};

const AbnormalView: React.FC<Props> = ({ user, dict }) => {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await api.listAbnormal();
      setLoading(false);
      if (r.code === 0 && r.data) setList(r.data);
    })();
  }, []);

  const EXAMPLES = [
    { type: 'material_shortage', name: '缺料', scene: '执业药师核验时发现阿莫西林胶囊库存不足，无法按处方量配齐', who: '执业药师 → 区域经理' },
    { type: 'overdue', name: '逾期', scene: '处方登记后超过 72 小时未处理，系统自动标记逾期，责任人为当前处理人', who: '系统自动 / 执业药师 → 区域经理' },
    { type: 'state_conflict', name: '状态冲突', scene: '区域经理复核时发现执业药师已变更但前端仍显示旧状态，后端保留原值并提示冲突', who: '任意角色' },
    { type: 'unauthorized', name: '越权操作', scene: '门店店员试图签收处方订单，或非当前处理人（如张主任）尝试推进，后端直接拦截', who: '任意越权角色' },
    { type: 'duplicate_submit', name: '重复提交', scene: '同一订单已处于「签收完成」，再次提交同一状态，后端识别重复并提示', who: '当前处理人' },
    { type: 'old_version', name: '旧版本提交', scene: '订单已被他人处理（版本由 v1→v2），仍带 v1 提交，后端返回 409 并提示刷新', who: '并发场景' },
    { type: 'missing_evidence', name: '缺证据', scene: '执业药师尝试签收，但缺少处方单 / 签收确认单等必需证据，拦截并提示补证据', who: '执业药师' }
  ];

  return (
    <div>
      <div className="card">
        <h3>异常样例总览</h3>
        <div className="stats-grid">
          {EXAMPLES.map(e => (
            <div key={e.type} className="stat-card status-abnormal_return">
              <div className="stat-label">{e.name}</div>
              <div className="stat-value" style={{ fontSize: 14 }}>{e.who}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>七类异常拦截说明</h3>
        <table className="data-table">
          <thead>
            <tr><th>异常类型</th><th>触发角色</th><th>典型场景</th><th>后端拦截行为</th></tr>
          </thead>
          <tbody>
            {EXAMPLES.map(e => (
              <tr key={e.type}>
                <td><span className="tag" style={{ background: '#fee2e2', color: '#991b1b' }}>{e.name}</span></td>
                <td>{e.who}</td>
                <td>{e.scene}</td>
                <td style={{ color: '#374151' }}>
                  返回 400/401/403/409，附带 error_code 和中文 message，状态保留原值，
                  详情中提示需要谁补正（如门店店员补上传证据、执业药师再次核验等）。
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>当前异常登记记录（{list.length}）</h3>
        {loading ? (
          <div className="empty">加载中...</div>
        ) : list.length === 0 ? (
          <div className="empty">暂无异常登记</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>订单号</th><th>患者</th><th>异常类型</th>
                <th>异常说明</th><th>责任人</th><th>登记人</th><th>登记时间</th><th>解决状态</th>
              </tr>
            </thead>
            <tbody>
              {list.map(a => (
                <tr key={a.id}>
                  <td style={{ fontFamily: 'monospace' }}>{a.order_no}</td>
                  <td>{a.patient_name}</td>
                  <td><span className="tag">{a.abnormal_type_name}</span></td>
                  <td>{a.description}</td>
                  <td>{a.responsible_person || '-'}</td>
                  <td>{a.reported_by_name}</td>
                  <td>{formatTime(a.reported_at)}</td>
                  <td>{a.resolved ? <span className="tag warning-normal">已解决</span> : <span className="tag warning-overdue">未解决</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AbnormalView;
