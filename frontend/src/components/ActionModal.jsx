import React, { useState, useMemo, useEffect } from 'react'
import { ACTION_LABEL, EVIDENCE_CATEGORIES, REQUIRED_EVIDENCE_BY_ACTION, EVIDENCE_CATEGORY_LABEL, STATUS_COLOR } from '../api.js'

export default function ActionModal({ type, action, order, ids, versions, orders, onClose, onConfirm }) {
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

  const getOrderEvidenceStatus = (o) => {
    const cats = new Set()
    ;(o.attachments || []).filter(a => a.is_evidence).forEach(a => cats.add(a.category))
    attachments.filter(a => a.is_evidence).forEach(a => cats.add(a.category))
    const missing = requiredCats.filter(c => !cats.has(c))
    return {
      ok: missing.length === 0,
      missing,
      missingLabels: missing.map(c => EVIDENCE_CATEGORY_LABEL[c] || c),
    }
  }

  const getSingleExistingCategories = () => {
    const cats = new Set()
    if (order?.attachments) {
      order.attachments.filter(a => a.is_evidence).forEach(a => cats.add(a.category))
    }
    attachments.filter(a => a.is_evidence).forEach(a => cats.add(a.category))
    return cats
  }

  const submit = () => {
    if (isReject && !reason.trim()) return alert('请填写退回/补正原因')
    if (needEvidence && type === 'single') {
      const existing = getSingleExistingCategories()
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

  const batchEvidenceStats = useMemo(() => {
    if (type !== 'batch' || !needEvidence || !orders) return null
    let okCount = 0
    let missCount = 0
    orders.forEach(o => {
      const s = getOrderEvidenceStatus(o)
      if (s.ok) okCount++
      else missCount++
    })
    return { okCount, missCount }
  }, [type, needEvidence, orders, attachments])

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" style={{ maxWidth: type === 'batch' && needEvidence ? 720 : 520 }} onClick={(e) => e.stopPropagation()}>
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

          {type === 'batch' && needEvidence && batchEvidenceStats && (
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              共 {ids.length} 条申请，
              <span style={{ color: '#389e0d', fontWeight: 600 }}> ✅ 证据齐全 {batchEvidenceStats.okCount} 条</span>，
              <span style={{ color: '#cf1322', fontWeight: 600 }}> ❌ 证据缺失 {batchEvidenceStats.missCount} 条</span>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                提交后证据齐全的将执行操作，缺失的将返回失败原因并写入审计记录
              </div>
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

          {needEvidence && type === 'single' && (() => {
            const existing = getSingleExistingCategories()
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

          {needEvidence && type === 'batch' && orders && (
            <div style={{ marginBottom: 16, maxHeight: 260, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
              <table className="data-table" style={{ margin: 0, border: 'none' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#fafafa' }}>
                  <tr>
                    <th style={{ width: 140 }}>申请单号</th>
                    <th style={{ width: 80 }}>状态</th>
                    <th>证据状态</th>
                    <th style={{ width: 100, textAlign: 'right' }}>操作结果</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const s = getOrderEvidenceStatus(o)
                    return (
                      <tr key={o.id}>
                        <td style={{ fontSize: 12, fontWeight: 600 }}>{o.order_no}</td>
                        <td>
                          <span className="tag" style={{
                            background: STATUS_COLOR[o.status] + '22',
                            color: STATUS_COLOR[o.status],
                          }}>{o.status}</span>
                        </td>
                        <td>
                          {requiredCats.map(cat => {
                            const exist = !s.missing.includes(cat)
                            return (
                              <span key={cat} title={EVIDENCE_CATEGORY_LABEL[cat]} style={{
                                display: 'inline-block',
                                width: 20, height: 20,
                                lineHeight: '20px',
                                textAlign: 'center',
                                borderRadius: 3,
                                marginRight: 4,
                                fontSize: 12,
                                background: exist ? '#f6ffed' : '#fff1f0',
                                color: exist ? '#389e0d' : '#cf1322',
                                border: `1px solid ${exist ? '#b7eb8f' : '#ffa39e'}`,
                              }}>
                                {exist ? '✓' : '✗'}
                              </span>
                            )
                          })}
                          <span style={{ fontSize: 12, marginLeft: 8, color: s.ok ? '#389e0d' : '#cf1322' }}>
                            {s.ok ? '证据齐全' : `缺 ${s.missingLabels.join('、')}`}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: s.ok ? '#389e0d' : '#cf1322' }}>
                          {s.ok ? '将执行' : '将失败'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

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
