import { useState, useEffect, useCallback } from 'react'
import type { User, EntryDetail as EntryDetailType, ExceptionLog } from '../types'
import { STATUS_LABELS, PRIORITY_LABELS, CATEGORY_LABELS, ROLE_LABELS, EXCEPTION_TYPE_LABELS, OVERDUE_GROUP_LABELS } from '../types'
import * as api from '../api'

interface EntryDetailProps {
  entryId: number
  user: User
  onBack: () => void
  onRefresh: () => void
}

type Tab = 'info' | 'audit' | 'exceptions'

export function EntryDetail({ entryId, user, onBack, onRefresh }: EntryDetailProps) {
  const [detail, setDetail] = useState<EntryDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('info')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [showProcessModal, setShowProcessModal] = useState(false)
  const [processAction, setProcessAction] = useState('')
  const [processResult, setProcessResult] = useState('')
  const [processReturnReason, setProcessReturnReason] = useState('')
  const [processLoading, setProcessLoading] = useState(false)

  const [showAttachModal, setShowAttachModal] = useState(false)
  const [attachForm, setAttachForm] = useState({ filename: '', file_type: 'application/pdf', file_size: 0, description: '' })
  const [attachLoading, setAttachLoading] = useState(false)

  const [noteContent, setNoteContent] = useState('')
  const [noteType, setNoteType] = useState('audit')
  const [noteLoading, setNoteLoading] = useState(false)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getEntry(entryId)
      setDetail(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [entryId])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const handleProcess = async () => {
    if (!detail || !processAction) return
    setProcessLoading(true)
    setError('')
    try {
      await api.processEntry(entryId, {
        action: processAction,
        result: processResult,
        return_reason: processReturnReason,
        version: detail.entry.version,
      })
      setSuccess(`操作成功：${processAction === 'approve' ? '审核通过' : processAction === 'confirm' ? '确认同步' : processAction === 'return' ? '已退回' : '已重新提交'}`)
      setShowProcessModal(false)
      setProcessAction('')
      setProcessResult('')
      setProcessReturnReason('')
      fetchDetail()
      onRefresh()
    } catch (err: any) {
      setError(err.message)
      fetchDetail()
    } finally {
      setProcessLoading(false)
    }
  }

  const handleAttach = async () => {
    if (!attachForm.filename) return
    setAttachLoading(true)
    try {
      await api.createAttachment(entryId, attachForm)
      setSuccess('附件上传成功')
      setShowAttachModal(false)
      setAttachForm({ filename: '', file_type: 'application/pdf', file_size: 0, description: '' })
      fetchDetail()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAttachLoading(false)
    }
  }

  const handleAddNote = async () => {
    if (!noteContent) return
    setNoteLoading(true)
    try {
      await api.createAuditNote(entryId, { note_type: noteType, content: noteContent })
      setNoteContent('')
      fetchDetail()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setNoteLoading(false)
    }
  }

  const handleResolveException = async (id: number) => {
    try {
      await api.resolveException(id)
      fetchDetail()
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return <div className="empty-state"><div className="icon">⏳</div><p>加载中...</p></div>
  }

  if (!detail) {
    return <div className="empty-state"><div className="icon">❌</div><p>分包进场单不存在</p></div>
  }

  const entry = detail.entry
  const attachments = detail.attachments || []
  const records = detail.records || []
  const notes = detail.notes || []
  const exceptions = detail.exceptions || []

  const canApprove = user.role === 'construction_manager' && entry.status === 'pending_review'
  const canConfirm = user.role === 'project_manager' && entry.status === 'approved'
  const canReturn = (user.role === 'construction_manager' && entry.status === 'pending_review') ||
                    (user.role === 'project_manager' && entry.status === 'approved')
  const canResubmit = entry.status === 'returned' && entry.current_handler_role === user.role
  const canUpload = (user.role === 'document_clerk') ||
                    (user.role === 'construction_manager' && entry.status === 'returned' && entry.current_handler_role === 'construction_manager')

  const formatTime = (t: string) => {
    try {
      return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch {
      return t
    }
  }

  return (
    <div className="detail-page">
      {error && <div className="error-msg">{error}<button style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setError('')}>✕</button></div>}
      {success && <div className="success-msg">{success}<button style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setSuccess('')}>✕</button></div>}

      <div className="detail-header">
        <div>
          <button className="btn btn-default btn-sm" onClick={onBack}>← 返回列表</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`status-tag status-${entry.status}`} style={{ fontSize: 13, padding: '4px 14px' }}>
            {STATUS_LABELS[entry.status]}
          </span>
          {entry.overdue_group !== 'normal' && (
            <span className={`overdue-tag ${entry.overdue_group}`} style={{ fontSize: 12, padding: '4px 10px' }}>
              {OVERDUE_GROUP_LABELS[entry.overdue_group]}
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>{entry.title}</h2>
        <div className="detail-grid">
          <div className="detail-field">
            <div className="label">分包单位</div>
            <div className="value">{entry.subcontractor_name}</div>
          </div>
          <div className="detail-field">
            <div className="label">类型</div>
            <div className="value">{CATEGORY_LABELS[entry.category]}</div>
          </div>
          <div className="detail-field">
            <div className="label">优先级</div>
            <div className="value">
              <span className={`priority-${entry.priority}`}><span className="priority-dot" />{PRIORITY_LABELS[entry.priority]}</span>
            </div>
          </div>
          <div className="detail-field">
            <div className="label">责任人</div>
            <div className="value">{entry.responsible_person}</div>
          </div>
          <div className="detail-field">
            <div className="label">当前处理人</div>
            <div className="value">{entry.current_handler || '-'} {entry.current_handler_role ? `(${ROLE_LABELS[entry.current_handler_role] || entry.current_handler_role})` : ''}</div>
          </div>
          <div className="detail-field">
            <div className="label">截止时间</div>
            <div className="value">{formatTime(entry.deadline)}</div>
          </div>
          <div className="detail-field">
            <div className="label">创建人</div>
            <div className="value">{entry.created_by_name}</div>
          </div>
          <div className="detail-field">
            <div className="label">版本</div>
            <div className="value">v{entry.version}</div>
          </div>
          {entry.exception_tags && (
            <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
              <div className="label">异常标签</div>
              <div className="value">
                {entry.exception_tags.split(',').filter(Boolean).map((tag, i) => (
                  <span key={i} className="exception-tag">{tag}</span>
                ))}
              </div>
            </div>
          )}
          {entry.status === 'returned' && records.length > 0 && records[0].return_reason && (
            <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
              <div className="label">退回原因</div>
              <div className="value" style={{ color: '#d48806' }}>{records[0].return_reason}</div>
            </div>
          )}
        </div>

        <div className="detail-actions">
          {canApprove && (
            <button className="btn btn-success" onClick={() => { setProcessAction('approve'); setShowProcessModal(true); }}>
              审核通过
            </button>
          )}
          {canConfirm && (
            <button className="btn btn-success" onClick={() => { setProcessAction('confirm'); setShowProcessModal(true); }}>
              确认同步
            </button>
          )}
          {canResubmit && (
            <button className="btn btn-primary" onClick={() => { setProcessAction('resubmit'); setShowProcessModal(true); }}>
              重新提交
            </button>
          )}
          {canReturn && (
            <button className="btn btn-danger" onClick={() => { setProcessAction('return'); setShowProcessModal(true); }}>
              退回
            </button>
          )}
          {canUpload && (
            <button className="btn btn-default" onClick={() => setShowAttachModal(true)}>
              上传附件
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'info' ? 'active' : ''} onClick={() => setTab('info')}>附件与记录</button>
        <button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>审计轨迹</button>
        <button className={tab === 'exceptions' ? 'active' : ''} onClick={() => setTab('exceptions')}>
          异常记录 {exceptions.filter(e => !e.resolved).length > 0 && `(${exceptions.filter(e => !e.resolved).length})`}
        </button>
      </div>

      {tab === 'info' && (
        <div>
          <div className="card">
            <div className="card-title">附件 ({attachments.length})</div>
            {attachments.length === 0 ? (
              <p style={{ fontSize: 13, color: '#8c8c8c' }}>暂无附件</p>
            ) : (
              attachments.map(att => (
                <div key={att.id} className="attachment-item">
                  <div className="file-info">
                    <span className="file-icon">📄</span>
                    <div>
                      <div className="file-name">{att.filename}</div>
                      <div className="file-size">{att.description} · {att.uploaded_by_name} · {formatTime(att.created_at)}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <div className="card-title">处理记录</div>
            {records.length === 0 ? (
              <p style={{ fontSize: 13, color: '#8c8c8c' }}>暂无处理记录</p>
            ) : (
              <div className="timeline">
                {records.map(rec => (
                  <div key={rec.id} className="timeline-item">
                    <div className="time">{formatTime(rec.created_at)}</div>
                    <div className="content">
                      <span className="actor">{rec.handler_name}</span>
                      <span style={{ color: '#8c8c8c' }}>({ROLE_LABELS[rec.handler_role] || rec.handler_role})</span>
                      {' '}{rec.result}
                      {rec.return_reason && <div style={{ color: '#d48806', marginTop: 4, fontSize: 12 }}>退回原因：{rec.return_reason}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="card">
          <div className="card-title">审计备注</div>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
            <select value={noteType} onChange={e => setNoteType(e.target.value)} style={{ padding: '7px 12px', border: '1px solid #d9d9d9', borderRadius: 8, fontSize: 13 }}>
              <option value="audit">审计备注</option>
              <option value="exception">异常备注</option>
              <option value="system">系统备注</option>
            </select>
            <input
              type="text"
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              placeholder="输入备注内容..."
              className="search-input"
              style={{ flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter' && noteContent) handleAddNote() }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleAddNote} disabled={!noteContent || noteLoading}>
              {noteLoading ? '...' : '添加'}
            </button>
          </div>
          {notes.length === 0 ? (
            <p style={{ fontSize: 13, color: '#8c8c8c' }}>暂无审计备注</p>
          ) : (
            notes.map(note => (
              <div key={note.id} className="note-item">
                <span className={`note-type note-type-${note.note_type}`}>
                  {note.note_type === 'audit' ? '审计' : note.note_type === 'exception' ? '异常' : '系统'}
                </span>
                <div className="note-content">{note.content}</div>
                <div className="note-meta">{note.created_by_name} · {formatTime(note.created_at)}</div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'exceptions' && (
        <div className="card">
          <div className="card-title">异常记录</div>
          {exceptions.length === 0 ? (
            <p style={{ fontSize: 13, color: '#8c8c8c' }}>暂无异常记录</p>
          ) : (
            exceptions.map(exc => (
              <div key={exc.id} className={`exception-item ${exc.resolved ? 'resolved' : ''}`}>
                <div>
                  <div className="exc-type">{EXCEPTION_TYPE_LABELS[exc.exception_type] || exc.exception_type}{exc.resolved ? ' (已解决)' : ''}</div>
                  <div className="exc-desc">{exc.description}</div>
                  <div className="exc-time">{formatTime(exc.detected_at)}</div>
                </div>
                {!exc.resolved && (
                  <button className="btn btn-sm btn-success" onClick={() => handleResolveException(exc.id)}>
                    标记解决
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {showProcessModal && (
        <div className="modal-overlay" onClick={() => setShowProcessModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>
              {processAction === 'approve' ? '审核通过' : processAction === 'confirm' ? '确认同步' : processAction === 'return' ? '退回分包进场单' : '重新提交'}
            </h3>
            {processAction === 'return' ? (
              <div className="form-group">
                <label>退回原因 *</label>
                <textarea
                  rows={3}
                  value={processReturnReason}
                  onChange={e => setProcessReturnReason(e.target.value)}
                  placeholder="请输入退回原因"
                />
              </div>
            ) : (
              <div className="form-group">
                <label>处理意见</label>
                <input
                  type="text"
                  value={processResult}
                  onChange={e => setProcessResult(e.target.value)}
                  placeholder={processAction === 'approve' ? '审核通过' : processAction === 'confirm' ? '已同步确认' : '重新提交审核'}
                />
              </div>
            )}
            <p style={{ fontSize: 12, color: '#8c8c8c', margin: '8px 0' }}>
              当前版本：v{entry.version}
            </p>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setShowProcessModal(false)}>取消</button>
              <button
                className="btn btn-primary"
                onClick={handleProcess}
                disabled={processLoading || (processAction === 'return' && !processReturnReason)}
              >
                {processLoading ? '处理中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAttachModal && (
        <div className="modal-overlay" onClick={() => setShowAttachModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>上传附件</h3>
            <div className="form-group">
              <label>文件名 *</label>
              <input
                type="text"
                value={attachForm.filename}
                onChange={e => setAttachForm(f => ({ ...f, filename: e.target.value }))}
                placeholder="如：资质证书.pdf"
              />
            </div>
            <div className="form-group">
              <label>文件类型</label>
              <select value={attachForm.file_type} onChange={e => setAttachForm(f => ({ ...f, file_type: e.target.value }))}>
                <option value="application/pdf">PDF</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/png">PNG</option>
                <option value="application/zip">ZIP</option>
              </select>
            </div>
            <div className="form-group">
              <label>描述</label>
              <input
                type="text"
                value={attachForm.description}
                onChange={e => setAttachForm(f => ({ ...f, description: e.target.value }))}
                placeholder="附件说明"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setShowAttachModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleAttach} disabled={!attachForm.filename || attachLoading}>
                {attachLoading ? '上传中...' : '上传'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
