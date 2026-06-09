import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request, ServiceOrder, Stats, User, ROLE_LABEL, DEADLINE_LABEL } from '../api';
import { showToast } from '../App';

const STATUS_OPTIONS = ['', '待分派', '已转办', '已回访'] as const;
const DEADLINE_OPTIONS = ['', 'normal', 'approaching', 'overdue'] as const;

export default function OrderList({ user }: { user: User }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<string>('');
  const [deadlineStatus, setDeadlineStatus] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [batchResults, setBatchResults] = useState<any[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [batchAction, setBatchAction] = useState<string | null>(null);
  const [batchHandlerId, setBatchHandlerId] = useState<number>(0);
  const [batchRemark, setBatchRemark] = useState('');
  const [batchCorrection, setBatchCorrection] = useState('');
  const [batchException, setBatchException] = useState('');

  const isOverdue = (o: ServiceOrder) => o.deadline_status === 'overdue' && !o.completed_at;

  const load = async () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (deadlineStatus) params.set('deadline_status', deadlineStatus);
    if (keyword) params.set('keyword', keyword);
    if (onlyMine) params.set('only_mine', '1');
    const res = await request<{ code: number; data: { list: ServiceOrder[]; stats: Stats } }>(
      `/orders?${params.toString()}`
    );
    if (res.code === 0) {
      setOrders(res.data.list);
      setStats(res.data.stats);
    }
  };

  useEffect(() => {
    load();
    request<{ code: number; data: User[] }>('/users').then(r => {
      if (r.code === 0) {
        setUsers(r.data);
        const bzr = r.data.find(u => u.role === 'banzhuren');
        if (bzr) setBatchHandlerId(bzr.id);
      }
    });
  }, [status, deadlineStatus, keyword, onlyMine]);

  const allSelected = orders.length > 0 && orders.every(o => selected.has(o.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(orders.map(o => o.id)));
  };

  const toggleOne = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const getBatchActions = () => {
    const acts: { key: string; label: string; color: string }[] = [];
    if (user.role === 'jiaowu') {
      acts.push({ key: '转办班主任', label: '批量转办班主任', color: 'btn-primary' });
    }
    if (user.role === 'banzhuren') {
      acts.push({ key: '完成回访转校长', label: '批量完成回访', color: 'btn-success' });
      acts.push({ key: '退回补正', label: '批量退回补正', color: 'btn-warning' });
    }
    if (user.role === 'xiaozhang') {
      acts.push({ key: '复核归档', label: '批量复核归档', color: 'btn-success' });
      acts.push({ key: '退回补正', label: '批量退回补正', color: 'btn-warning' });
    }
    return acts;
  };

  const openBatchDialog = (action: string) => {
    if (selected.size === 0) {
      showToast('请先勾选单据', 'error');
      return;
    }
    const selList = orders.filter(o => selected.has(o.id));
    if (action !== '退回补正') {
      const overdue = selList.filter(isOverdue);
      if (overdue.length > 0) {
        const keep = selList.filter(o => !isOverdue(o));
        if (keep.length === 0) {
          showToast(`已勾选的 ${overdue.length} 条单据均已逾期，仅允许"退回补正"类操作`, 'error');
          return;
        }
        setSelected(new Set(keep.map(o => o.id)));
        showToast(`自动排除 ${overdue.length} 条逾期单据（仅允许退回补正），剩余 ${keep.length} 条继续处理`, 'info');
      }
    }
    setBatchRemark('');
    setBatchCorrection('');
    setBatchException('');
    setBatchAction(action);
  };

  const submitBatch = async () => {
    if (!batchAction) return;
    let selectedOrders = orders.filter(o => selected.has(o.id));
    if (batchAction !== '退回补正') {
      const before = selectedOrders.length;
      selectedOrders = selectedOrders.filter(o => !isOverdue(o));
      if (selectedOrders.length === 0 && before > 0) {
        showToast('所选单据均已逾期，仅允许"退回补正"类操作', 'error');
        return;
      }
    }
    const body: any = {
      action: batchAction,
      orders: selectedOrders.map(o => ({ id: o.id, version: o.version })),
      remark: batchRemark || undefined,
    };
    if (batchAction === '转办班主任') {
      if (!batchHandlerId) { showToast('请选择处理人', 'error'); return; }
      body.handler_id = batchHandlerId;
    }
    if (batchAction === '退回补正') {
      if (!batchCorrection.trim()) { showToast('请填写补正动作', 'error'); return; }
      if (!batchException.trim()) { showToast('请填写异常原因', 'error'); return; }
      body.correction_action = batchCorrection;
      body.exception_reason = batchException;
    }
    const res = await request<{ code: number; msg: string; data: { items: any[] } }>('/orders/batch', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.code === 0) {
      const items = res.data.items;
      showToast(res.msg, items.every((x: any) => x.success) ? 'success' : 'info');
      setBatchResults(items);
      const latestById = new Map<number, any>();
      items.forEach((it: any) => {
        if (!it.success && it.latest) latestById.set(it.id, it.latest);
      });
      if (latestById.size > 0) {
        setOrders(prev => prev.map(o => {
          const lt = latestById.get(o.id);
          if (!lt) return o;
          return { ...o, ...lt, is_exception: !!lt.is_exception } as ServiceOrder;
        }));
      }
      const successIds = new Set(items.filter((x: any) => x.success).map((x: any) => x.id));
      setSelected(prev => {
        const next = new Set(prev);
        successIds.forEach(id => next.delete(id));
        return next;
      });
      if (successIds.size > 0) load();
    } else {
      showToast(res.msg || '批量处理失败', 'error');
    }
    setBatchAction(null);
  };

  const deadlineBadge = (s: ServiceOrder['deadline_status']) => (
    <span className={`deadline-tag deadline-${s}`}>{DEADLINE_LABEL[s]}</span>
  );

  return (
    <div className="container">
      {stats && (
        <div className="stats-row">
          <div className="stat-card"><div className="num">{stats.total}</div><div className="label">总数</div></div>
          <div className="stat-card pending"><div className="num">{stats.pending}</div><div className="label">待分派</div></div>
          <div className="stat-card transferred"><div className="num">{stats.transferred}</div><div className="label">已转办</div></div>
          <div className="stat-card reviewed"><div className="num">{stats.reviewed}</div><div className="label">已回访</div></div>
          <div className="stat-card normal"><div className="num">{stats.deadline_normal}</div><div className="label">到期预警·正常</div></div>
          <div className="stat-card approaching"><div className="num">{stats.deadline_approaching}</div><div className="label">到期预警·临期</div></div>
          <div className="stat-card overdue"><div className="num">{stats.deadline_overdue}</div><div className="label">到期预警·逾期</div></div>
        </div>
      )}

      <div className="filter-bar">
        <div className="field">
          <label>状态：</label>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || '全部状态'}</option>)}
          </select>
        </div>
        <div className="field">
          <label>到期：</label>
          <select value={deadlineStatus} onChange={e => setDeadlineStatus(e.target.value)}>
            {DEADLINE_OPTIONS.map(s => <option key={s} value={s}>{s === '' ? '全部到期' : DEADLINE_LABEL[s as ServiceOrder['deadline_status']]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>搜索：</label>
          <input placeholder="单号/学员/课程" value={keyword} onChange={e => setKeyword(e.target.value)} />
        </div>
        <div className="field">
          <label>
            <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} style={{ width: 'auto', marginRight: 4 }} />
            只看我负责
          </label>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {user.role === 'jiaowu' && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ 新建服务单</button>
          )}
          <button className="btn btn-default" onClick={load}>刷新</button>
        </div>
      </div>

      <div className="batch-bar">
        <div className="count">已勾选 <strong>{selected.size}</strong> / {orders.length} 条</div>
        {getBatchActions().map(a => (
          <button key={a.key} className={`btn ${a.color}`} onClick={() => openBatchDialog(a.key)}>
            {a.label}
          </button>
        ))}
      </div>

      {batchResults && batchResults.length > 0 && (
        <div className="batch-result">
          <div style={{ fontWeight: 600, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>批量处理结果（逐条反馈）：</span>
            <button className="btn-ghost" onClick={() => setBatchResults(null)}>关闭</button>
          </div>
          {batchResults.map((r, idx) => (
            <div key={`${r.id ?? 'x'}-${idx}`} className="item">
              <span>单据 {r.id ? `#${r.id}` : `（第${idx + 1}条）`}</span>
              <span className={r.success ? 'ok' : 'fail'}>
                {r.success ? '✅ 成功' : `❌ 失败：${r.msg}`}
              </span>
              {!r.success && r.latest && r.latest.exception_reason && (
                <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 12 }}>当前异常：{r.latest.exception_reason}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th>服务单号</th>
              <th>学员</th>
              <th>课程</th>
              <th>服务类型</th>
              <th>状态</th>
              <th>到期预警</th>
              <th>当前处理人</th>
              <th>异常原因</th>
              <th>截止时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={11}><div className="empty">暂无数据</div></td></tr>
            )}
            {orders.map(o => (
              <tr key={o.id} className={isOverdue(o) ? 'row-overdue' : ''}>
                <td><input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOne(o.id)} /></td>
                <td>
                  {o.order_no}
                  {o.is_exception && <span className="exception-tag">异常</span>}
                  {isOverdue(o) && <span className="exception-tag" style={{ background: '#b91c1c' }}>已逾期</span>}
                </td>
                <td>{o.student_name}{o.student_id && <div style={{ color: '#9ca3af', fontSize: 12 }}>{o.student_id}</div>}</td>
                <td>{o.course_name}</td>
                <td>{o.service_type}</td>
                <td><span className={`status-tag status-${o.status}`}>{o.status}</span></td>
                <td>{deadlineBadge(o.deadline_status)}</td>
                <td>{o.current_handler_name || '-'}</td>
                <td style={{ color: '#b91c1c', fontSize: 12 }}>{o.exception_reason || '-'}</td>
                <td>{o.deadline || '-'}</td>
                <td>
                  <button className="link-btn" onClick={() => navigate(`/orders/${o.id}`)}>详情 / 办理</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateDialog onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} user={user} />}

      {batchAction && (
        <BatchDialog
          action={batchAction}
          users={users}
          handlerId={batchHandlerId}
          setHandlerId={setBatchHandlerId}
          remark={batchRemark}
          setRemark={setBatchRemark}
          correction={batchCorrection}
          setCorrection={setBatchCorrection}
          exception={batchException}
          setException={setBatchException}
          selectedCount={selected.size}
          onClose={() => setBatchAction(null)}
          onSubmit={submitBatch}
        />
      )}
    </div>
  );
}

function BatchDialog({
  action, users, handlerId, setHandlerId, remark, setRemark,
  correction, setCorrection, exception, setException,
  selectedCount, onClose, onSubmit,
}: {
  action: string;
  users: User[];
  handlerId: number;
  setHandlerId: (n: number) => void;
  remark: string;
  setRemark: (s: string) => void;
  correction: string;
  setCorrection: (s: string) => void;
  exception: string;
  setException: (s: string) => void;
  selectedCount: number;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const banzhurens = users.filter(u => u.role === 'banzhuren');
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>批量操作 · {action}（共 {selectedCount} 条）</h3>
        {action === '转办班主任' && (
          <div className="form-item">
            <label>指派处理人（班主任）*</label>
            <select value={handlerId} onChange={e => setHandlerId(Number(e.target.value))}>
              {banzhurens.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
        {action === '退回补正' && (
          <>
            <div className="form-item">
              <label>补正动作 *</label>
              <input value={correction} onChange={e => setCorrection(e.target.value)} placeholder="例如：重新录制回访录音" />
            </div>
            <div className="form-item">
              <label>异常原因 *</label>
              <textarea rows={2} value={exception} onChange={e => setException(e.target.value)} placeholder="例如：回访录音不清晰" />
            </div>
          </>
        )}
        <div className="form-item">
          <label>备注</label>
          <textarea rows={2} value={remark} onChange={e => setRemark(e.target.value)} />
        </div>
        <div className="footer">
          <button className="btn btn-default" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={onSubmit}>确认提交</button>
        </div>
      </div>
    </div>
  );
}

function CreateDialog({ onClose, onCreated, user }: { onClose: () => void; onCreated: () => void; user: User }) {
  const [student_name, setStudentName] = useState('');
  const [student_id, setStudentId] = useState('');
  const [course_name, setCourseName] = useState('');
  const [service_type, setServiceType] = useState('课后反馈复核');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!student_name || !course_name || !service_type) {
      showToast('请填写必填项', 'error');
      return;
    }
    setLoading(true);
    const res = await request('/orders', {
      method: 'POST',
      body: JSON.stringify({
        student_name,
        student_id: student_id || undefined,
        course_name,
        service_type,
        description: description || undefined,
        deadline: deadline || undefined,
      }),
    });
    setLoading(false);
    if (res.code === 0) {
      showToast('创建成功', 'success');
      onCreated();
    } else {
      showToast(res.msg || '创建失败', 'error');
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>新建课程服务单（教务老师发起）</h3>
        <div className="form-item"><label>学员姓名 *</label><input value={student_name} onChange={e => setStudentName(e.target.value)} /></div>
        <div className="form-item"><label>学员编号</label><input value={student_id} onChange={e => setStudentId(e.target.value)} /></div>
        <div className="form-item"><label>课程名称 *</label><input value={course_name} onChange={e => setCourseName(e.target.value)} /></div>
        <div className="form-item">
          <label>服务类型 *</label>
          <select value={service_type} onChange={e => setServiceType(e.target.value)}>
            <option>课后反馈复核</option>
            <option>学员档案新增</option>
            <option>课程排班补正</option>
            <option>课后反馈缺记录补录</option>
            <option>补课回访</option>
          </select>
        </div>
        <div className="form-item"><label>情况描述</label><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div className="form-item"><label>截止时间</label><input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} /></div>
        <div className="footer">
          <button className="btn btn-default" onClick={onClose}>取消</button>
          <button className="btn btn-primary" disabled={loading} onClick={submit}>{loading ? '提交中...' : '提交'}</button>
        </div>
      </div>
    </div>
  );
}
