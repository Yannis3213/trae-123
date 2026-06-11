import { useState, useEffect } from 'preact/hooks';
import { fetchOverdueQueue, batchProcess } from '../api/client.js';
import BatchResultModal from './BatchResultModal.jsx';

const roleLabels = {
  store_manager: '门店店长',
  qc_specialist: '品控专员',
  operations_manager: '营运经理'
};

const exceptionTypeLabels = {
  missing_material: '缺材料',
  timeout: '超时',
  rejection: '退回补正',
  status_conflict: '状态冲突'
};

export default function OverdueQueue() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState({ normal: 0, near: 0, overdue: 0 });

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchOverdueQueue();
      setOrders(data);
      setStats({
        normal: data.filter(o => o.deadline_status === 'normal').length,
        near: data.filter(o => o.deadline_status === 'near').length,
        overdue: data.filter(o => o.deadline_status === 'overdue').length
      });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = filter === 'all'
    ? orders
    : orders.filter(o => o.deadline_status === filter);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredOrders.map(o => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id, checked) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const handleBatchTimeoutPush = async () => {
    if (selectedIds.length === 0) {
      showToast('请先选择要处理的订单', 'warning');
      return;
    }
    
    const overdueIds = selectedIds.filter(id => {
      const order = orders.find(o => o.id === id);
      return order?.deadline_status === 'overdue';
    });
    
    if (overdueIds.length === 0) {
      showToast('只能批量推进已逾期的订单', 'warning');
      return;
    }
    
    setBatchLoading(true);
    try {
      const result = await batchProcess(overdueIds, 'timeout-push');
      setBatchResult(result.results);
      loadData();
      setSelectedIds([]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBatchLoading(false);
    }
  };

  const getStatusStyle = (color) => ({
    background: color + '20',
    color: color
  });

  const filterTabs = [
    { key: 'all', label: '全部', count: orders.length },
    { key: 'normal', label: '正常', count: stats.normal },
    { key: 'near', label: '临期', count: stats.near },
    { key: 'overdue', label: '逾期', count: stats.overdue }
  ];

  return (
    <div>
      <div class="page-header">
        <h1 class="page-title">到期预警队列</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button class="btn btn-default" onClick={loadData}>
            🔄 刷新
          </button>
        </div>
      </div>

      <div class="demo-hint">
        <strong>节点超时按责任人计算：</strong>节点停留超过24小时标记为临期（黄色），超过截止时间标记为逾期（红色）。逾期订单可批量推进，系统逐条返回拦截结果。
      </div>

      <div class="stats-cards">
        <div class="stat-card success">
          <div class="stat-title">正常</div>
          <div class="stat-value">{stats.normal}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-title">临期 (≤24小时)</div>
          <div class="stat-value">{stats.near}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-title">逾期</div>
          <div class="stat-value">{stats.overdue}</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">待处理总数</div>
          <div class="stat-value">{orders.length}</div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-tabs">
          {filterTabs.map(tab => (
            <div
              key={tab.key}
              class={`filter-tab ${filter === tab.key ? 'active' : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
              <span class="filter-count">{tab.count}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div class="batch-actions">
          <span style={{ fontSize: '13px', color: '#595959' }}>
            已选择 <strong style={{ color: '#1890ff' }}>{selectedIds.length}</strong> 条
            （其中逾期 {selectedIds.filter(id => orders.find(o => o.id === id)?.deadline_status === 'overdue').length} 条）
          </span>
          <button 
            class="btn btn-danger" 
            onClick={handleBatchTimeoutPush}
            disabled={batchLoading}
          >
            {batchLoading && <span class="spinner" />}
            {batchLoading ? '推进中...' : '逾期批量推进'}
          </button>
          <button class="btn btn-default" onClick={() => setSelectedIds([])}>
            取消选择
          </button>
        </div>
      )}

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  class="checkbox"
                  checked={selectedIds.length === filteredOrders.length && filteredOrders.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th>订单号</th>
              <th>门店</th>
              <th>状态</th>
              <th>当前处理人</th>
              <th>责任人</th>
              <th>截止时间</th>
              <th>预警状态</th>
              <th>异常类型</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
                  <span class="spinner" /> 加载中...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
                  暂无数据
                </td>
              </tr>
            ) : (
              filteredOrders.map(order => (
                <tr key={order.id} class={selectedIds.includes(order.id) ? 'selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      class="checkbox"
                      checked={selectedIds.includes(order.id)}
                      onChange={(e) => handleSelect(order.id, e.target.checked)}
                    />
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: '500' }}>{order.order_no}</td>
                  <td>{order.store_name}</td>
                  <td>
                    <span class="status-tag" style={getStatusStyle(order.status_color)}>
                      {order.status_label}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: '#595959' }}>{order.current_role_label}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: '500', color: order.deadline_status === 'overdue' ? '#f5222d' : '#1f1f1f' }}>
                      {order.responsible_person || '-'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span>{order.deadline?.slice(0, 16) || '-'}</span>
                      <span class={`deadline-tag deadline-${order.deadline_status}`}>
                        {order.deadline_label}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span class={`deadline-tag deadline-${order.deadline_status}`} style={{ fontSize: '12px' }}>
                      {order.deadline_status === 'normal' ? '✓ 正常' :
                       order.deadline_status === 'near' ? '⚠️ 临期' : '❌ 逾期'}
                    </span>
                  </td>
                  <td>
                    {order.exception_type ? (
                      <span style={{ color: '#f5222d', fontSize: '12px' }}>
                        {exceptionTypeLabels[order.exception_type]}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    <button class="link-btn" onClick={() => window.location.href = `/order/${order.id}`}>
                      查看详情
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {batchResult && (
        <BatchResultModal
          results={batchResult}
          onClose={() => setBatchResult(null)}
        />
      )}

      {toast && (
        <div class={`toast alert-${toast.type}`} style={{ background: toast.type === 'success' ? '#f6ffed' : toast.type === 'error' ? '#fff1f0' : '#e6f7ff' }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
