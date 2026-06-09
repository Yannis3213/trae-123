import React, { useState } from 'react';
import { api, type User, type DictItem } from '../lib/api';
import OrderList from './OrderList';
import StatisticsView from './StatisticsView';
import AuditView from './AuditView';
import AbnormalView from './AbnormalView';

interface Props {
  user: User;
  dict: {
    roles: DictItem[];
    statuses: DictItem[];
    abnormalTypes: DictItem[];
    warningLevels: DictItem[];
    transitions: Record<string, string[]>;
  } | null;
  onLogout: () => void;
}

const MENU_BY_ROLE: Record<string, { key: string; label: string; icon: string }[]> = {
  store_clerk: [
    { key: 'orders', label: '处方订单登记', icon: '📋' },
    { key: 'statistics', label: '到期预警', icon: '⏰' },
    { key: 'audit', label: '操作记录', icon: '📝' }
  ],
  pharmacist: [
    { key: 'orders', label: '过程核验', icon: '🔍' },
    { key: 'statistics', label: '到期预警', icon: '⏰' },
    { key: 'abnormal', label: '异常原因', icon: '⚠️' },
    { key: 'audit', label: '操作记录', icon: '📝' }
  ],
  area_manager: [
    { key: 'orders', label: '复核归档', icon: '✅' },
    { key: 'statistics', label: '到期预警', icon: '⏰' },
    { key: 'abnormal', label: '异常原因', icon: '⚠️' },
    { key: 'audit', label: '审计轨迹', icon: '📝' }
  ]
};

const Dashboard: React.FC<Props> = ({ user, dict, onLogout }) => {
  const menu = MENU_BY_ROLE[user.role] || MENU_BY_ROLE.store_clerk;
  const [activeKey, setActiveKey] = useState(menu[0].key);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);

  const pageTitles: Record<string, { title: string; subtitle: string }> = {
    orders: user.role === 'store_clerk'
      ? { title: '处方订单登记', subtitle: '门店店员创建处方订单，登记患者信息、处方及证据附件，提交后流转至执业药师' }
      : user.role === 'pharmacist'
      ? { title: '过程核验', subtitle: '执业药师对处方订单进行核验、状态推进：正常签收、异常回传、缺料、逾期或退回补正' }
      : { title: '复核归档', subtitle: '区域经理对处理完成的处方订单进行复核归档，对异常订单进行退回补正或正常签收' },
    statistics: { title: '到期预警', subtitle: '按到期时间划分为正常、临期、逾期三队，节点超时自动关联责任人，月底集中处理' },
    abnormal: { title: '异常原因', subtitle: '异常样例展示：缺料、逾期、状态冲突、越权、重复提交、旧版本、缺证据等' },
    audit: { title: user.role === 'area_manager' ? '审计轨迹' : '操作记录', subtitle: '查看处方订单操作日志、状态变更、批量处理及补正动作' }
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>💊 连锁药房处方订单系统 · 月底集中处理</h1>
        <div className="user-chip">
          <span>{user.name}</span>
          <span className="role-badge">{user.roleName}</span>
          <button className="logout-btn" onClick={onLogout}>退出登录</button>
        </div>
      </header>
      <div className="app-body">
        <aside className="app-sider">
          <ul className="sider-menu">
            {menu.map(m => (
              <li
                key={m.key}
                className={activeKey === m.key ? 'active' : ''}
                onClick={() => setActiveKey(m.key)}
              >
                <span>{m.icon}</span><span>{m.label}</span>
              </li>
            ))}
          </ul>
        </aside>
        <main className="app-content">
          <h2 className="page-title">{pageTitles[activeKey].title}</h2>
          <p className="page-subtitle">{pageTitles[activeKey].subtitle}</p>

          {activeKey === 'orders' && (
            <OrderList key={refreshKey} user={user} dict={dict} onChanged={refresh} />
          )}
          {activeKey === 'statistics' && (
            <StatisticsView key={refreshKey} user={user} dict={dict} onChanged={refresh} />
          )}
          {activeKey === 'abnormal' && (
            <AbnormalView key={refreshKey} user={user} dict={dict} />
          )}
          {activeKey === 'audit' && (
            <AuditView key={refreshKey} user={user} dict={dict} />
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
