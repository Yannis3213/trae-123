'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  SamplingTask,
  ROLE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  UserRole,
} from '@/types';
import { taskApi, getOverdueStatus, formatDate, parseAbnormalTags } from '@/lib/api';
import { useRole } from '@/lib/roleContext';

export default function TaskListPage() {
  const router = useRouter();
  const { currentRole, setCurrentRole, currentUserName, refreshTrigger } = useRole();

  const [tasks, setTasks] = useState<SamplingTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [overdueFilter, setOverdueFilter] = useState('');
  const [keyword, setKeyword] = useState('');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchAction, setBatchAction] = useState('');
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [showBatchResults, setShowBatchResults] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchForm, setBatchForm] = useState({
    opinion: '',
    return_reason: '',
    audit_note: '',
    new_handler: '',
  });
  const [batchError, setBatchError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    task_name: '',
    order_no: '',
    style_no: '',
    priority: 'normal',
    deadline: '',
    responsible_person: '',
    initial_evidence: false,
  });
  const [createError, setCreateError] = useState('');

  const [statistics, setStatistics] = useState<any>(null);
  const [alertMsg, setAlertMsg] = useState<{ type: string; msg: string } | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await taskApi.list({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        overdue_status: overdueFilter || undefined,
        keyword: keyword || undefined,
        role: currentRole,
        page,
        page_size: pageSize,
      });
      setTasks(response.tasks);
      setTotal(response.total);
    } catch (e: any) {
      showAlert('error', e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, overdueFilter, keyword, currentRole, page]);

  const fetchStatistics = useCallback(async () => {
    try {
      const stats = await taskApi.getStatistics(currentRole);
      setStatistics(stats);
    } catch (e) {
      console.error('Failed to fetch statistics', e);
    }
  }, [currentRole]);

  useEffect(() => {
    fetchTasks();
    fetchStatistics();
  }, [fetchTasks, fetchStatistics, refreshTrigger]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [statusFilter, priorityFilter, overdueFilter, keyword, currentRole]);

  const showAlert = (type: string, msg: string) => {
    setAlertMsg({ type, msg });
    setTimeout(() => setAlertMsg(null), 3000);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(tasks.map((t) => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    }
  };

  const getAvailableBatchActions = () => {
    const actions: { value: string; label: string }[] = [];

    if (currentRole === 'sampling_registrar') {
      actions.push({ value: 'rectify', label: '批量补正' });
    }
    if (currentRole === 'sampling_supervisor') {
      actions.push({ value: 'assign', label: '批量分派' });
      actions.push({ value: 'review', label: '批量审核' });
      actions.push({ value: 'return', label: '批量退回' });
      actions.push({ value: 'reassign', label: '批量转办' });
    }
    if (currentRole === 'factory_reviewer') {
      actions.push({ value: 'verify', label: '批量复核' });
      actions.push({ value: 'archive', label: '批量归档' });
    }

    return actions;
  };

  const handleBatchActionClick = () => {
    if (!batchAction) {
      showAlert('warning', '请选择操作类型');
      return;
    }
    if (selectedIds.length === 0) {
      showAlert('warning', '请先选择要操作的任务');
      return;
    }
    setBatchForm({
      opinion: '',
      return_reason: '',
      audit_note: '',
      new_handler: '',
    });
    setBatchError('');
    setShowBatchForm(true);
  };

  const handleBatchSubmit = async () => {
    setBatchError('');

    if (batchAction === 'return') {
      if (!batchForm.opinion?.trim()) {
        setBatchError('批量退回必须填写处理意见');
        return;
      }
      if (!batchForm.return_reason?.trim()) {
        setBatchError('批量退回必须填写退回原因');
        return;
      }
      if (!batchForm.audit_note?.trim()) {
        setBatchError('批量退回必须填写审计备注');
        return;
      }
    }

    if (batchAction === 'reassign') {
      if (!batchForm.opinion?.trim()) {
        setBatchError('批量转办必须填写处理意见');
        return;
      }
      if (!batchForm.audit_note?.trim()) {
        setBatchError('批量转办必须填写审计备注');
        return;
      }
      if (!batchForm.new_handler) {
        setBatchError('请选择新处理人');
        return;
      }
    }

    try {
      const versionMap: Record<string, number> = {};
      tasks.forEach((t) => {
        if (selectedIds.includes(t.id)) {
          versionMap[t.id] = t.version;
        }
      });

      const results = await taskApi.batchProcess({
        task_ids: selectedIds,
        action: batchAction,
        operator_role: currentRole,
        operator_name: currentUserName,
        opinion: batchForm.opinion || undefined,
        return_reason: batchForm.return_reason || undefined,
        audit_note: batchForm.audit_note || undefined,
        new_handler: batchForm.new_handler || undefined,
        version_map: versionMap,
      });

      setShowBatchForm(false);
      setBatchResults(results);
      setShowBatchResults(true);

      const successCount = results.filter((r) => r.success).length;
      if (successCount > 0) {
        showAlert('success', `成功 ${successCount} 条，失败 ${results.length - successCount} 条`);
      } else {
        showAlert('error', '全部操作失败');
      }

      fetchTasks();
      fetchStatistics();
      setSelectedIds([]);
    } catch (e: any) {
      setBatchError(e.message || '批量操作失败');
    }
  };

  const handleCreateTask = async () => {
    setCreateError('');

    if (!createForm.task_name || !createForm.order_no || !createForm.deadline || !createForm.responsible_person) {
      setCreateError('请填写必填项');
      return;
    }

    try {
      await taskApi.create({
        task_name: createForm.task_name,
        order_no: createForm.order_no,
        style_no: createForm.style_no || undefined,
        priority: createForm.priority,
        deadline: new Date(createForm.deadline).toISOString(),
        responsible_person: createForm.responsible_person,
        created_by: currentUserName,
        operator_role: currentRole,
        initial_evidence: createForm.initial_evidence,
      });

      showAlert('success', '创建成功');
      setShowCreateModal(false);
      setCreateForm({
        task_name: '',
        order_no: '',
        style_no: '',
        priority: 'normal',
        deadline: '',
        responsible_person: '',
        initial_evidence: false,
      });
      fetchTasks();
      fetchStatistics();
    } catch (e: any) {
      setCreateError(e.message || '创建失败');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const overdueLabels: Record<string, string> = {
    normal: '正常',
    warning: '临期',
    overdue: '逾期',
  };
  const overdueColors: Record<string, string> = {
    normal: '#52c41a',
    warning: '#faad14',
    overdue: '#f5222d',
  };

  return (
    <div className="container">
      {alertMsg && (
        <div className={`alert alert-${alertMsg.type}`}>
          {alertMsg.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">服装加工厂 - 打样任务管理系统</div>
          <div className="page-subtitle">月底集中处理打样任务 · 按角色权限操作</div>
        </div>
        <div className="role-selector">
          <label>当前角色：</label>
          <select
            value={currentRole}
            onChange={(e) => setCurrentRole(e.target.value as UserRole)}
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}（{currentUserName}）
              </option>
            ))}
          </select>
        </div>
      </div>

      {statistics && (
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-card-title">全部任务</div>
            <div className="stat-card-value">{statistics.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">待分派</div>
            <div className="stat-card-value">{statistics.by_status.pending_assignment}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">待审核</div>
            <div className="stat-card-value">{statistics.by_status.pending_review}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">待复核</div>
            <div className="stat-card-value">{statistics.by_status.pending_verification}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">已归档</div>
            <div className="stat-card-value" style={{ color: '#52c41a' }}>
              {statistics.by_status.archived}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">已退回</div>
            <div className="stat-card-value" style={{ color: '#f5222d' }}>
              {statistics.by_status.returned}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">已转办</div>
            <div className="stat-card-value" style={{ color: '#fa8c16' }}>
              {statistics.by_status.transferred}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">已回访</div>
            <div className="stat-card-value" style={{ color: '#2f54eb' }}>
              {statistics.by_status.visited}
            </div>
          </div>
        </div>
      )}

      {statistics && (
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-card-title">正常</div>
            <div className="stat-card-value normal">{statistics.by_overdue.normal}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">临期（24小时内）</div>
            <div className="stat-card-value warning">{statistics.by_overdue.warning}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">逾期</div>
            <div className="stat-card-value overdue">{statistics.by_overdue.overdue}</div>
          </div>
        </div>
      )}

      <div className="filter-section">
        <div className="filter-row">
          <div className="filter-item">
            <label>状态</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">全部状态</option>
              <option value="pending_assignment">待分派</option>
              <option value="assigned">已分派</option>
              <option value="pending_review">待审核</option>
              <option value="reviewed">已审核</option>
              <option value="pending_verification">待复核</option>
              <option value="verified">已复核</option>
              <option value="archived">已归档</option>
              <option value="returned">已退回</option>
              <option value="transferred">已转办</option>
              <option value="visited">已回访</option>
            </select>
          </div>
          <div className="filter-item">
            <label>优先级</label>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">全部优先级</option>
              <option value="high">高</option>
              <option value="normal">中</option>
              <option value="low">低</option>
            </select>
          </div>
          <div className="filter-item">
            <label>到期状态</label>
            <select value={overdueFilter} onChange={(e) => setOverdueFilter(e.target.value)}>
              <option value="">全部</option>
              <option value="normal">正常</option>
              <option value="warning">临期</option>
              <option value="overdue">逾期</option>
            </select>
          </div>
          <div className="filter-item">
            <label>关键词</label>
            <input
              type="text"
              placeholder="搜索任务名称/订单号"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="filter-actions">
            <button className="btn btn-primary" onClick={() => setPage(1)}>
              搜索
            </button>
            <button
              className="btn btn-default"
              onClick={() => {
                setStatusFilter('');
                setPriorityFilter('');
                setOverdueFilter('');
                setKeyword('');
              }}
            >
              重置
            </button>
          </div>
        </div>
      </div>

      {currentRole === 'sampling_registrar' && (
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + 新建打样任务
          </button>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="batch-bar">
          <span className="count">已选择 {selectedIds.length} 项</span>
          <select
            value={batchAction}
            onChange={(e) => setBatchAction(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
          >
            <option value="">选择批量操作</option>
            {getAvailableBatchActions().map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={handleBatchActionClick}>
            执行
          </button>
          <button className="btn btn-default btn-sm" onClick={() => setSelectedIds([])}>
            取消
          </button>
          <button className="btn btn-default btn-sm" onClick={() => setShowBatchResults(true)}>
            查看结果
          </button>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={tasks.length > 0 && selectedIds.length === tasks.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th>任务名称</th>
              <th>订单号</th>
              <th>优先级</th>
              <th>状态</th>
              <th>责任人</th>
              <th>当前处理人</th>
              <th>截止时间</th>
              <th>到期状态</th>
              <th>大货排产证据</th>
              <th>异常标签</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="loading">
                  加载中...
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={12} className="empty">
                  暂无数据
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
                const overdueStatus = task.is_overdue ? 'overdue' : getOverdueStatus(task.deadline);
                const abnormalTags = parseAbnormalTags(task.abnormal_tags);

                return (
                  <tr key={task.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedIds.includes(task.id)}
                        onChange={(e) => handleSelectOne(task.id, e.target.checked)}
                      />
                    </td>
                    <td>
                      <Link href={`/task/${task.id}`} className="link">
                        {task.task_name}
                      </Link>
                    </td>
                    <td>{task.order_no}</td>
                    <td>
                      <span
                        className="tag tag-priority"
                        style={{ background: PRIORITY_COLORS[task.priority] || '#999' }}
                      >
                        {PRIORITY_LABELS[task.priority] || task.priority}
                      </span>
                    </td>
                    <td>
                      <span
                        className="tag tag-status"
                        style={{ background: STATUS_COLORS[task.status] || '#999' }}
                      >
                        {STATUS_LABELS[task.status] || task.status}
                      </span>
                    </td>
                    <td>{task.responsible_person}</td>
                    <td>{task.current_handler}</td>
                    <td>{formatDate(task.deadline)}</td>
                    <td>
                      <span style={{ color: overdueColors[overdueStatus], fontWeight: 500 }}>
                        {overdueLabels[overdueStatus]}
                      </span>
                    </td>
                    <td>
                      {task.has_mass_production_evidence ? (
                        <span style={{ color: '#52c41a' }}>已提供</span>
                      ) : (
                        <span style={{ color: '#f5222d' }}>缺失</span>
                      )}
                    </td>
                    <td>
                      {abnormalTags.map((tag, i) => (
                        <span key={i} className="tag tag-abnormal">
                          {tag}
                        </span>
                      ))}
                    </td>
                    <td>
                      <Link href={`/task/${task.id}`} className="link">
                        详情
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="pagination">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            上一页
          </button>
          <span className="info">
            第 {page} / {totalPages || 1} 页，共 {total} 条
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            下一页
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-mask" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">新建打样任务</div>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {createError && <div className="alert alert-error">{createError}</div>}

              <div className="form-group">
                <label>任务名称 *</label>
                <input
                  type="text"
                  value={createForm.task_name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, task_name: e.target.value })
                  }
                  placeholder="请输入打样任务名称"
                />
              </div>

              <div className="form-group">
                <label>订单号 *</label>
                <input
                  type="text"
                  value={createForm.order_no}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, order_no: e.target.value })
                  }
                  placeholder="请输入订单号"
                />
              </div>

              <div className="form-group">
                <label>款式号</label>
                <input
                  type="text"
                  value={createForm.style_no}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, style_no: e.target.value })
                  }
                  placeholder="请输入款式号（可选）"
                />
              </div>

              <div className="form-group">
                <label>优先级</label>
                <select
                  value={createForm.priority}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, priority: e.target.value })
                  }
                >
                  <option value="high">高</option>
                  <option value="normal">中</option>
                  <option value="low">低</option>
                </select>
              </div>

              <div className="form-group">
                <label>截止时间 *</label>
                <input
                  type="datetime-local"
                  value={createForm.deadline}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, deadline: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>责任人 *</label>
                <input
                  type="text"
                  value={createForm.responsible_person}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, responsible_person: e.target.value })
                  }
                  placeholder="请输入责任人姓名"
                />
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={createForm.initial_evidence}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, initial_evidence: e.target.checked })
                    }
                    style={{ marginRight: '8px' }}
                  />
                  初始已提供大货排产证据
                </label>
                <div className="hint">如未提供，审核和归档环节将无法通过</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowCreateModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleCreateTask}>
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchForm && (
        <div className="modal-mask" onClick={() => setShowBatchForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">批量{batchAction === 'return' ? '退回' : batchAction === 'reassign' ? '转办' : '操作'}</div>
              <button className="modal-close" onClick={() => setShowBatchForm(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {batchError && <div className="alert alert-error">{batchError}</div>}

              <div className="alert alert-info">
                已选择 {selectedIds.length} 个任务进行批量{batchAction === 'return' ? '退回' : batchAction === 'reassign' ? '转办' : '操作'}
              </div>

              <div className="form-group">
                <label>处理意见 *</label>
                <textarea
                  value={batchForm.opinion}
                  onChange={(e) =>
                    setBatchForm({ ...batchForm, opinion: e.target.value })
                  }
                  placeholder="请输入处理意见（必填）"
                />
              </div>

              {batchAction === 'return' && (
                <div className="form-group">
                  <label>退回原因 *</label>
                  <textarea
                    value={batchForm.return_reason}
                    onChange={(e) =>
                      setBatchForm({ ...batchForm, return_reason: e.target.value })
                    }
                    placeholder="请详细说明退回原因（必填）"
                  />
                </div>
              )}

              {batchAction === 'reassign' && (
                <div className="form-group">
                  <label>新处理人 *</label>
                  <select
                    value={batchForm.new_handler}
                    onChange={(e) =>
                      setBatchForm({ ...batchForm, new_handler: e.target.value })
                    }
                  >
                    <option value="">请选择</option>
                    <option value="sampling_supervisor">打样审核主管（李主管）</option>
                    <option value="factory_reviewer">加工厂复核负责人（王厂长）</option>
                    <option value="sampling_registrar">打样登记员（张登记）</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>审计备注 *</label>
                <textarea
                  value={batchForm.audit_note}
                  onChange={(e) =>
                    setBatchForm({ ...batchForm, audit_note: e.target.value })
                  }
                  placeholder="请输入审计备注（必填，将记录到审计轨迹中）"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowBatchForm(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleBatchSubmit}>
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchResults && batchResults.length > 0 && (
        <div className="modal-mask" onClick={() => setShowBatchResults(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">批量操作结果</div>
              <button className="modal-close" onClick={() => setShowBatchResults(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="batch-results">
                {batchResults.map((result, index) => (
                  <div
                    key={index}
                    className={`batch-result-item ${result.success ? 'success' : 'failure'}`}
                  >
                    <div>
                      <div className="batch-result-task">
                        {result.success ? '✓ 成功' : '✗ 失败'} - {result.task_name || result.task_id}
                      </div>
                      <div className="batch-result-msg">{result.message}</div>
                      {!result.success && (
                        <Link
                          href={`/task/${result.task_id}`}
                          className="link"
                          style={{ marginTop: '8px', display: 'inline-block' }}
                          onClick={() => setShowBatchResults(false)}
                        >
                          → 前往详情页补正
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowBatchResults(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
