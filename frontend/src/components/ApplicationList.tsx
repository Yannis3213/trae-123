import { useEffect, useState } from 'react';
import { applicationApi } from '../api/client';
import type {
  ReplenishmentApplication,
  ApplicationStatus,
  Priority,
  User,
} from '../types';
import {
  STATUS_DISPLAY,
  STATUS_COLOR,
  PRIORITY_DISPLAY,
  PRIORITY_COLOR,
} from '../types';
import { useAuthStore } from '../store/auth';
import CreateApplicationModal from './CreateApplicationModal';

interface ApplicationListProps {
  users: User[];
  onSelect: (app: ReplenishmentApplication) => void;
}

export default function ApplicationList({ users, onSelect }: ApplicationListProps) {
  const { visibleScope } = useAuthStore();
  const [apps, setApps] = useState<ReplenishmentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [keyword, setKeyword] = useState('');
  const [onlyMine, setOnlyMine] = useState(visibleScope?.can_view_all ? false : true);
  const [stats, setStats] = useState({ total: 0, pending: 0, near: 0, overdue: 0 });
  const [createOpen, setCreateOpen] = useState(false);

  const fetchData = () => {
    setLoading(true);
    applicationApi
      .list({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        keyword: keyword || undefined,
        mine: onlyMine,
      })
      .then((data) => {
        setApps(data);
        setStats({
          total: data.length,
          pending: data.filter((a) => a.status !== 'archived').length,
          near: data.filter((a) => a.is_near_deadline && !a.is_overdue).length,
          overdue: data.filter((a) => a.is_overdue).length,
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (visibleScope !== undefined && visibleScope !== null) {
      setOnlyMine(!visibleScope.can_view_all);
    }
  }, [visibleScope?.can_view_all]);

  useEffect(() => {
    fetchData();
  }, [statusFilter, priorityFilter, keyword, onlyMine]);

  const getUserName = (id: string) =>
    users.find((u) => u.id === id)?.display_name || id;

  const deadlineClass = (app: ReplenishmentApplication) => {
    if (app.is_overdue) return 'warning-overdue';
    if (app.is_near_deadline) return 'warning-near';
    return 'warning-normal';
  };

  const deadlineText = (app: ReplenishmentApplication) => {
    if (app.is_overdue) return '已逾期';
    if (app.is_near_deadline) return '临近截止';
    return '正常';
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('zh-CN');

  return (
    <div>
      <div className="page-header">
        <div className="page-title">补货申请待办队列</div>
        <div className="page-subtitle">
          按职责拆分处理队列，列表、详情、批量结果围绕补货申请命名，并实时回写申请状态
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">申请总数</div>
          <div className="stat-value primary">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">待处理</div>
          <div className="stat-value">{stats.pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">临近截止</div>
          <div className="stat-value warning">{stats.near}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">已逾期</div>
          <div className="stat-value danger">{stats.overdue}</div>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <input
            type="text"
            placeholder="🔍 搜索单据号/标题/描述..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | '')}
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="pending_signature">待签收</option>
            <option value="exception_returned">异常回传</option>
            <option value="correction_pending">待补正</option>
            <option value="signature_complete">签收完成</option>
            <option value="archived">已归档</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as Priority | '')}
          >
            <option value="">全部优先级</option>
            <option value="urgent">紧急</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
              style={{ minWidth: 'auto' }}
            />
            只看我的待办
          </label>
          {visibleScope?.can_create && (
            <button
              className="btn btn-success"
              onClick={() => setCreateOpen(true)}
              style={{ marginLeft: 'auto' }}
            >
              ➕ 新建补货申请
            </button>
          )}
          <button className="btn" onClick={fetchData} style={visibleScope?.can_create ? {} : { marginLeft: 'auto' }}>
            🔄 刷新
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>单据号</th>
                <th>门店</th>
                <th>标题</th>
                <th>责任人</th>
                <th>当前处理人</th>
                <th>优先级</th>
                <th>状态</th>
                <th>截止时间</th>
                <th>预警</th>
                <th>异常标签</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="empty-state">
                    <span className="spinner" /> 加载中...
                  </td>
                </tr>
              ) : apps.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty-state">
                    暂无补货申请
                  </td>
                </tr>
              ) : (
                apps.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <strong>{app.application_no}</strong>
                    </td>
                    <td>{app.store_name}</td>
                    <td>{app.title}</td>
                    <td>{getUserName(app.responsible_person)}</td>
                    <td>{getUserName(app.current_handler)}</td>
                    <td>
                      <span
                        className="priority-dot"
                        style={{ background: PRIORITY_COLOR[app.priority] }}
                      />
                      {PRIORITY_DISPLAY[app.priority]}
                    </td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ background: STATUS_COLOR[app.status] }}
                      >
                        {STATUS_DISPLAY[app.status]}
                      </span>
                    </td>
                    <td>{formatDate(app.deadline)}</td>
                    <td className={deadlineClass(app)}>{deadlineText(app)}</td>
                    <td>
                      {app.exception_tags.map((tag, i) => (
                        <span
                          key={i}
                          className={`tag ${tag.includes('逾期') || tag.includes('异常') ? 'tag-red' : 'tag-blue'}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '5px 12px', fontSize: '13px' }}
                        onClick={() => onSelect(app)}
                      >
                        办理
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <CreateApplicationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchData}
      />
    </div>
  );
}
