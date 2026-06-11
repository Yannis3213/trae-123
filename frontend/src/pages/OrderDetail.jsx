import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  http, STATUS_COLOR, WARNING_COLOR, WARNING_LABEL,
  ACTION_LABEL, EVIDENCE_CATEGORIES, ROLE_LABEL, getCurrentRole,
} from '../api.js'
import { useApp } from '../App.jsx'
import ActionModal from '../components/ActionModal.jsx'

export default function OrderDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { role, refreshKey, triggerRefresh } = useApp()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [actionModal, setActionModal] = useState(null)
  const [fileName, setFileName] = useState('')
  const [fileCat, setFileCat] = useState(EVIDENCE_CATEGORIES[0].value)
  const [fileEvidence, setFileEvidence] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      setData(await http.get(`/patrol-orders/${id}`))
    } catch (e) {
      alert('加载失败：' + (e.Message || e.message))
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id, refreshKey])

  const addAttachment = async () => {
    if (!fileName) return alert('请输入文件名')
    try {
      await http.post('/attachments', {
        patrol_order_id: Number(id),
        file_name: fileName,
        file_type: fileName.endsWith('.pdf') ? 'application/pdf' : fileName.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream',
        file_size: 100000 + Math.floor(Math.random() * 500000),
        file_url: `https://placeholder.local/${encodeURIComponent(fileName)}`,
        category: fileCat,
        is_evidence: fileEvidence,
      })
      setFileName('')
      triggerRefresh()
      load()
      alert('上传成功')
    } catch (e) {
      alert('上传失败：' + (e.Message || e.message))
    }
  }

  const deleteAttachment = async (attId) => {
    if (!confirm('确认删除该附件？')) return
    try {
      await http.delete(`/attachments/${attId}`)
      triggerRefresh()
      load()
    } catch (e) {
      alert('删除失败：' + (e.Message || e.message))
    }
  }

  const confirmAction = async (payload) => {
    try {
      const result = await http.post(`/patrol-orders/${id}/action`, payload)
      alert('操作成功：' + ACTION_LABEL[payload.action] + ' → ' + result.next_status)
      setActionModal(null)
      triggerRefresh()
      load()
    } catch (e) {
      alert('操作失败：' + (e.Message || e.message || '') + (e.Detail ? '\n\n详情：' + e.Detail : ''))
    }
  }

  const statusTag = (s) => (
    <span className="tag" style={{ background: STATUS_COLOR[s] + '22', color: STATUS_COLOR[s], border: `1px solid ${STATUS_COLOR[s]}55`, padding: '4px 14px', fontSize: 14 }}>
      {s}
    </span>
  )

  const warningTag = (w) => (
    <span className="tag" style={{ background: WARNING_COLOR[w] + '22', color: WARNING_COLOR[w], border: `1px solid ${WARNING_COLOR[w]}55` }}>
      {WARNING_LABEL[w]}
    </span>
  )

  const canOperate = useMemo(() => {
    if (!data) return []
    const o = data.order
    const acts = []
    if (role === 'customer_manager') {
      if (o.status === '待补正') {
        acts.push({ key: 'supplement', label: '补正资料', btnClass: 'btn-warning' })
        acts.push({ key: 'resubmit', label: '重新提交', btnClass: 'btn-primary' })
      }
      if (o.status === '审核退回') {
        acts.push({ key: 'resubmit', label: '重新提交', btnClass: 'btn-primary' })
      }
    }
    if (role === 'underwriter' && o.status === '待审核') {
      acts.push({ key: 'approve', label: '审核通过', btnClass: 'btn-success' })
      acts.push({ key: 'reject', label: '退回补正', btnClass: 'btn-danger' })
    }
    if (role === 'business_owner') {
      if (o.status === '审核通过') acts.push({ key: 'sync', label: '同步出单', btnClass: 'btn-primary' })
      if (o.status === '已同步') acts.push({ key: 'archive', label: '归档', btnClass: 'btn-success' })
    }
    return acts
  }, [role, data])

  if (loading) return <div className="card"><div className="empty-state">加载中...</div></div>
  if (!data) return <div className="card"><div className="empty-state">数据加载失败</div></div>

  const o = data.order
  const attEvCount = (o.attachments || []).filter(a => a.is_evidence).length

  return (
    <div>
      <div className="page-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn" onClick={() => nav(-1)}>← 返回</button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>投保申请详情</span>
              <b style={{ color: '#1677ff', fontSize: 18 }}>{o.order_no}</b>
              {statusTag(o.status)}
              {warningTag(data.warning)}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, fontWeight: 400 }}>
              创建时间：{dayjs(o.created_at).format('YYYY-MM-DD HH:mm')} &nbsp;·&nbsp;
              版本：v{o.version} &nbsp;·&nbsp;
              剩余天数：{data.days_left != null ? (data.days_left >= 0 ? data.days_left + '天' : '已逾期' + Math.abs(data.days_left) + '天') : '-'}
            </div>
          </div>
        </div>
        <div>
          {canOperate.map(a => (
            <button key={a.key} className={'btn ' + a.btnClass} onClick={() => setActionModal({ type: 'single', action: a.key, order: o })}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {(o.reject_reason || o.supplement_reason || o.abnormal_reason) && (
        <div className="card">
          {o.abnormal_reason && (
            <div className="alert alert-error" style={{ marginBottom: 10 }}>
              ⚠️ 异常原因：{o.abnormal_reason}
            </div>
          )}
          {o.reject_reason && (
            <div className="alert alert-error" style={{ marginBottom: 10 }}>
              ❌ 审核退回原因：{o.reject_reason}
            </div>
          )}
          {o.supplement_reason && (
            <div className="alert alert-warning">
              📋 需补正：{o.supplement_reason}
            </div>
          )}
        </div>
      )}

      <div className="tabs">
        {[
          { key: 'info', label: '📋 基本信息' },
          { key: 'attach', label: `📎 附件证据 (${(o.attachments || []).length}份，${attEvCount}份证据)` },
          { key: 'history', label: `📜 办理历史 (${(o.histories || []).length}条)` },
          { key: 'audit', label: '📝 审计备注' },
        ].map(t => (
          <div key={t.key} className={'tab' + (tab === t.key ? ' active' : '')} onClick={() => setTab(t.key)}>
            {t.label}
          </div>
        ))}
      </div>

      {tab === 'info' && (
        <div className="card">
          <div className="card-title">👤 客户信息</div>
          <div className="detail-grid" style={{ marginBottom: 24 }}>
            <div className="detail-item"><span className="detail-label">客户姓名</span><span className="detail-value">{o.customer_name}</span></div>
            <div className="detail-item"><span className="detail-label">身份证号</span><span className="detail-value" style={{ fontFamily: 'monospace' }}>{o.id_number}</span></div>
            <div className="detail-item"><span className="detail-label">联系电话</span><span className="detail-value">{o.phone || '-'}</span></div>
            <div className="detail-item"><span className="detail-label">经办人</span><span className="detail-value">{o.creator_name} ({ROLE_LABEL.customer_manager})</span></div>
          </div>

          <div className="card-title">🛡️ 投保信息</div>
          <div className="detail-grid" style={{ marginBottom: 24 }}>
            <div className="detail-item"><span className="detail-label">险种</span><span className="detail-value">{o.insurance_type}</span></div>
            <div className="detail-item"><span className="detail-label">投保金额</span><span className="detail-value" style={{ color: '#cf1322' }}>¥{o.insurance_amount.toLocaleString()}</span></div>
            <div className="detail-item"><span className="detail-label">保费</span><span className="detail-value">¥{o.premium.toLocaleString()}</span></div>
            <div className="detail-item"><span className="detail-label">保险期间</span><span className="detail-value">{o.insurance_period || '-'}</span></div>
            <div className="detail-item"><span className="detail-label">起保日期</span><span className="detail-value">{o.start_date ? dayjs(o.start_date).format('YYYY-MM-DD') : '-'}</span></div>
            <div className="detail-item"><span className="detail-label">终保日期</span><span className="detail-value">{o.end_date ? dayjs(o.end_date).format('YYYY-MM-DD') : '-'}</span></div>
            <div className="detail-item"><span className="detail-label">办理截止</span><span className="detail-value" style={{ color: data.warning === 'overdue' ? '#cf1322' : data.warning === 'approaching' ? '#d48806' : '' }}>
              {o.deadline ? dayjs(o.deadline).format('YYYY-MM-DD') : '-'}
            </span></div>
          </div>

          <div className="card-title">📌 流程信息</div>
          <div className="detail-grid">
            <div className="detail-item"><span className="detail-label">当前状态</span><span className="detail-value">{statusTag(o.status)}</span></div>
            <div className="detail-item"><span className="detail-label">当前处理人</span><span className="detail-value">{o.current_handler || '-'}</span></div>
            <div className="detail-item"><span className="detail-label">证据上传</span><span className="detail-value">{o.evidence_uploaded ? <span className="tag tag-success">已上传</span> : <span className="tag tag-default">未上传</span>}</span></div>
            <div className="detail-item"><span className="detail-label">出单确认</span><span className="detail-value">{o.confirm_evidence ? <span className="tag tag-success">已核对</span> : <span className="tag tag-default">待核对</span>}</span></div>
            <div className="detail-item"><span className="detail-label">创建人</span><span className="detail-value">{o.creator_name}</span></div>
            <div className="detail-item"><span className="detail-label">数据版本</span><span className="detail-value">v{o.version}</span></div>
            {o.remark && <div className="detail-item" style={{ gridColumn: '1/-1' }}><span className="detail-label">备注</span><span className="detail-value">{o.remark}</span></div>}
          </div>
        </div>
      )}

      {tab === 'attach' && (
        <div className="card">
          <div className="card-title">
            <span>📎 附件与证据（蓝色底色=必需证据）</span>
          </div>
          <div className="filter-bar" style={{ marginBottom: 16 }}>
            <input className="input" placeholder="文件名" value={fileName}
              onChange={(e) => setFileName(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
            <select className="select" value={fileCat} onChange={(e) => setFileCat(e.target.value)}>
              {EVIDENCE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" className="checkbox" checked={fileEvidence} onChange={(e) => setFileEvidence(e.target.checked)} />
              作为证据
            </label>
            <button className="btn btn-primary" onClick={addAttachment}>+ 上传附件</button>
          </div>
          <div className="attachment-list">
            {(o.attachments || []).length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>暂无附件</div>}
            {(o.attachments || []).map(a => (
              <div key={a.id} className={'attachment-item' + (a.is_evidence ? ' evidence' : '')}>
                📄 {a.file_name}
                <span className="attachment-category">{EVIDENCE_CATEGORIES.find(c => c.value === a.category)?.label || a.category}</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{Math.round((a.file_size || 0) / 1024)}KB · {a.uploader_name}</span>
                <button className="attachment-delete" onClick={() => deleteAttachment(a.id)}>×</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 4, fontSize: 13, color: '#6b7280' }}>
            💡 证据检查：共 <b>{(o.attachments || []).length}</b> 份附件，其中 <b style={{ color: '#1677ff' }}>{attEvCount}</b> 份标注为必需证据
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          <div className="card-title">📜 办理历史（按时间顺序）</div>
          {(o.histories || []).length === 0 ? <div className="empty-state">暂无历史记录</div> : (
            <div>
              {(o.histories || []).map((h, i) => (
                <div key={h.id} className="history-item">
                  <div className="history-time">
                    {dayjs(h.created_at).format('MM-DD HH:mm')}
                  </div>
                  <div className="history-content">
                    <div className="history-action">
                      第{i + 1}步 · {ACTION_LABEL[h.action] || h.action}
                      <span className="operator">
                        · {h.operator_name}（{ROLE_LABEL[h.operator_role] || h.operator_role}）
                      </span>
                    </div>
                    <div style={{ color: '#374151', fontSize: 13 }}>
                      {h.previous_status && (
                        <>
                          <span className="tag" style={{ background: STATUS_COLOR[h.previous_status] + '22', color: STATUS_COLOR[h.previous_status] }}>
                            {h.previous_status}
                          </span>
                          <span className="arrow" style={{ margin: '0 8px', color: '#9ca3af' }}>➜</span>
                        </>
                      )}
                      <span className="tag" style={{ background: STATUS_COLOR[h.current_status] + '22', color: STATUS_COLOR[h.current_status] }}>
                        {h.current_status}
                      </span>
                      {h.remark && <span style={{ marginLeft: 12 }}>💬 {h.remark}</span>}
                    </div>
                    {h.abnormal_reason && (
                      <div style={{ marginTop: 6, padding: '6px 10px', background: '#fff7e6', color: '#d46b08', borderRadius: 3, fontSize: 12 }}>
                        ⚠️ {h.abnormal_reason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="card">
          <div className="card-title">📝 审计备注与异常记录</div>
          {(o.audit_notes || []).length === 0 ? <div className="empty-state">暂无审计备注</div> : (
            (o.audit_notes || []).map(n => (
              <div key={n.id} className={'audit-note ' + (n.note_type || '')}>
                <div className="audit-note-header">
                  <span>📌 {({ reject: '退回意见', supplement: '补正记录', abnormal: '异常记录', remark: '备注' })[n.note_type] || '备注'}</span>
                  <span>{n.operator_name} · {dayjs(n.created_at).format('YYYY-MM-DD HH:mm')}</span>
                </div>
                <div>{n.content}</div>
              </div>
            ))
          )}
        </div>
      )}

      {actionModal && (
        <ActionModal
          type={actionModal.type}
          action={actionModal.action}
          order={actionModal.order}
          onClose={() => setActionModal(null)}
          onConfirm={confirmAction}
        />
      )}
    </div>
  )
}
