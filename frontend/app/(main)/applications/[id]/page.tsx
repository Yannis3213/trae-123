'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  fetchApplicationDetail,
  processApplication,
  addAuditNote,
  ApplicationDetailResponse,
  getUser,
  User,
} from '@/lib/api';
import Link from 'next/link';

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [data, setData] = useState<ApplicationDetailResponse | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [remark, setRemark] = useState('');
  const [evidence, setEvidence] = useState('');
  const [exceptionType, setExceptionType] = useState('缺材料');
  const [exceptionReason, setExceptionReason] = useState('');
  const [showActionModal, setShowActionModal] = useState(false);
  const [auditNote, setAuditNote] = useState('');
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    setUser(getUser());
    loadDetail();
  }, [id]);

  const loadDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchApplicationDetail(id);
      setData(res);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const openAction = (act: string) => {
    setAction(act);
    setRemark('');
    setEvidence('');
    setExceptionReason('');
    setError('');
    setShowActionModal(true);
  };

  const handleAction = async () => {
    if (!data) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await processApplication(
        id,
        action,
        data.application.version,
        remark,
        evidence,
        exceptionType,
        exceptionReason,
      );
      setData(res);
      setShowActionModal(false);
      setAction('');
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAudit = async () => {
    if (!auditNote.trim()) return;
    try {
      const res = await addAuditNote(id, auditNote);
      if (data) {
        setData({ ...data, audit_notes: res.audit_notes });
      }
      setAuditNote('');
      setShowAuditModal(false);
    } catch (err: any) {
      setError(err.message || '添加失败');
    }
  };

  if (loading) return <div>加载中...</div>;
  if (!data) return <div className="alert alert-error">{error || '加载失败'}</div>;

  const app = data.application;
  const availableActions = getAvailableActions(user, app);
  const hasUnresolvedException = data.exception_reasons.some((e) => !e.is_resolved);

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link href="/applications" style={{ color: '#64748b', fontSize: '13px' }}>← 返回列表</Link>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginTop: '4px' }}>
            开户申请详情
            <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#64748b', marginLeft: '12px' }}>
              {app.application_no}
            </span>
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className={`badge ${statusBadge(app.status)}`} style={{ fontSize: '14px', padding: '4px 14px' }}>
            {app.status}
          </span>
          <span className={`badge ${dueBadge(app.due_status)}`} style={{ fontSize: '14px', padding: '4px 14px' }}>
            {app.due_status}
          </span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {hasUnresolvedException && (
        <div className="alert alert-warning">
          ⚠️ 该申请存在未解决的异常，请查看「异常原因」标签
        </div>
      )}

      <div className="tabs">
        <div className={`tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>基本信息</div>
        <div className={`tab ${activeTab === 'records' ? 'active' : ''}`} onClick={() => setActiveTab('records')}>
          处理记录
          {data.processing_records.length > 0 && (
            <span style={{ marginLeft: '4px', fontSize: '12px' }}>({data.processing_records.length})</span>
          )}
        </div>
        <div className={`tab ${activeTab === 'exceptions' ? 'active' : ''}`} onClick={() => setActiveTab('exceptions')}>
          异常原因
          {hasUnresolvedException && <span style={{ marginLeft: '4px' }}>●</span>}
        </div>
        <div className={`tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>审计备注</div>
        <div className={`tab ${activeTab === 'attachments' ? 'active' : ''}`} onClick={() => setActiveTab('attachments')}>附件</div>
      </div>

      {activeTab === 'info' && (
        <div className="card">
          <div className="card-title">客户信息</div>
          <div className="detail-grid" style={{ marginBottom: '24px' }}>
            <div className="detail-item">
              <label>客户姓名</label>
              <div className="value">{app.customer_name}</div>
            </div>
            <div className="detail-item">
              <label>身份证号</label>
              <div className="value">{app.id_card_no}</div>
            </div>
            <div className="detail-item">
              <label>联系电话</label>
              <div className="value">{app.phone}</div>
            </div>
            <div className="detail-item">
              <label>所属支行</label>
              <div className="value">{app.branch}</div>
            </div>
            <div className="detail-item" style={{ gridColumn: 'span 2' }}>
              <label>地址</label>
              <div className="value">{app.address}</div>
            </div>
          </div>

          <div className="card-title">账户信息</div>
          <div className="detail-grid" style={{ marginBottom: '24px' }}>
            <div className="detail-item">
              <label>账户类型</label>
              <div className="value">{app.account_type}</div>
            </div>
            <div className="detail-item">
              <label>开户金额</label>
              <div className="value">¥{app.amount.toLocaleString()}</div>
            </div>
            <div className="detail-item">
              <label>客户经理</label>
              <div className="value">{app.customer_manager}</div>
            </div>
            <div className="detail-item">
              <label>当前处理人</label>
              <div className="value">{app.current_handler || '待分配'}</div>
            </div>
          </div>

          <div className="card-title">状态与版本</div>
          <div className="detail-grid">
            <div className="detail-item">
              <label>申请状态</label>
              <div className="value">
                <span className={`badge ${statusBadge(app.status)}`}>{app.status}</span>
              </div>
            </div>
            <div className="detail-item">
              <label>到期状态</label>
              <div className="value">
                <span className={`badge ${dueBadge(app.due_status)}`}>{app.due_status}</span>
              </div>
            </div>
            <div className="detail-item">
              <label>到期日期</label>
              <div className="value">{app.due_date}</div>
            </div>
            <div className="detail-item">
              <label>当前版本</label>
              <div className="value">v{app.version}</div>
            </div>
            <div className="detail-item">
              <label>创建时间</label>
              <div className="value" style={{ fontSize: '13px' }}>
                {new Date(app.created_at).toLocaleString('zh-CN')}
              </div>
            </div>
            <div className="detail-item">
              <label>更新时间</label>
              <div className="value" style={{ fontSize: '13px' }}>
                {new Date(app.updated_at).toLocaleString('zh-CN')}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'records' && (
        <div className="card">
          <div className="card-title">处理记录（审计轨迹）</div>
          {data.processing_records.length === 0 ? (
            <div className="empty-state">暂无处理记录</div>
          ) : (
            <div className="timeline">
              {data.processing_records.map((rec) => (
                <div key={rec.id} className="timeline-item">
                  <div className="time">
                    {new Date(rec.created_at).toLocaleString('zh-CN')}
                  </div>
                  <div className="title">
                    {rec.action}
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748b', marginLeft: '8px' }}>
                      v{rec.version_before} → v{rec.version_after}
                    </span>
                  </div>
                  <div className="meta">
                    操作人：{rec.operator}（{rec.operator_role}）
                    {rec.from_status && rec.to_status && (
                      <span style={{ marginLeft: '12px' }}>
                        状态：{rec.from_status} → <strong>{rec.to_status}</strong>
                      </span>
                    )}
                  </div>
                  {rec.remark && <div className="desc">备注：{rec.remark}</div>}
                  {rec.evidence_provided && (
                    <div className="desc" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      📋 审核证据：{rec.evidence_provided}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'exceptions' && (
        <div className="card">
          <div className="card-title">异常原因</div>
          {data.exception_reasons.length === 0 ? (
            <div className="empty-state">暂无异常记录</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.exception_reasons.map((exc) => (
                <div
                  key={exc.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${exc.is_resolved ? '#bbf7d0' : '#fecaca'}`,
                    background: exc.is_resolved ? '#f0fdf4' : '#fef2f2',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600 }}>
                      <span className={`badge ${exc.is_resolved ? 'badge-green' : 'badge-red'}`} style={{ marginRight: '8px' }}>
                        {exc.is_resolved ? '已解决' : '未解决'}
                      </span>
                      {exc.reason_type}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      上报：{exc.reported_by}（{exc.reported_by_role}）
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '14px' }}>{exc.description}</div>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                    创建：{new Date(exc.created_at).toLocaleString('zh-CN')}
                    {exc.resolved_at && (
                      <span style={{ marginLeft: '12px' }}>
                        解决：{exc.resolved_by} · {new Date(exc.resolved_at).toLocaleString('zh-CN')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>审计备注</span>
            {(user?.role === '运营主管' || user?.role === '支行行长') && (
              <button className="btn btn-sm btn-primary" onClick={() => setShowAuditModal(true)}>
                + 添加备注
              </button>
            )}
          </div>
          {data.audit_notes.length === 0 ? (
            <div className="empty-state">暂无审计备注</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.audit_notes.map((note) => (
                <div key={note.id} style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}>
                  <div style={{ fontSize: '14px' }}>{note.note}</div>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                    {note.noted_by}（{note.noted_by_role}）· {new Date(note.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'attachments' && (
        <div className="card">
          <div className="card-title">附件材料</div>
          {data.attachments.length === 0 ? (
            <div className="empty-state">暂无附件</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>文件名</th>
                  <th>类型</th>
                  <th>上传人</th>
                  <th>上传时间</th>
                </tr>
              </thead>
              <tbody>
                {data.attachments.map((att) => (
                  <tr key={att.id}>
                    <td>📄 {att.file_name}</td>
                    <td>{att.file_type}</td>
                    <td>{att.uploaded_by}</td>
                    <td>{new Date(att.uploaded_at).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {availableActions.length > 0 && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-title">可执行操作</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {availableActions.map((act) => (
              <button
                key={act.action}
                className={`btn ${act.btnClass}`}
                onClick={() => openAction(act.action)}
              >
                {act.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showActionModal && (
        <div className="modal-overlay" onClick={() => setShowActionModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>{action} - {app.application_no}</span>
              <button className="close-btn" onClick={() => setShowActionModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}

              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                <div>当前状态：<strong>{app.status}</strong></div>
                <div>当前版本：v{app.version}</div>
                <div>当前处理人：{app.current_handler || '待分配'}</div>
              </div>

              <div className="form-group">
                <label>备注说明</label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={3}
                  placeholder="请输入操作备注..."
                />
              </div>

              {(action === '审核通过' || action === '复核通过') && (
                <div className="form-group">
                  <label>审核证据 / 已核查材料 <span style={{ color: '#dc2626' }}>*</span></label>
                  <textarea
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                    rows={3}
                    placeholder="请列出已核查的材料，如：身份证复印件、住址证明、收入证明..."
                  />
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    审核通过必须提供证据，说明已核查哪些材料
                  </div>
                </div>
              )}

              {action === '退回补正' && (
                <>
                  <div className="form-group">
                    <label>异常类型</label>
                    <select value={exceptionType} onChange={(e) => setExceptionType(e.target.value)}>
                      <option value="缺材料">缺材料</option>
                      <option value="材料有误">材料有误</option>
                      <option value="信息不符">信息不符</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>退回原因 / 补正要求 <span style={{ color: '#dc2626' }}>*</span></label>
                    <textarea
                      value={exceptionReason}
                      onChange={(e) => setExceptionReason(e.target.value)}
                      rows={3}
                      placeholder="请详细说明需要补正的内容..."
                    />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowActionModal(false)}>取消</button>
              <button
                className="btn btn-primary"
                onClick={handleAction}
                disabled={actionLoading}
              >
                {actionLoading ? '处理中...' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAuditModal && (
        <div className="modal-overlay" onClick={() => setShowAuditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>添加审计备注</span>
              <button className="close-btn" onClick={() => setShowAuditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>备注内容</label>
                <textarea
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                  rows={4}
                  placeholder="请输入审计备注..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowAuditModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleAddAudit} disabled={!auditNote.trim()}>
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function statusBadge(s: string) {
  switch (s) {
    case '待签收': return 'badge-blue';
    case '异常回传': return 'badge-red';
    case '签收完成': return 'badge-green';
    default: return 'badge-gray';
  }
}

function dueBadge(d: string) {
  switch (d) {
    case '正常': return 'badge-green';
    case '临期': return 'badge-yellow';
    case '逾期': return 'badge-red';
    default: return 'badge-gray';
  }
}

function getAvailableActions(user: User | null, app: any): { action: string; label: string; btnClass: string }[] {
  if (!user) return [];
  const actions: { action: string; label: string; btnClass: string }[] = [];
  const role = user.role;
  const status = app.status;
  const handler = app.current_handler;
  const currentRole = app.current_role;

  if (role === '客户经理') {
    if (status === '异常回传' && app.customer_manager === user.real_name) {
      actions.push({ action: '补正重提', label: '补正重提', btnClass: 'btn-success' });
    }
  }

  if (role === '运营主管' && currentRole === '运营主管') {
    if (status === '待签收') {
      if (!handler || handler === user.real_name) {
        if (!handler) {
          actions.push({ action: '签收', label: '签收处理', btnClass: 'btn-primary' });
        }
        if (handler === user.real_name) {
          actions.push({ action: '审核通过', label: '审核通过', btnClass: 'btn-success' });
          actions.push({ action: '退回补正', label: '退回补正', btnClass: 'btn-danger' });
        }
      }
    }
  }

  if (role === '支行行长' && currentRole === '支行行长') {
    if (status === '待签收') {
      if (!handler || handler === user.real_name) {
        if (!handler) {
          actions.push({ action: '签收', label: '签收复核', btnClass: 'btn-primary' });
        }
        if (handler === user.real_name) {
          actions.push({ action: '复核通过', label: '复核通过', btnClass: 'btn-success' });
          actions.push({ action: '退回补正', label: '退回补正', btnClass: 'btn-danger' });
        }
      }
    }
  }

  return actions;
}
