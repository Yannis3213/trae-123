import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useUser } from '../hooks/useUser';
import Toast, { type ToastType } from '../components/Toast';
import ProcessModal from '../components/ProcessModal';
import BatchResultModal from '../components/BatchResultModal';
import type {
  AppointmentsResponse,
  AppointmentListItem,
  UserRole,
  BatchProcessResponse,
  BatchResultItem,
} from '../types';

interface ToastState {
  message: string;
  type: ToastType;
  key: number;
}

const ROLE_OPTIONS: { role: UserRole; username: string; label: string }[] = [
  { role: 'beautician', username: '护理师-李娜', label: '护理师 李娜' },
  { role: 'beautician', username: '护理师-赵敏', label: '护理师 赵敏' },
  { role: 'consultant', username: '美容顾问-陈静', label: '美容顾问 陈静' },
  { role: 'consultant', username: '美容顾问-林美', label: '美容顾问 林美' },
  { role: 'store_manager', username: '店长-王芳', label: '门店店长 王芳' },
];

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'pending_review', label: '待复核' },
  { key: 'archived', label: '已归档' },
];

export default function ListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: userLoading, switchRole } = useUser();
  const [data, setData] = useState<AppointmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  const [processModal, setProcessModal] = useState<{ open: boolean; apt: AppointmentListItem | null }>({
    open: false,
    apt: null,
  });
  const [batchResult, setBatchResult] = useState<{ open: boolean; data: BatchProcessResponse | null }>({
    open: false,
    data: null,
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, key: Date.now() });
  };

  const loadData = async () => {
    setLoading(true);
    const resp = await api.listAppointments(statusFilter === 'all' ? undefined : statusFilter);
    if (resp.success && resp.data) {
      setData(resp.data);
    } else {
      showToast(resp.message, 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, user?.role]);

  useEffect(() => {
    if (location.pathname === '/' && sessionStorage.getItem('listNeedRefresh') === 'true') {
      sessionStorage.removeItem('listNeedRefresh');
      loadData();
    }
  }, [location.pathname]);

  const allItems = useMemo(() => {
    if (!data) return [];
    return [...data.normal, ...data.approaching, ...data.overdue];
  }, [data]);

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const opt = ROLE_OPTIONS.find((o) => `${o.role}|${o.username}` === e.target.value);
    if (opt) {
      const resp = await switchRole(opt.role, opt.username);
      if (resp.success) {
        showToast(`已切换为：${opt.label}`, 'success');
      } else {
        showToast(resp.message, 'error');
      }
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === allItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allItems.map((i) => i.id)));
    }
  };

  const handleBatchAction = async (action: string) => {
    if (selected.size === 0) {
      showToast('请先选择预约单', 'error');
      return;
    }
    const ids = Array.from(selected);
    const version_map: Record<string, number> = {};
    for (const item of allItems) {
      if (selected.has(item.id)) {
        version_map[item.id] = item.version;
      }
    }
    const resp = await api.batchProcess({
      appointment_ids: ids,
      action,
      remark: `批量${action === 'submit_review' ? '提交复核' : action === 'archive' ? '归档' : action === 'correction_submit' ? '提交补正' : action === 'return_to_correct' ? '退回补正' : action}`,
      version_map,
    });
    if (resp.success && resp.data) {
      setBatchResult({ open: true, data: resp.data });
      setSelected(new Set());
      loadData();
    } else {
      showToast(resp.message, 'error');
    }
  };

  const availableBatchActions = useMemo(() => {
    if (!user) return [];
    const actions: { key: string; label: string; className: string }[] = [];
    const selectedItems = allItems.filter((i) => selected.has(i.id));
    const hasException = selectedItems.some(
      (i) => i.exception_type === 'missing_materials' || i.exception_type === 'overdue' || i.exception_type === 'returned'
    );

    if (user.role === 'beautician') {
      if (!hasException) {
        actions.push({ key: 'submit_review', label: '批量提交复核', className: 'btn-primary' });
      }
      actions.push({ key: 'correction_submit', label: '批量提交补正', className: 'btn-secondary' });
    }
    if (user.role === 'consultant') {
      if (!hasException) {
        actions.push({ key: 'review_pass', label: '批量复核通过', className: 'btn-primary' });
      }
      actions.push({ key: 'return_to_correct', label: '批量退回补正', className: 'btn-danger' });
    }
    if (user.role === 'store_manager') {
      if (!hasException) {
        actions.push({ key: 'archive', label: '批量归档', className: 'btn-primary' });
      }
      actions.push({ key: 'return_to_correct', label: '批量退回补正', className: 'btn-danger' });
    }
    return actions;
  }, [user, selected, allItems]);

  if (loading || userLoading) {
    return (
      <div className="layout">
        <div className="header"><h1>美容连锁门店预约单系统</h1></div>
        <div className="container"><div className="loading">加载中...</div></div>
      </div>
    );
  }

  return (
    <div className="layout">
      <header className="header">
        <h1>🌸 美容连锁门店 · 月底集中处理预约单系统</h1>
        <div className="header-actions">
          <div className="user-label">当前用户：{user?.username || '未登录'}</div>
          <div className="role-switcher">
            <select
              value={user ? `${user.role}|${user.username}` : ''}
              onChange={handleRoleChange}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={`${opt.role}|${opt.username}`} value={`${opt.role}|${opt.username}`}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="container">
        {data && (
          <div className="stats-bar">
            <div className="stat-card">
              <div className="label">全部预约单</div>
              <div className="value">{data.stats.total}</div>
            </div>
            <div className="stat-card normal">
              <div className="label">正常</div>
              <div className="value">{data.stats.normal_count}</div>
            </div>
            <div className="stat-card approaching">
              <div className="label">临期（24小时内）</div>
              <div className="value">{data.stats.approaching_count}</div>
            </div>
            <div className="stat-card overdue">
              <div className="label">已逾期</div>
              <div className="value">{data.stats.overdue_count}</div>
            </div>
            <div className="stat-card draft">
              <div className="label">草稿</div>
              <div className="value">{data.stats.draft_count}</div>
            </div>
            <div className="stat-card pending">
              <div className="label">待复核</div>
              <div className="value">{data.stats.pending_review_count}</div>
            </div>
            <div className="stat-card archived">
              <div className="label">已归档</div>
              <div className="value">{data.stats.archived_count}</div>
            </div>
          </div>
        )}

        <div className="filter-bar">
          <div className="filter-left">
            <span style={{ color: '#909399', fontSize: 14 }}>状态筛选：</span>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                className={`filter-btn ${statusFilter === f.key ? 'active' : ''}`}
                onClick={() => setStatusFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={loadData}>
            🔄 刷新
          </button>
        </div>

        <div className="kanban-board">
          {(['normal', 'approaching', 'overdue'] as const).map((col) => (
            <KanbanColumn
              key={col}
              type={col}
              items={data?.[col] || []}
              selected={selected}
              onToggle={toggleSelect}
              onToggleAll={() => {
                const colItems = data?.[col] || [];
                const allSelected = colItems.every((i) => selected.has(i.id));
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (allSelected) {
                    colItems.forEach((i) => next.delete(i.id));
                  } else {
                    colItems.forEach((i) => next.add(i.id));
                  }
                  return next;
                });
              }}
              onClick={(apt) => navigate(`/appointments/${apt.id}`)}
            />
          ))}
        </div>

        {selected.size > 0 && (
          <div className="bulk-actions">
            <input
              type="checkbox"
              className="checkbox"
              checked={selected.size === allItems.length && allItems.length > 0}
              onChange={toggleSelectAll}
            />
            <span className="selected-info">
              已选择 <strong style={{ color: '#ff6b9d' }}>{selected.size}</strong> 个预约单
            </span>
            {availableBatchActions.map((a) => (
              <button
                key={a.key}
                className={`btn ${a.className}`}
                onClick={() => handleBatchAction(a.key)}
              >
                {a.label}
              </button>
            ))}
            <button className="btn btn-secondary" onClick={() => setSelected(new Set())}>
              取消选择
            </button>
          </div>
        )}
      </div>

      {processModal.open && processModal.apt && (
        <ProcessModal
          apt={processModal.apt}
          userRole={user?.role || 'store_manager'}
          username={user?.username || ''}
          onClose={() => setProcessModal({ open: false, apt: null })}
          onSuccess={() => {
            loadData();
            showToast('操作成功', 'success');
          }}
        />
      )}

      {batchResult.open && batchResult.data && (
        <BatchResultModal
          data={batchResult.data}
          onClose={() => setBatchResult({ open: false, data: null })}
        />
      )}

      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

interface ColumnProps {
  type: 'normal' | 'approaching' | 'overdue';
  items: AppointmentListItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onClick: (apt: AppointmentListItem) => void;
}

const EVIDENCE_ITEMS = [
  { key: 'customer_appointment', label: '预约', hasIcon: '✅', noIcon: '⭕' },
  { key: 'project_confirmation', label: '确认', hasIcon: '✅', noIcon: '⭕' },
  { key: 'service_followup', label: '回访', hasIcon: '✅', noIcon: '⭕' },
] as const;

function getEvidenceStatus(
  summary: any,
  key: 'customer_appointment' | 'project_confirmation' | 'service_followup',
): { has: boolean; count: number } {
  const hasMap: Record<string, boolean> = {
    customer_appointment: summary?.has_customer_appointment ?? false,
    project_confirmation: summary?.has_project_confirmation ?? false,
    service_followup: summary?.has_service_followup ?? false,
  };
  const countMap: Record<string, number> = {
    customer_appointment: summary?.customer_appointment_count ?? 0,
    project_confirmation: summary?.project_confirmation_count ?? 0,
    service_followup: summary?.service_followup_count ?? 0,
  };
  return { has: hasMap[key], count: countMap[key] };
}

function KanbanColumn({ type, items, selected, onToggle, onToggleAll, onClick }: ColumnProps) {
  const title = type === 'normal' ? '正常处理' : type === 'approaching' ? '临期预警' : '已逾期';
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));

  return (
    <div className="kanban-column">
      <div className={`kanban-column-header ${type}`}>
        <div className={`kanban-column-title ${type}`}>
          <input
            type="checkbox"
            className="checkbox"
            checked={allSelected}
            onChange={onToggleAll}
            onClick={(e) => e.stopPropagation()}
          />
          {title}
          <span className="kanban-count">{items.length}</span>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="empty">暂无数据</div>
      ) : (
        items.map((apt) => (
          <div
            key={apt.id}
            className={`card ${selected.has(apt.id) ? 'selected' : ''}`}
            onClick={() => onClick(apt)}
          >
            <div className="card-header" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                className="checkbox"
                checked={selected.has(apt.id)}
                onChange={() => onToggle(apt.id)}
              />
              <span className="card-order">{apt.order_no}</span>
            </div>
            <div className="card-title">{apt.customer_name} · {apt.service_item}</div>
            <div className="card-service">
              <span className={`card-status ${apt.status}`}>{apt.status_label}</span>
              {apt.exception_type_label && (
                <span className="card-exception">{apt.exception_type_label}</span>
              )}
            </div>
            <div className="card-evidence">
              {EVIDENCE_ITEMS.map((item) => {
                const st = getEvidenceStatus(apt.evidence_summary, item.key);
                return (
                  <span
                    key={item.key}
                    className={`evidence-tag ${st.has ? 'has' : 'missing'}`}
                    title={`${item.label}${st.has ? `(${st.count}份)` : '（缺失）'}`}
                  >
                    {st.has ? item.hasIcon : item.noIcon} {item.label}
                    {st.has && st.count > 0 && <span className="evidence-count">×{st.count}</span>}
                  </span>
                );
              })}
            </div>
            <div className="card-meta">
              <span className="card-handler">👤 {apt.current_handler}</span>
              <span className="card-deadline">⏰ {apt.deadline.slice(5, 16)}</span>
            </div>
            <div className="card-action-hint">点击卡片进入详情处理 →</div>
          </div>
        ))
      )}
    </div>
  );
}
