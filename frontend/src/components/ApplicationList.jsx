import { createSignal, createEffect, For } from 'solid-js';
import { api } from '../api';

const statusTabs = [
  { key: 'pending', label: '待接单' },
  { key: 'accepted', label: '已接单' },
  { key: 'passed', label: '验收通过' },
];

const evidenceTypeOptions = [
  { value: 'identity_proof', label: '身份证明' },
  { value: 'difficulty_proof', label: '困难证明' },
  { value: 'visit_record', label: '走访记录' },
  { value: 'photo_evidence', label: '照片证据' },
  { value: 'approval_document', label: '审批文件' },
  { value: 'amount_calculation', label: '金额计算表' },
];

export default function ApplicationList({ user, onViewDetail, onBatchProcess, onCreate, onUpdated, refreshTrigger }) {
  const [activeTab, setActiveTab] = createSignal('pending');
  const [applications, setApplications] = createSignal([]);
  const [selectedIds, setSelectedIds] = createSignal(new Set());
  const [warningStats, setWarningStats] = createSignal({ normal: 0, approaching: 0, overdue: 0 });
  const [loading, setLoading] = createSignal(false);
  const [filters, setFilters] = createSignal({
    current_node: '',
    warning_status: '',
    community: '',
    keyword: '',
  });

  const [showReturnModal, setShowReturnModal] = createSignal(false);
  const [returnTarget, setReturnTarget] = createSignal(null);
  const [returnComment, setReturnComment] = createSignal('');
  const [returnProcessing, setReturnProcessing] = createSignal(false);
  const [returnError, setReturnError] = createSignal('');

  const [showCorrectModal, setShowCorrectModal] = createSignal(false);
  const [correctTarget, setCorrectTarget] = createSignal(null);
  const [correctAttachments, setCorrectAttachments] = createSignal([]);
  const [newAttName, setNewAttName] = createSignal('');
  const [newAttType, setNewAttType] = createSignal('');
  const [correctProcessing, setCorrectProcessing] = createSignal(false);
  const [correctError, setCorrectError] = createSignal('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [apps, stats] = await Promise.all([
        api.getApplications({ status: activeTab(), ...filters() }),
        api.getWarningStats(),
      ]);
      setApplications(apps);
      setWarningStats(stats);
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    loadData();
  }, [activeTab, refreshTrigger]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds().size === applications().length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(applications().map((a) => a.id)));
    }
  };

  const selectedApplications = () =>
    applications().filter((a) => selectedIds().has(a.id));

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const getAvailableActions = () => {
    if (user.role === 'community_worker') {
      return ['correct', 'submit'];
    } else if (user.role === 'street_clerk') {
      return ['accept', 'process', 'return'];
    } else if (user.role === 'leader') {
      return ['accept', 'approve', 'reject', 'return'];
    }
    return [];
  };

  const actionLabels = {
    accept: '接单',
    process: '处理流转',
    verify: '核实流转',
    return: '退回补正',
    correct: '补正提交',
    submit: '提交申请',
    approve: '审批通过',
    reject: '不予通过',
    confirm: '确认通过',
  };

  const communities = ['阳光社区', '幸福社区', '和平社区'];
  const nodes = [
    { value: 'difficulty_support', label: '困难帮扶' },
    { value: 'home_verification', label: '入户核实' },
    { value: 'rescue_confirmation', label: '救助确认' },
  ];
  const warnings = [
    { value: 'normal', label: '正常' },
    { value: 'approaching', label: '临期' },
    { value: 'overdue', label: '逾期' },
  ];

  const handleReturnClick = (app) => {
    setReturnTarget(app);
    setReturnComment('');
    setReturnError('');
    setShowReturnModal(true);
  };

  const handleReturnSubmit = async () => {
    if (!returnComment()) {
      setReturnError('请填写退回原因');
      return;
    }
    setReturnProcessing(true);
    setReturnError('');
    try {
      await api.processApplication({
        application_id: returnTarget().id,
        version: returnTarget().version,
        action: 'return',
        comment: returnComment(),
      });
      setShowReturnModal(false);
      setReturnTarget(null);
      loadData();
      onUpdated && onUpdated();
    } catch (err) {
      setReturnError(`${err.error_code}: ${err.error_message}`);
    } finally {
      setReturnProcessing(false);
    }
  };

  const handleCorrectClick = (app) => {
    setCorrectTarget(app);
    setCorrectAttachments([]);
    setNewAttName('');
    setNewAttType('');
    setCorrectError('');
    setShowCorrectModal(true);
  };

  const addCorrectAttachment = () => {
    if (!newAttName() || !newAttType()) {
      setCorrectError('请填写材料名称和选择材料类型');
      return;
    }
    setCorrectAttachments((prev) => [...prev, { file_name: newAttName(), evidence_type: newAttType(), is_required: true }]);
    setNewAttName('');
    setNewAttType('');
    setCorrectError('');
  };

  const removeCorrectAttachment = (idx) => {
    setCorrectAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCorrectSubmit = async () => {
    setCorrectProcessing(true);
    setCorrectError('');
    try {
      let currentApp = correctTarget();
      for (const att of correctAttachments()) {
        const result = await api.uploadAttachment({
          application_id: currentApp.id,
          file_name: att.file_name,
          evidence_type: att.evidence_type,
          is_required: att.is_required,
        });
        currentApp = result;
      }
      await api.processApplication({
        application_id: currentApp.id,
        version: currentApp.version,
        action: 'correct',
        comment: '补正材料已上传，重新提交',
      });
      setShowCorrectModal(false);
      setCorrectTarget(null);
      loadData();
      onUpdated && onUpdated();
    } catch (err) {
      setCorrectError(`${err.error_code}: ${err.error_message}`);
    } finally {
      setCorrectProcessing(false);
    }
  };

  const getRowActions = (app) => {
    const actions = [];
    if (app.status === 'accepted' && (user.role === 'street_clerk' || user.role === 'leader')) {
      actions.push({ label: '退回补正', key: 'return', onClick: () => handleReturnClick(app) });
    }
    if (app.status === 'returned' && user.role === 'community_worker') {
      actions.push({ label: '补正', key: 'correct', onClick: () => handleCorrectClick(app) });
    }
    return actions;
  };

  return (
    <div>
      <div class="page-title">帮扶申请管理</div>

      <div class="warning-stats">
        <div class="stat-card normal">
          <div class="stat-value normal">{warningStats().normal}</div>
          <div class="stat-label">正常</div>
        </div>
        <div class="stat-card approaching">
          <div class="stat-value approaching">{warningStats().approaching}</div>
          <div class="stat-label">临期</div>
        </div>
        <div class="stat-card overdue">
          <div class="stat-value overdue">{warningStats().overdue}</div>
          <div class="stat-label">逾期</div>
        </div>
      </div>

      <div class="tabs">
        {statusTabs.map((tab) => (
          <div
            key={tab.key}
            class={`tab ${activeTab() === tab.key ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.key);
              setSelectedIds(new Set());
            }}
          >
            {tab.label}
          </div>
        ))}
      </div>

      <div class="filters">
        <div class="filter-item">
          <label>节点：</label>
          <select
            value={filters().current_node}
            onChange={(e) => handleFilterChange('current_node', e.target.value)}
          >
            <option value="">全部</option>
            {nodes.map((n) => (
              <option value={n.value}>{n.label}</option>
            ))}
          </select>
        </div>
        <div class="filter-item">
          <label>预警：</label>
          <select
            value={filters().warning_status}
            onChange={(e) => handleFilterChange('warning_status', e.target.value)}
          >
            <option value="">全部</option>
            {warnings.map((w) => (
              <option value={w.value}>{w.label}</option>
            ))}
          </select>
        </div>
        <div class="filter-item">
          <label>社区：</label>
          <select
            value={filters().community}
            onChange={(e) => handleFilterChange('community', e.target.value)}
          >
            <option value="">全部</option>
            {communities.map((c) => (
              <option value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div class="filter-item">
          <label>搜索：</label>
          <input
            type="text"
            placeholder="申请人/申请号"
            value={filters().keyword}
            onInput={(e) => handleFilterChange('keyword', e.target.value)}
          />
        </div>
        <button class="btn btn-primary btn-sm" onClick={loadData}>
          查询
        </button>
        <button class="btn btn-default btn-sm" onClick={() => {
          setFilters({ current_node: '', warning_status: '', community: '', keyword: '' });
          loadData();
        }}>
          重置
        </button>
      </div>

      <div class="table-container">
        <div class="table-toolbar">
          <div>
            {user.role === 'community_worker' && activeTab() === 'pending' && (
              <button class="btn btn-primary" onClick={onCreate}>
                + 新建申请
              </button>
            )}
            {selectedIds().size > 0 && user.role !== 'community_worker' && (
              <span style={{ marginLeft: '16px', color: '#595959' }}>
                已选择 {selectedIds().size} 条
              </span>
            )}
          </div>
          <div>
            {selectedIds().size > 0 && user.role !== 'community_worker' && (
              <For each={getAvailableActions()}>
                {(action) => (
                  <button
                    class="btn btn-success btn-sm"
                    style={{ marginLeft: '8px' }}
                    onClick={() => onBatchProcess(selectedApplications(), action)}
                  >
                    批量{actionLabels[action] || action}
                  </button>
                )}
              </For>
            )}
            <button class="btn btn-default btn-sm" style={{ marginLeft: '8px' }} onClick={loadData}>
              刷新
            </button>
          </div>
        </div>

        {loading() ? (
          <div class="loading">加载中...</div>
        ) : applications().length === 0 ? (
          <div class="empty-state">暂无数据</div>
        ) : (
          <table class="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    class="checkbox"
                    checked={selectedIds().size === applications().length && applications().length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>申请编号</th>
                <th>申请人</th>
                <th>社区</th>
                <th>困难类型</th>
                <th>当前节点</th>
                <th>状态</th>
                <th>预警</th>
                <th>当前处理人</th>
                <th>截止时间</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <For each={applications()}>
                {(app) => {
                  const rowActions = getRowActions(app);
                  return (
                    <tr>
                      <td>
                        <input
                          type="checkbox"
                          class="checkbox"
                          checked={selectedIds().has(app.id)}
                          onChange={() => toggleSelect(app.id)}
                        />
                      </td>
                      <td>{app.application_no}</td>
                      <td>{app.applicant_name}</td>
                      <td>{app.community}</td>
                      <td>{app.difficulty_type}</td>
                      <td>{app.current_node_name}</td>
                      <td>
                        <span class={`badge badge-${app.status}`}>
                          {app.status_name}
                        </span>
                      </td>
                      <td>
                        <span class={`badge badge-${app.warning_status}`}>
                          {app.warning_status_name}
                        </span>
                      </td>
                      <td>{app.current_handler || '-'}</td>
                      <td>{formatDate(app.node_deadline)}</td>
                      <td>{formatDate(app.created_at)}</td>
                      <td>
                        <span class="action-link" onClick={() => onViewDetail(app.id)}>
                          详情
                        </span>
                        {rowActions.map((act) => (
                          <span class="action-link" style={{ marginLeft: '8px', color: '#fa8c16' }} onClick={act.onClick}>
                            {act.label}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        )}
      </div>

      {showReturnModal() && (
        <div class="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowReturnModal(false)}>
          <div class="modal" style={{ maxWidth: '500px' }}>
            <div class="modal-header">
              <h3>退回补正</h3>
              <button class="close-btn" onClick={() => setShowReturnModal(false)}>&times;</button>
            </div>
            <div class="modal-body">
              {returnError() && <div class="error-message">{returnError()}</div>}
              <p>申请编号：{returnTarget()?.application_no}</p>
              <p>申请人：{returnTarget()?.applicant_name}</p>
              <div class="form-group">
                <label>退回原因 <span style={{color:'red'}}>*</span></label>
                <textarea
                  value={returnComment()}
                  onInput={(e) => setReturnComment(e.target.value)}
                  placeholder="请填写退回补正的具体原因"
                  rows={4}
                />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-default" onClick={() => setShowReturnModal(false)}>取消</button>
              <button class="btn btn-warning" onClick={handleReturnSubmit} disabled={returnProcessing()}>
                {returnProcessing() ? '处理中...' : '确认退回'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCorrectModal() && (
        <div class="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCorrectModal(false)}>
          <div class="modal" style={{ maxWidth: '600px' }}>
            <div class="modal-header">
              <h3>补正材料</h3>
              <button class="close-btn" onClick={() => setShowCorrectModal(false)}>&times;</button>
            </div>
            <div class="modal-body">
              {correctError() && <div class="error-message">{correctError()}</div>}
              <p>申请编号：{correctTarget()?.application_no}</p>
              <p>申请人：{correctTarget()?.applicant_name}</p>
              <div class="detail-section">
                <h4>添加补正材料</h4>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '12px' }}>
                  <div class="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>材料名称</label>
                    <input
                      type="text"
                      value={newAttName()}
                      onInput={(e) => setNewAttName(e.target.value)}
                      placeholder="如：走访记录.docx"
                    />
                  </div>
                  <div class="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>材料类型</label>
                    <select value={newAttType()} onChange={(e) => setNewAttType(e.target.value)}>
                      <option value="">请选择</option>
                      {evidenceTypeOptions.map((opt) => (
                        <option value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <button class="btn btn-primary btn-sm" onClick={addCorrectAttachment}>添加</button>
                </div>
                {correctAttachments().length > 0 && (
                  <table class="table">
                    <thead>
                      <tr>
                        <th>材料名称</th>
                        <th>材料类型</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={correctAttachments()}>
                        {(att, idx) => (
                          <tr>
                            <td>{att.file_name}</td>
                            <td>{evidenceTypeOptions.find(o => o.value === att.evidence_type)?.label || att.evidence_type}</td>
                            <td>
                              <span class="action-link" style={{ color: '#ff4d4f' }} onClick={() => removeCorrectAttachment(idx())}>移除</span>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-default" onClick={() => setShowCorrectModal(false)}>取消</button>
              <button class="btn btn-primary" onClick={handleCorrectSubmit} disabled={correctProcessing()}>
                {correctProcessing() ? '提交中...' : '提交补正'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
