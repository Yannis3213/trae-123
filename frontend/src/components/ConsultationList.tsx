import { useState, useEffect } from 'react';
import { api, statusLabels, stageLabels, urgencyLabels, formatDateTime } from '../lib/api';
import type { User, Consultation, ProcessResult } from '../types';

interface Props {
  user: User;
  stage: string | null;
  onOpen: (id: string) => void;
  onNew?: () => void;
}

export default function ConsultationList({ user, stage, onOpen, onNew }: Props) {
  const [list, setList] = useState<Consultation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    status: '',
    urgency: '',
    department: '',
    patient_id: '',
    keyword: '',
  });
  const [showBatch, setShowBatch] = useState(false);
  const [batchAction, setBatchAction] = useState('');
  const [batchRemark, setBatchRemark] = useState('');
  const [batchEvidence, setBatchEvidence] = useState('');
  const [batchAbnormalReason, setBatchAbnormalReason] = useState('');
  const [batchAbnormalType, setBatchAbnormalType] = useState('');
  const [batchResult, setBatchResult] = useState<ProcessResult[] | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const loadList = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
        ...filters,
      };
      if (stage) params.stage = stage;
      const data: any = await api.listConsultations(params);
      setList(data.list || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadList(); }, [page, stage, user]);

  const handleSearch = () => { setPage(1); loadList(); };
  const handleReset = () => {
    setFilters({ status: '', urgency: '', department: '', patient_id: '', keyword: '' });
    setPage(1);
    setTimeout(loadList, 0);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const toggleSelectAll = () => {
    if (selected.size === list.length) setSelected(new Set());
    else setSelected(new Set(list.map(c => c.id)));
  };

  const isCorrectStage = (c: Consultation) => {
    if (!stage) return true;
    return c.current_stage === stage;
  };

  const canOperate = (c: Consultation) => {
    if (c.is_archived) return false;
    if (!isCorrectStage(c)) return false;
    switch (user.role) {
      case 'registrar':
        return c.created_by === user.id && c.current_stage === 'registration';
      case 'auditor':
        return c.current_stage === 'verification' && (!c.current_handler || c.current_handler === user.id);
      case 'reviewer':
        return c.current_stage === 'review';
      default:
        return false;
    }
  };

  const getBatchActions = () => {
    const actions: { key: string; label: string; needEvidence?: boolean; needAbnormalReason?: boolean; allowedStages?: string[] }[] = [];
    switch (user.role) {
      case 'registrar':
        actions.push({ key: 'submit', label: '提交审核', needEvidence: true, allowedStages: ['registration'] });
        actions.push({ key: 'correct', label: '补正提交', needEvidence: true, needAbnormalReason: true, allowedStages: ['registration'] });
        break;
      case 'auditor':
        actions.push({ key: 'verify_pass', label: '核验通过', needEvidence: true, allowedStages: ['verification'] });
        actions.push({ key: 'verify_fail', label: '核验异常', needAbnormalReason: true, allowedStages: ['verification'] });
        actions.push({ key: 'return', label: '退回补正', needAbnormalReason: true, allowedStages: ['verification'] });
        break;
      case 'reviewer':
        actions.push({ key: 'review_pass', label: '复核通过', needEvidence: true, allowedStages: ['review'] });
        actions.push({ key: 'archive', label: '归档', needEvidence: true, allowedStages: ['review'] });
        actions.push({ key: 'review_fail', label: '复核退回', needAbnormalReason: true, allowedStages: ['review'] });
        break;
    }
    return actions;
  };

  const actions = getBatchActions();

  const handleBatch = async () => {
    if (!batchAction) return;
    setBatchLoading(true);
    setBatchResult(null);
    try {
      const expectedVersions: Record<string, number> = {};
      list.forEach(c => { if (selected.has(c.id)) expectedVersions[c.id] = c.version; });
      const body: any = {
        ids: Array.from(selected),
        action: batchAction,
        remark: batchRemark,
        evidence_used: batchEvidence,
        expected_versions: expectedVersions,
        abnormal_type: batchAbnormalType || '批量处理异常',
        abnormal_reason: batchAbnormalReason,
      };
      const result: any = await api.batchProcess(body);
      setBatchResult(result.details || []);
      setSelected(new Set());
      loadList();
    } catch (err: any) {
      setBatchResult([{ success: false, message: err.message || '批量处理失败' }]);
    } finally {
      setBatchLoading(false);
    }
  };

  const getHandlerLabel = (c: Consultation) => {
    if (!c.current_handler) return <span style={{ color: 'var(--text-secondary)' }}>未分配</span>;
    if (c.current_handler === user.id) return <span style={{ color: 'var(--primary)', fontWeight: 600 }}>我处理</span>;
    return <span style={{ color: 'var(--text-secondary)' }}>其他处理人</span>;
  };

  const showStageColumn = !stage;
  const showHandlerColumn = user.role !== 'registrar';
  const showCheckboxCol = actions.length > 0;

  const totalCols = 8 + (showStageColumn ? 1 : 0) + (showHandlerColumn ? 1 : 0) + (showCheckboxCol ? 1 : 0);

  return (
    <div>
      <div className="alert info" style={{ marginBottom: 16 }}>
        当前视图：<strong>{roleHint(user.role, stage || '')}</strong>；后端已按角色收敛可见范围（仅返回您有权限看到的单据），列表、批量操作、详情权限一致
      </div>

      <div className="filter-bar">
        <div className="form-item">
          <label>状态</label>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">全部</option>
            <option value="pending">待确认</option>
            <option value="abnormal">异常</option>
            <option value="rechecked">已复查</option>
            <option value="archived">已归档</option>
          </select>
        </div>
        <div className="form-item">
          <label>紧急程度</label>
          <select value={filters.urgency} onChange={(e) => setFilters({ ...filters, urgency: e.target.value })}>
            <option value="">全部</option>
            <option value="normal">正常</option>
            <option value="warning">临期</option>
            <option value="overdue">逾期</option>
          </select>
        </div>
        <div className="form-item">
          <label>科室</label>
          <input value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })} placeholder="输入科室" />
        </div>
        <div className="form-item">
          <label>病案号</label>
          <input value={filters.patient_id} onChange={(e) => setFilters({ ...filters, patient_id: e.target.value })} placeholder="输入病案号" />
        </div>
        <div className="form-item">
          <label>关键词</label>
          <input value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} placeholder="搜索患者/病案号/原因" />
        </div>
        <button className="primary" onClick={handleSearch}>查询</button>
        <button onClick={handleReset}>重置</button>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          {onNew && user.role === 'registrar' && (stage === 'registration' || !stage) && (
            <button className="primary" onClick={onNew}>+ 新建会诊申请单</button>
          )}
          {actions.length > 0 && (
            <button onClick={() => setShowBatch(!showBatch)} disabled={selected.size === 0}>
              批量处理 {selected.size > 0 && `(${selected.size})`}
            </button>
          )}
        </div>
        <div className="toolbar-right" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          共 {total} 条 · 仅显示角色可见范围
        </div>
      </div>

      {showBatch && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginTop: 0 }}>批量处理（已选 {selected.size} 条，按角色和阶段逐条拦截）</div>
          <div className="form-row">
            <div className="form-item">
              <label>操作类型 *</label>
              <select value={batchAction} onChange={(e) => setBatchAction(e.target.value)}>
                <option value="">请选择</option>
                {actions.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </div>
            {actions.find(a => a.key === batchAction)?.needEvidence && (
              <div className="form-item">
                <label>使用证据（用英文逗号分隔）*</label>
                <input value={batchEvidence} onChange={(e) => setBatchEvidence(e.target.value)} placeholder="如：病历,心电图；必须从已登记证据中选" />
              </div>
            )}
            {actions.find(a => a.key === batchAction)?.needAbnormalReason && (
              <>
                <div className="form-item">
                  <label>异常类型</label>
                  <input value={batchAbnormalType} onChange={(e) => setBatchAbnormalType(e.target.value)} placeholder="如：缺材料/超时/状态冲突" />
                </div>
                <div className="form-item" style={{ gridColumn: '1 / -1' }}>
                  <label>异常/退回原因 *（每条都会持久化）</label>
                  <textarea value={batchAbnormalReason} onChange={(e) => setBatchAbnormalReason(e.target.value)} placeholder="请填写异常或退回原因，系统会逐条记录原因并关联到对应会诊申请单" />
                </div>
              </>
            )}
            <div className="form-item" style={{ gridColumn: '1 / -1' }}>
              <label>处理备注</label>
              <textarea value={batchRemark} onChange={(e) => setBatchRemark(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" onClick={handleBatch} disabled={batchLoading || !batchAction}>
              {batchLoading ? '逐条处理中...' : '确认批量处理（后端会按角色/阶段/状态/版本逐条拦截）'}
            </button>
            <button onClick={() => { setShowBatch(false); setBatchResult(null); }}>取消</button>
          </div>
          {batchResult && (
            <div className="batch-result">
              <div className="section-title">
                处理结果（成功 {batchResult.filter(r => r.success).length} / {batchResult.length}）
                <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
                  每条失败均有具体原因，可直接定位
                </span>
              </div>
              {batchResult.map((r, i) => (
                <div key={i} className={`batch-result-item ${r.success ? 'success' : 'fail'}`}>
                  <strong>[{r.id ? `单据 ${r.id}` : `第${i + 1}条`}]</strong>
                  ：{r.success ? '✓ ' : '✗ '}{r.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              {showCheckboxCol && (
                <th style={{ width: 40 }}>
                  <input type="checkbox" checked={selected.size === list.length && list.length > 0} onChange={toggleSelectAll} style={{ width: 'auto' }} />
                </th>
              )}
              <th>病案号</th>
              <th>患者姓名</th>
              <th>科室</th>
              <th>会诊类型</th>
              {showStageColumn && <th>当前阶段</th>}
              <th>状态</th>
              <th>紧急度</th>
              {showHandlerColumn && <th>当前处理人</th>}
              <th>截止时间</th>
              <th>版本</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={totalCols} style={{ textAlign: 'center', padding: 40 }}>加载中...</td></tr>
            )}
            {!loading && list.length === 0 && (
              <tr><td colSpan={totalCols} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                当前角色在该范围内暂无会诊申请单
              </td></tr>
            )}
            {list.map(c => (
              <tr key={c.id}>
                {showCheckboxCol && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      disabled={c.is_archived || !canOperate(c)}
                      style={{ width: 'auto' }}
                    />
                  </td>
                )}
                <td>{c.patient_id}</td>
                <td>{c.patient_name}</td>
                <td>{c.department}</td>
                <td>{c.consultation_type}</td>
                {showStageColumn && <td>{stageLabels[c.current_stage]}</td>}
                <td><span className={`badge ${c.status}`}>{statusLabels[c.status]}</span></td>
                <td><span className={`badge ${c.urgency}`}>{urgencyLabels[c.urgency]}</span></td>
                {showHandlerColumn && <td>{getHandlerLabel(c)}</td>}
                <td>{formatDateTime(c.deadline)}</td>
                <td>v{c.version}</td>
                <td>
                  <button onClick={() => onOpen(c.id)}>
                    {canOperate(c) ? '办理' : '查看'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>第 {page} 页</span>
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>上一页</button>
          <button disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)}>下一页</button>
        </div>
      </div>
    </div>
  );
}

function roleHint(role: string, stage: string): string {
  if (role === 'registrar' && stage === 'registration') return '科室秘书 - 会诊申请单登记工作台';
  if (role === 'auditor' && stage === 'verification') return '质控医生 - 过程核验工作台';
  if (role === 'reviewer' && stage === 'review') return '医务部主任 - 复核归档工作台';
  return stage;
}
