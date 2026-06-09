import { useState, useEffect, useCallback } from 'react';
import {
  api,
  type StudentApplication,
  type Attachment,
  type ProcessingRecord,
  type AuditNote,
  type ExceptionRecord,
  type EvidenceSummary,
  type User,
  type ProcessResponse,
} from '../lib/api';

interface Props {
  applicationId: string;
  user: User;
  onBack: () => void;
  onRefresh: () => void;
  onProcessed: () => void;
}

export default function ApplicationDetail({
  applicationId,
  user,
  onBack,
  onRefresh,
  onProcessed,
}: Props) {
  const [application, setApplication] = useState<StudentApplication | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [records, setRecords] = useState<ProcessingRecord[]>([]);
  const [notes, setNotes] = useState<AuditNote[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([]);
  const [evidenceSummary, setEvidenceSummary] = useState<EvidenceSummary | null>(null);
  const [newNote, setNewNote] = useState('');
  const [actionRemark, setActionRemark] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLastError(null);
    try {
      const data = await api.getApplication(applicationId);
      if (data && data.error) {
        setLastError(data.error);
        setApplication(null);
      } else {
        setApplication(data.application);
        setAttachments(data.attachments);
        setRecords(data.records);
        setNotes(data.notes);
        setExceptions(data.exceptions);
        setEvidenceSummary(data.evidence_summary);
      }
    } catch (e: any) {
      setLastError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    if (applicationId) {
      loadData();
    }
  }, [applicationId, loadData]);

  const handleAction = async (action: string) => {
    if (!application) return;
    setActionLoading(action);
    setLastError(null);
    try {
      const res: ProcessResponse = await api.processApplication(
        application.id,
        action,
        actionRemark,
        application.version,
      );
      if (res && res.success) {
        const msg = res.message || '操作成功';
        const versionInfo = res.new_version ? `（新版本 v${res.new_version}）` : '';
        const handlerInfo = res.new_handler ? ` → ${res.new_handler}` : '';
        alert('✅ 操作成功：' + msg + versionInfo + handlerInfo);
        setActionRemark('');
        await loadData();
        onProcessed();
        onRefresh();
      } else {
        const err = res?.error || '未知错误';
        const excType = res?.exc_type ? ` [${res.exc_type}]` : '';
        const verInfo = res?.curr_version ? `（当前版本 v${res.curr_version}）` : '';
        setLastError(err + excType + verInfo);
        alert('❌ 操作失败：' + err + excType + verInfo);
        await loadData();
      }
    } catch (e: any) {
      setLastError(e.message);
      alert('❌ 操作失败：' + e.message);
      await loadData();
    } finally {
      setActionLoading('');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      const res = await api.addNote(applicationId, newNote);
      if (res && res.error) {
        alert('❌ 添加备注失败：' + res.error);
      } else {
        setNewNote('');
        await loadData();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const getStatusBadge = (s: string) => {
    const map: Record<string, string> = {
      待分派: 'badge-pending',
      已转办: 'badge-transferred',
      已回访: 'badge-visited',
    };
    return <span className={`badge ${map[s] || 'badge-pending'}`}>{s}</span>;
  };

  const getUrgencyBadge = (u: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      normal: { cls: 'badge-normal', label: '正常' },
      warning: { cls: 'badge-warning', label: '临期' },
      overdue: { cls: 'badge-overdue', label: '逾期' },
    };
    const cfg = map[u] || map.normal;
    return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
  };

  const roleLabels: Record<string, string> = {
    registrar: '登记员',
    auditor: '审核主管',
    reviewer: '复核负责人',
  };

  const actionLabels: Record<string, string> = {
    create: '创建单据',
    assign: '分派审核',
    audit_pass: '审核通过',
    audit_reject: '退回补正',
    review_archive: '复核归档',
    supplement: '补正材料',
    correct_reject: '退回补正',
  };

  const excTypeLabels: Record<string, string> = {
    version_conflict: '版本冲突',
    permission_denied: '权限不足',
    status_conflict: '状态冲突',
    missing_evidence: '证据缺失',
    overdue: '节点逾期',
    missing_materials: '资料缺失',
    return_correction: '退回补正',
    not_found: '单据不存在',
    query_failed: '查询失败',
    tx_failed: '事务失败',
    update_failed: '更新失败',
    record_failed: '记录失败',
    commit_failed: '提交失败',
    invalid_action: '无效操作',
  };

  if (loading && !application) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>加载中...</div>
    );
  }

  if (lastError && !application) {
    return (
      <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
        <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: '20px' }}>
          ← 返回列表
        </button>
        <div className="card" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <h3 style={{ color: '#991b1b', marginBottom: '12px' }}>⚠ 访问被拒绝</h3>
          <p style={{ color: '#374151' }}>{lastError}</p>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>无数据</div>
    );
  }

  const canAssign = user.role === 'registrar' && application.status === '待分派';
  const canAuditPass = user.role === 'auditor' && application.status === '已转办';
  const canAuditReject = user.role === 'auditor' && application.status === '已转办';
  const canReviewArchive = user.role === 'reviewer' && application.status === '已回访';
  const canSupplement = user.role === 'registrar' && application.status === '待分派';

  const isCurrentHandler =
    application.current_handler === user.id || application.current_handler_role === user.role;

  return (
    <div style={{ padding: '20px', maxWidth: '1280px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <button className="btn btn-secondary" onClick={onBack}>
          ← 返回列表（自动刷新）
        </button>
        <h2 style={{ fontSize: '20px', color: '#1e3a8a' }}>学员报名单详情</h2>
        {getStatusBadge(application.status)}
        {getUrgencyBadge(application.urgency)}
        <span
          style={{
            fontSize: '13px',
            color: '#6b7280',
            fontFamily: 'monospace',
          }}
        >
          ID: {application.id.slice(0, 12)}...
        </span>
        <span className="badge badge-normal">版本 v{application.version}</span>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-secondary"
          onClick={() => {
            loadData();
            onRefresh();
          }}
          style={{ fontSize: '13px' }}
        >
          🔄 刷新详情与列表
        </button>
      </div>

      {lastError && (
        <div
          className="card"
          style={{
            marginBottom: '20px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            padding: '12px 16px',
            color: '#991b1b',
            fontSize: '14px',
          }}
        >
          ⚠ {lastError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#1e3a8a' }}>
              📋 基本信息
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
              }}
            >
              {[
                ['学员姓名', application.student_name],
                ['身份证号', application.id_card],
                ['联系电话', application.phone],
                ['报考专业', application.program],
                ['当前状态', application.status],
                ['当前版本', 'v' + application.version],
                [
                  '当前处理人',
                  application.current_handler_name +
                    '（' +
                    roleLabels[application.current_handler_role] +
                    '）',
                ],
                [
                  '下一处理人',
                  application.next_handler_name
                    ? application.next_handler_name +
                      '（' +
                      roleLabels[application.next_handler_role] +
                      '）'
                    : '-',
                ],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <div
                    style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}
                  >
                    {label}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #f3f4f6',
              }}
            >
              <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>⏰ 时限与责任人</h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>分派截止</div>
                  <div style={{ fontSize: '13px' }}>
                    {new Date(application.assignment_deadline).toLocaleDateString('zh-CN')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>审核截止</div>
                  <div style={{ fontSize: '13px' }}>
                    {new Date(application.audit_deadline).toLocaleDateString('zh-CN')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>复核截止</div>
                  <div style={{ fontSize: '13px' }}>
                    {new Date(application.review_deadline).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <span className="badge badge-overdue">
                  ⚠ 责任人：{application.responsible_person_name}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#1e3a8a' }}>
              📎 报名资料附件（{attachments.length}份）
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {attachments.length === 0 ? (
                <span style={{ color: '#6b7280', fontSize: '13px' }}>暂无附件</span>
              ) : (
                attachments.map((att) => (
                  <div
                    key={att.id}
                    style={{
                      padding: '8px 12px',
                      background: att.verified ? '#f0fdf4' : '#fef2f2',
                      border: '1px solid ' + (att.verified ? '#bbf7d0' : '#fecaca'),
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  >
                    {att.verified ? '✓' : '✗'} {att.type} - {att.name}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#1e3a8a' }}>
              🔄 处理流程顺序（共 {records.length} 步）
            </h3>
            <div style={{ position: 'relative' }}>
              {records.map((rec, idx) => (
                <div
                  key={rec.id}
                  style={{
                    display: 'flex',
                    gap: '16px',
                    marginBottom: idx < records.length - 1 ? '0' : '0',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: rec.is_correction ? '#fef2f2' : '#2563eb',
                        color: rec.is_correction ? '#dc2626' : 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: 600,
                        zIndex: 1,
                        border: rec.is_correction ? '2px solid #dc2626' : 'none',
                      }}
                    >
                      {idx + 1}
                    </div>
                    {idx < records.length - 1 && (
                      <div
                        style={{
                          width: '2px',
                          flex: 1,
                          background: rec.is_correction ? '#fecaca' : '#bfdbfe',
                          margin: '4px 0',
                        }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, paddingBottom: '20px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>
                        {actionLabels[rec.action] || rec.action}
                      </span>
                      {rec.is_correction && <span className="badge badge-overdue">补正动作</span>}
                      <span className="badge badge-normal">v{rec.version}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      {rec.handler_name}（{roleLabels[rec.handler_role]}） ·{' '}
                      {new Date(rec.created_at).toLocaleString('zh-CN')}
                    </div>
                    {(rec.previous_status || rec.new_status) && (
                      <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                        {rec.previous_status && <span>{rec.previous_status}</span>}
                        {rec.previous_status && rec.new_status && (
                          <span style={{ margin: '0 8px' }}>→</span>
                        )}
                        {rec.new_status && (
                          <span style={{ fontWeight: 500 }}>{rec.new_status}</span>
                        )}
                      </div>
                    )}
                    {rec.remark && (
                      <div
                        style={{
                          fontSize: '13px',
                          padding: '8px 12px',
                          background: '#f9fafb',
                          borderRadius: '4px',
                          color: '#374151',
                        }}
                      >
                        💬 {rec.remark}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#1e3a8a' }}>
              💬 审计备注
            </h3>
            <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="添加备注..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                style={{ flex: 1 }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              />
              <button className="btn btn-primary" onClick={handleAddNote}>
                添加
              </button>
            </div>
            {notes.length === 0 ? (
              <span style={{ color: '#6b7280', fontSize: '13px' }}>暂无备注</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {notes.map((n) => (
                  <div
                    key={n.id}
                    style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px' }}
                  >
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      {n.user_name} · {new Date(n.created_at).toLocaleString('zh-CN')}
                    </div>
                    <div style={{ fontSize: '14px' }}>{n.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <h3 style={{ fontSize: '15px', marginBottom: '12px', color: '#1e3a8a' }}>
              ✅ 证据校验
            </h3>
            {evidenceSummary && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  ['📄 报名资料', evidenceSummary.materials_ok, `（${evidenceSummary.materials_count}份）`],
                  ['🏫 班级分配', evidenceSummary.class_ok, ''],
                  ['💰 缴费确认', evidenceSummary.payment_ok, ''],
                ].map(([label, ok, extra]) => (
                  <div
                    key={label as string}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px',
                      background: ok ? '#f0fdf4' : '#fef2f2',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  >
                    <span>
                      {label} {extra}
                    </span>
                    {ok ? (
                      <span style={{ color: '#166534' }}>✓ 通过</span>
                    ) : (
                      <span style={{ color: '#991b1b' }}>✗ 不通过</span>
                    )}
                  </div>
                ))}
                <div
                  style={{
                    marginTop: '8px',
                    padding: '12px',
                    borderRadius: '6px',
                    textAlign: 'center',
                    background: evidenceSummary.all_complete ? '#f0fdf4' : '#fef2f2',
                    fontWeight: 600,
                    color: evidenceSummary.all_complete ? '#166534' : '#991b1b',
                  }}
                >
                  {evidenceSummary.all_complete
                    ? '✓ 所有证据完备，可进入下一步'
                    : '✗ 存在缺失证据，无法进入下一步'}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: '15px', marginBottom: '12px', color: '#1e3a8a' }}>
              ⚙ 办理操作
            </h3>
            {!isCurrentHandler ? (
              <div
                style={{
                  padding: '12px',
                  background: '#fef3c7',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#92400e',
                }}
              >
                ⚠ 您不是当前处理人（当前：{application.current_handler_name}
                {roleLabels[application.current_handler_role] &&
                  ` / ${roleLabels[application.current_handler_role]}`}
                ），无法进行操作
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <textarea
                  placeholder="操作备注（可选，退回补正时建议填写原因）"
                  value={actionRemark}
                  onChange={(e) => setActionRemark(e.target.value)}
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                />
                {canAssign && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleAction('assign')}
                    disabled={actionLoading !== ''}
                  >
                    {actionLoading === 'assign' ? '处理中...' : '📤 分派至审核主管'}
                  </button>
                )}
                {canAuditPass && (
                  <button
                    className="btn btn-success"
                    onClick={() => handleAction('audit_pass')}
                    disabled={actionLoading !== ''}
                  >
                    {actionLoading === 'audit_pass' ? '处理中...' : '✅ 审核通过至复核'}
                  </button>
                )}
                {canAuditReject && (
                  <button
                    className="btn btn-warning"
                    onClick={() => handleAction('audit_reject')}
                    disabled={actionLoading !== ''}
                  >
                    {actionLoading === 'audit_reject' ? '处理中...' : '↩ 退回补正'}
                  </button>
                )}
                {canReviewArchive && (
                  <button
                    className="btn btn-success"
                    onClick={() => handleAction('review_archive')}
                    disabled={actionLoading !== ''}
                  >
                    {actionLoading === 'review_archive' ? '处理中...' : '📦 复核归档'}
                  </button>
                )}
                {canSupplement && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleAction('supplement')}
                    disabled={actionLoading !== ''}
                  >
                    {actionLoading === 'supplement' ? '处理中...' : '📝 补正材料标记'}
                  </button>
                )}
                {application.status === '已回访' && user.role !== 'reviewer' && (
                  <div
                    style={{
                      padding: '12px',
                      background: '#f9fafb',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: '#6b7280',
                    }}
                  >
                    该单据已进入复核归档阶段，等待复核负责人处理
                  </div>
                )}
                {!canAssign &&
                  !canAuditPass &&
                  !canAuditReject &&
                  !canReviewArchive &&
                  !canSupplement &&
                  application.status === '待分派' &&
                  user.role !== 'registrar' && (
                    <div
                      style={{
                        padding: '12px',
                        background: '#f9fafb',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#6b7280',
                      }}
                    >
                      当前阶段为登记员处理阶段
                    </div>
                  )}
                {!canAssign &&
                  !canAuditPass &&
                  !canAuditReject &&
                  !canReviewArchive &&
                  !canSupplement &&
                  application.status === '已转办' &&
                  user.role !== 'auditor' && (
                    <div
                      style={{
                        padding: '12px',
                        background: '#f9fafb',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#6b7280',
                      }}
                    >
                      当前阶段为审核主管处理阶段
                    </div>
                  )}
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: '15px', marginBottom: '12px', color: '#991b1b' }}>
              ⚠ 异常记录（{exceptions.length}条）
            </h3>
            {exceptions.length === 0 ? (
              <span style={{ color: '#166534', fontSize: '13px' }}>暂无异常 ✓</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {exceptions.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      padding: '10px',
                      background: e.resolved ? '#f0fdf4' : '#fef2f2',
                      borderRadius: '6px',
                      fontSize: '12px',
                      border: '1px solid ' + (e.resolved ? '#bbf7d0' : '#fecaca'),
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {e.resolved ? '✓' : '✗'} {excTypeLabels[e.type] || e.type}
                      </span>
                      <span style={{ color: '#6b7280' }}>
                        {new Date(e.triggered_at).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div style={{ color: '#374151', fontSize: '13px' }}>{e.reason}</div>
                    <div style={{ marginTop: '4px', color: '#6b7280' }}>
                      触发人：{e.triggered_by_name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
