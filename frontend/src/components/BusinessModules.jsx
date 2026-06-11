import { getCurrentUser } from '../api/client.js';

const modules = [
  {
    key: 'material',
    name: '原料订货',
    icon: '📦',
    color: 'blue',
    desc: '门店店长提交订货材料',
    role: 'store_manager',
    statuses: ['pending_material', 'exception']
  },
  {
    key: 'acceptance',
    name: '到货验收',
    icon: '✅',
    color: 'green',
    desc: '品控专员验收补正',
    role: 'qc_specialist',
    statuses: ['pending_acceptance', 'recheck_pending']
  },
  {
    key: 'inventory',
    name: '库存回写',
    icon: '📝',
    color: 'purple',
    desc: '营运经理复核收口',
    role: 'operations_manager',
    statuses: ['pending_review']
  }
];

const moduleStatusMap = {
  pending_material: { module: 'material', status: 'pending' },
  pending_acceptance: { module: 'acceptance', status: 'current' },
  pending_review: { module: 'inventory', status: 'current' },
  exception: { module: 'material', status: 'pending' },
  recheck_pending: { module: 'acceptance', status: 'current' },
  completed: { module: 'inventory', status: 'done' },
  rejected: { module: 'material', status: 'done' }
};

const roleLabels = {
  store_manager: '门店店长',
  qc_specialist: '品控专员',
  operations_manager: '营运经理'
};

export default function BusinessModules({ active, onChange, orders, onRefresh }) {
  const user = getCurrentUser();

  const getModuleCount = (moduleKey) => {
    const mod = modules.find(m => m.key === moduleKey);
    return orders?.filter(o => mod.statuses.includes(o.status)).length || 0;
  };

  const getModuleStatus = (moduleKey) => {
    const mod = modules.find(m => m.key === moduleKey);
    const hasCurrent = orders?.some(o => 
      mod.statuses.includes(o.status) && o.current_role === user?.role
    );
    
    if (orders?.some(o => o.status === 'completed')) return 'done';
    if (hasCurrent) return 'current';
    if (orders?.some(o => mod.statuses.includes(o.status))) return 'pending';
    return 'done';
  };

  const isModuleAccessible = (moduleKey) => {
    const mod = modules.find(m => m.key === moduleKey);
    return mod.role === user?.role || user?.role === 'operations_manager';
  };

  const handleModuleClick = (moduleKey) => {
    onChange(moduleKey);
    if (onRefresh) onRefresh();
  };

  return (
    <div class="business-modules">
      {modules.map(mod => {
        const count = getModuleCount(mod.key);
        const status = getModuleStatus(mod.key);
        const accessible = isModuleAccessible(mod.key);
        
        return (
          <div
            key={mod.key}
            class={`business-module ${active === mod.key ? 'active' : ''}`}
            onClick={() => accessible && handleModuleClick(mod.key)}
            style={{ opacity: accessible ? 1 : 0.6, cursor: accessible ? 'pointer' : 'not-allowed' }}
          >
            <div class="module-header">
              <div class={`module-icon ${mod.color}`}>{mod.icon}</div>
              <div>
                <div class="module-name">{mod.name}</div>
                <div style={{ fontSize: '11px', color: '#8c8c8c' }}>
                  责任人: {roleLabels[mod.role]}
                </div>
              </div>
            </div>
            <div class="module-desc">{mod.desc}</div>
            <div class="module-status">
              <span class={`module-status-dot ${status}`}></span>
              <span>
                {status === 'done' ? '已完成' : status === 'current' ? '处理中' : '待处理'}
              </span>
              <span style={{ marginLeft: 'auto', background: '#1890ff', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>
                {count} 条
              </span>
            </div>
            {!accessible && (
              <div style={{ fontSize: '11px', color: '#faad14', marginTop: '8px' }}>
                ⚠️ 需切换至{roleLabels[mod.role]}角色
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
