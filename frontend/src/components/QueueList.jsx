import { useState, useEffect } from 'preact/hooks';
import { fetchOrders, fetchOrderStats, batchProcess, createOrder, fetchStores } from '../api/client.js';
import BusinessModules from './BusinessModules.jsx';
import BatchResultModal from './BatchResultModal.jsx';
import CreateOrderModal from './CreateOrderModal.jsx';

const exceptionTypeLabels = {
  missing_material: '缺材料',
  timeout: '超时',
  rejection: '退回补正',
  status_conflict: '状态冲突'
};

export default function QueueList() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ counts: {}, deadlineStats: {} });
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeModule, setActiveModule] = useState('material');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    loadData();
  }, [filter, search, refreshTrigger]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersData, statsData] = await Promise.all([
        fetchOrders({ filter, search }),
        fetchOrderStats()
      ]);
      setOrders(ordersData);
      setStats(statsData);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(orders.map(o => o.id));
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
    
    setBatchLoading(true);
    try {
      const result = await batchProcess(selectedIds, 'timeout-push');
      setBatchResult(result.results);
      setRefreshTrigger(r => r + 1);
      setSelectedIds([]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleCreateOrder = async (data) => {
    try {
      await createOrder(data);
      showToast('订货单创建成功', 'success');
      setShowCreateModal(false);
      setRefreshTrigger(r => r + 1);
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const filterTabs = [
    { key: 'pending', label: '待确认', count: stats.counts?.pending || 0 },
    { key: 'exception', label: '异常', count: stats.counts?.exception || 0 },
    { key: 'rechecked', label: '已复查', count: stats.counts?.rechecked || 0 }
  ];

  const getStatusStyle = (color) => ({
    background: color + '20',
    color: color
  });

  return (
    <div>
      <div class="page-header">
        <h1 class="page-title">门店订货单队列</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button class="btn btn-default" onClick={() => setRefreshTrigger(r => r + 1)}>
            🔄 刷新队列
          </button>
          <button class="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + 新增订货单
          </button>
        </div>
      </div>

      <div class="demo-hint">
        <strong>角色边界校验：</strong>队列刷新前自动校验原料订货材料完整性、到货验收时限、库存回写证据。异常日志仅作为证据，不替代详情页真实处理结果。
      </div>

      <BusinessModules 
        active={activeModule}
        onChange={setActiveModule}
        orders={orders}
        onRefresh={() => setRefreshTrigger(r => r + 1)}
      />

      <div class="stats-cards">
        <div class="stat-card">
          <div class="stat-title">待处理</div>
          <div class="stat-value">{stats.counts?.pending || 0}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-title">异常</div>
          <div class="stat-value">{stats.counts?.exception || 0}</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-title">已复查</div>
          <div class="stat-value">{stats.counts?.rechecked || 0}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-title">已完成</div>
          <div class="stat-value">{stats.counts?.completed || 0}</div>
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
        <div style={{ flex: 1, maxWidth: '240px' }}>
          <input
            type="text"
            class="form-input"
            placeholder="搜索订单号或门店..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div class="batch-actions">
          <span style={{ fontSize: '13px', color: '#595959' }}>
            已选择 <strong style={{ color: '#1890ff' }}>{selectedIds.length}</strong> 条
          </span>
          <button 
            class="btn btn-danger" 
            onClick={handleBatchTimeoutPush}
            disabled={batchLoading}
          >
            {batchLoading && <span class="spinner" />}
            {batchLoading ? '处理中...' : '逾期批量推进'}
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
                  checked={selectedIds.length === orders.length && orders.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th>订单号</th>
              <th>门店</th>
              <th>状态</th>
              <th>当前处理人</th>
              <th>金额</th>
              <th>截止时间</th>
              <th>异常类型</th>
              <th>版本</th>
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
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
                  暂无数据
                </td>
              </tr>
            ) : (
              orders.map(order => (
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
                  <td>¥{order.total_amount?.toFixed(2)}</td>
                  <td>
                    <span class={`deadline-tag deadline-${order.deadline_status}`}>
                      {order.deadline?.slice(0, 10) || '-'}
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
                    <span class="version-tag">v{order.version}</span>
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

      {showCreateModal && (
        <CreateOrderModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateOrder}
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
