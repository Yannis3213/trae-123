import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { StatusBadge, WarningBadge } from './Badges';
import { STATUS, STATUS_NAMES, ROLES, getCurrentUser } from '../constants';

export default function DetailModal({ id, onClose, onRefresh }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('basic');
  const [noteText, setNoteText] = useState('');
  const [actionData, setActionData] = useState({ remark: '', abnormalReason: '', relatedField: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('currentUser') || 'null') : null;

  useEffect(() => {
    if (id) loadDetail();
  }, [id]);

  const loadDetail = async () => {
    setLoading(true);
    const res = await api.sideRecords.detail(id);
    if (res.success) setRecord(res.data);
    setLoading(false);
  };

  const handleAction = async (action, endpointFn) => {
    setMessage('');
    setSubmitting(true);
    try {
      const payload = {
        ...actionData,
        version: record.version,
        problemNoticeStatus: record.problemNoticeStatus,
        rectificationReviewStatus: record.rectificationReviewStatus
      };
      const res = await endpointFn(id, payload);
      setMessage(res.message);
      if (res.success) {
        setRecord(res.data);
        setActionData({ remark: '', abnormalReason: '', relatedField: '' });
        onRefresh && onRefresh();
      }
    } catch (e) {
      setMessage('操作异常');
    } finally {
      setSubmitting(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    const res = await api.sideRecords.addNote(id, noteText);
    if (res.success) {
      setNoteText('');
      loadDetail();
    }
  };

  if (!id) return null;

  const renderActions = () => {
    if (!record || !user) return null;
    const actions = [];

    if (user.role === ROLES.REGISTRAR) {
      if ([STATUS.PENDING_REVIEW, STATUS.RETURNED, STATUS.MATERIAL_MISSING].includes(record.status)) {
        actions.push(
          <button key="submit" className="btn btn-primary" disabled={submitting}
            onClick={() => handleAction('submit', api.sideRecords.submit)}>
            提交/补正提交
          </button>
        );
      }
    }

    if (user.role === ROLES.SUPERVISOR) {
      if ([STATUS.PENDING_REVIEW, STATUS.MATERIAL_MISSING, STATUS.OVERDUE, STATUS.STATUS_CONFLICT].includes(record.status)) {
        actions.push(
          <button key="pass" className="btn btn-success" disabled={submitting}
            onClick={() => handleAction('pass', (i, d) => api.sideRecords.review(i, { ...d, action: 'pass' }))}>
            审核通过
          </button>,
          <button key="return" className="btn btn-warning" disabled={submitting}
            onClick={() => handleAction('return', (i, d) => api.sideRecords.review(i, { ...d, action: 'return' }))}>
            退回补正
          </button>,
          <button key="missing" className="btn btn-default" disabled={submitting}
            onClick={() => handleAction('missing', (i, d) => api.sideRecords.review(i, { ...d, action: 'missing' }))}>
            缺料退回
          </button>,
          <button key="overdue" className="btn btn-danger" disabled={submitting}
            onClick={() => handleAction('overdue', (i, d) => api.sideRecords.review(i, { ...d, action: 'overdue' }))}>
            标记逾期
          </button>
        );
      }
    }

    if (user.role === ROLES.REVIEWER) {
      if ([STATUS.REVIEW_PASSED, STATUS.OVERDUE].includes(record.status)) {
        actions.push(
          <button key="sync" className="btn btn-success" disabled={submitting}
            onClick={() => handleAction('sync', (i, d) => api.sideRecords.archive(i, { ...d, action: 'sync' }))}>
            同步归档
          </button>,
          <button key="return" className="btn btn-warning" disabled={submitting}
            onClick={() => handleAction('return', (i, d) => api.sideRecords.archive(i, { ...d, action: 'return' }))}>
            退回补正
          </button>
        );
      }
    }

    return actions;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 900 }}>
        <div className="modal-header">
          <div>
            <h3 className="text-base font-semibold">旁站记录单详情</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">{record?.recordNo}</span>
              {record && <StatusBadge status={record.status} />}
              {record && <WarningBadge group={record.warningGroup} />}
            </div>
          </div>
          <button className="text-gray-400 hover:text-gray-600 text-xl" onClick={onClose}>×</button>
        </div>

        <div className="border-b border-gray-200 px-5">
          <div className="flex gap-4 text-sm">
            {['basic', 'evidence', 'process', 'abnormal'].map(t => (
              <div
                key={t}
                onClick={() => setActiveTab(t)}
                className={`py-2.5 cursor-pointer border-b-2 ${
                  activeTab === t ? 'border-blue-500 text-blue-600 font-medium' : 'border-transparent text-gray-500'
                }`}
              >
                {t === 'basic' && '基础信息'}
                {t === 'evidence' && '证据材料'}
                {t === 'process' && '处理记录'}
                {t === 'abnormal' && '异常与备注'}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-body">
          {loading && <div className="text-center py-8 text-gray-400">加载中...</div>}

          {!loading && record && activeTab === 'basic' && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field label="项目名称" value={record.projectName} span />
              <Field label="项目编号" value={record.projectCode} />
              <Field label="旁站部位" value={record.location} />
              <Field label="旁站记录线索" value={record.sideRecordClue} />
              <Field label="工作内容" value={record.workContent} span />
              <Field label="天气" value={record.weather} />
              <Field label="记录日期" value={record.recordDate} />
              <Field label="截止日期" value={record.deadline} />
              <Field label="登记人" value={record.registrarName} />
              <Field label="当前处理人" value={record.currentHandlerName || '—'} />
              <Field label="审核人" value={record.reviewerName || '—'} />
              <Field label="归档人" value={record.finalArchiverName || '—'} />
              <Field label="问题通知状态" value={record.problemNoticeStatus || '—'} />
              <Field label="整改复核状态" value={record.rectificationReviewStatus || '—'} />
              <Field label="版本" value={`v${record.version}`} />
            </div>
          )}

          {!loading && record && activeTab === 'evidence' && (
            <div className="space-y-4">
              <EvidenceItem label="现场照片" value={record.sitePhoto} type="image" />
              <EvidenceItem label="检查记录" value={record.inspectionRecord} />
              <EvidenceItem label="签字确认" value={record.signatures} />
              {record.attachments && record.attachments.length > 0 && (
                <div>
                  <div className="form-label">附件列表</div>
                  <div className="space-y-1">
                    {record.attachments.map((a, i) => (
                      <div key={i} className="text-sm text-blue-600">📎 {a.fileName || a.name}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && record && activeTab === 'process' && (
            <div className="space-y-3">
              {record.processRecords && record.processRecords.length > 0 ? (
                record.processRecords.map(p => (
                  <div key={p.id} className="border-l-2 border-blue-300 pl-4 py-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{p.operatorName}</span>
                      <span className="text-xs text-gray-400">{p.processedAt}</span>
                      {p.fromStatus && <StatusBadge status={p.fromStatus} />}
                      {p.toStatus && <span className="text-gray-400">→</span>}
                      {p.toStatus && <StatusBadge status={p.toStatus} />}
                      {p.version && <span className="text-xs text-gray-400">v{p.version}</span>}
                    </div>
                    {p.remark && <div className="text-sm text-gray-600 mt-1">{p.remark}</div>}
                    {p.abnormalReason && (
                      <div className="text-xs text-red-600 mt-1 bg-red-50 p-1.5 rounded">
                        异常原因：{p.abnormalReason}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-state">暂无处理记录</div>
              )}
            </div>
          )}

          {!loading && record && activeTab === 'abnormal' && (
            <div className="space-y-4">
              {record.abnormalReasons && record.abnormalReasons.length > 0 && (
                <div>
                  <div className="section-title">异常原因记录</div>
                  <div className="space-y-2">
                    {record.abnormalReasons.map(a => (
                      <div key={a.id} className="border border-red-200 bg-red-50 p-3 rounded">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-red-700">
                            {a.reasonType === 'material_missing' && '缺料'}
                            {a.reasonType === 'return' && '退回'}
                            {a.reasonType === 'overdue' && '逾期'}
                            {a.reasonType === 'conflict' && '状态冲突'}
                            {a.reasonType === 'missing' && '缺料'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {a.reportedByName} · {a.createdAt}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 mt-1">{a.reasonDetail}</div>
                        {a.relatedField && (
                          <div className="text-xs text-gray-500 mt-1">关联字段：{a.relatedField}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="section-title">审计备注</div>
                {record.auditNotes && record.auditNotes.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {record.auditNotes.map(n => (
                      <div key={n.id} className="border border-gray-200 p-3 rounded">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{n.createdByName}</span>
                          <span>{n.createdAt}</span>
                        </div>
                        <div className="text-sm text-gray-700 mt-1">{n.content}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 mb-3">暂无备注</div>
                )}
                <div className="flex gap-2">
                  <textarea
                    className="form-textarea flex-1"
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="添加审计备注..."
                    rows={2}
                  />
                  <button className="btn btn-default self-end" onClick={addNote}>添加</button>
                </div>
              </div>
            </div>
          )}

          {message && (
            <div className={`mt-4 p-2.5 rounded text-sm ${
              message.includes('成功') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          {renderActions().length > 0 && (
            <>
              <div className="divider" />
              <div>
                <div className="section-title">办理操作</div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="form-label">异常原因（退回/缺料/逾期时填写）</label>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      value={actionData.abnormalReason}
                      onChange={e => setActionData({ ...actionData, abnormalReason: e.target.value })}
                      placeholder="请填写异常原因..."
                    />
                  </div>
                  <div>
                    <label className="form-label">办理备注</label>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      value={actionData.remark}
                      onChange={e => setActionData({ ...actionData, remark: e.target.value })}
                      placeholder="请填写办理备注..."
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {renderActions()}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-default" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, span }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm mt-0.5 text-gray-800">{value || '—'}</div>
    </div>
  );
}

function EvidenceItem({ label, value, type }) {
  return (
    <div>
      <div className="form-label">{label}</div>
      {!value && <div className="text-sm text-red-500 bg-red-50 p-2 rounded">⚠ 缺失</div>}
      {value && type === 'image' && (
        <img src={value} alt={label} className="max-w-md rounded border border-gray-200" />
      )}
      {value && type !== 'image' && (
        <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{value}</div>
      )}
    </div>
  );
}
