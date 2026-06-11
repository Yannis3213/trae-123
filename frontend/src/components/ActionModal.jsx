import React, { useState, useMemo, useEffect } from 'react'
import { ACTION_LABEL, EVIDENCE_CATEGORIES, REQUIRED_EVIDENCE_BY_ACTION, EVIDENCE_CATEGORY_LABEL } from '../api.js'

export default function ActionModal({ type, action, order, ids, versions, onClose, onConfirm }) {
  const [remark, setRemark] = useState('')
  const [reason, setReason] = useState('')
  const [attachments, setAttachments] = useState([])
  const [fileName, setFileName] = useState('')
  const [fileCat, setFileCat] = useState(EVIDENCE_CATEGORIES[0].value)
  const [fileEvidence, setFileEvidence] = useState(true)

  const isSupplement = action === 'supplement' || action === 'resubmit'
  const isReject = action === 'reject'
  const requiredCats = REQUIRED_EVIDENCE_BY_ACTION[action] || []
  const needEvidence = requiredCats.length > 0

  useEffect(() => {
    setRemark('')
    setReason('')
    setAttachments([])
    setFileName('')
    setFileCat(EVIDENCE_CATEGORIES[0].value)
    setFileEvidence(true)
  }, [action, type, order, ids])

  const title = useMemo(() => {
    if (type === 'batch') return `批量${ACTION_LABEL[action] || action}（${ids.length} 条）`
    return `${ACTION_LABEL[action] || action} - ${order?.order_no || ''}`
  }, [type, action, order, ids])

  const handleAddAttachment = () => {
    if (!fileName) return
    setAttachments([...attachments, {
      file_name: fileName,
      file_type: fileName.endsWith('.pdf') ? 'application/pdf' : fileName.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream',
      file_size: 100000 + Math.floor(Math.random() * 500000),
      file_url: `https://placeholder.local/${encodeURIComponent(fileName)}`,
      category: fileCat,
      is_evidence: fileEvidence,
    }])
    setFileName('')
  }

  const getExistingCategories = () => {
    const cats = new Set()
    if (type === 'single' && order?.attachments) {
      order.attachments.filter(a => a.is_evidence).forEach(a => cats.add(a.category))
    }
    attachments.filter(a => a.is_evidence).forEach(a => cats.add(a.category))
    return cats
  }

  const submit = () => {
    if (isReject && !reason.trim()) return alert('请填写退回/补正原因')
    if (needEvidence) {
      const existing = getExistingCategories()
      const missing = requiredCats.filter(c => !existing.has(c))
      if (missing.length > 0) {
        const labels = missing.map(c => EVIDENCE_CATEGORY_LABEL[c] || c).join('、')
        return alert(`缺少必需证据：${labels}，请确认已上传后再处理`)
      }
    }
    const payload = {
      action,
      remark: remark || undefined,
      reason: reason || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      required_evidence: needEvidence ? requiredCats : undefined,
    }
    if (type === 'single') {
      payload.version = order.version
    } else {
      payload.ids = ids
      payload.versions = versions
    }
    onConfirm(payload)
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {type === 'single' && (
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              当前状态：<b>{order.status}</b> &nbsp;|&nbsp;
              当前处理人：<b>{order.current_handler || '-'}</b> &nbsp;|&nbsp;
              版本号：<b>v{order.version}</b>
            </div>
          )}

          {isReject && (
            <div className="form-item" style={{ marginBottom: 16 }}>
              <label className="required">{type === 'batch' ? '批量' : ''}退回/补正原因</label>
              <textarea className="textarea" rows="4" value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请详细说明需要补正的材料或退回原因..." />
            </div>
          )}

          {isSupplement && (
            <>
              <div style={{ marginBottom: 12, fontWeight: 600 }}>📎 新增补正资料（模拟上传）</div>
              <div className="filter-bar" style={{ marginBottom: 12 }}>
                <input className="input" placeholder="文件名，如：身份证扫描件.jpg" value={fileName}
                  onChange={(e) => setFileName(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
                <select className="select" value={fileCat} onChange={(e) => setFileCat(e.target.value)}>
                  {EVIDENCE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" className="checkbox" checked={fileEvidence} onChange={(e) => setFileEvidence(e.target.checked)} />
                  作为证据
                </label>
                <button className="btn btn-primary" onClick={handleAddAttachment}>+ 添加</button>
              </div>
              <div className="attachment-list" style={{ marginBottom: 16 }}>
                {attachments.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>暂未添加附件</div>}
                {attachments.map((a, i) => (
                  <div key={i} className={'attachment-item' + (a.is_evidence ? ' evidence' : '')}>
                    📄 {a.file_name}
                    <span className="attachment-category">{EVIDENCE_CATEGORIES.find(c => c.value === a.category)?.label || a.category}</span>
                    <button className="attachment-delete" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
              <div className="form-item" style={{ marginBottom: 12 }}>
                <label>补正说明（可选）</label>
                <textarea className="textarea" rows="3" value={reason}
                  onChange={(e) => setReason(e.target.value)} placeholder="说明补正内容..." />
              </div>
            </>
          )}

          {needEvidence && (() => {
            const existing = getExistingCategories()
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 10 }}>🔍 必需证据校验（按业务规则自动校验）</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {requiredCats.map(cat => {
                    const ok = existing.has(cat)
                    const label = EVIDENCE_CATEGORY_LABEL[cat] || cat
                    return (
                      <div key={cat} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px', borderRadius: 6,
                        background: ok ? '#f6ffed' : '#fff1f0',
                        border: `1px solid ${ok ? '#b7eb8f' : '#ffa39e'}`,
                        color: ok ? '#389e0d' : '#cf1322',
                        fontWeight: 600,
                      }}>
                        {ok ? '✅' : '❌'} {label}
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 10 }}>
                  校验逻辑：approve 需投保单+身份证明+收入证明；sync 需出单确认单
                </div>
              </div>
            )
          })()}

          <div className="form-item">
            <label>备注说明（可选）</label>
            <textarea className="textarea" rows="3" value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="记录操作备注，写入处理历史..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={submit}>确认提交</button>
        </div>
      </div>
    </div>
  )
}
