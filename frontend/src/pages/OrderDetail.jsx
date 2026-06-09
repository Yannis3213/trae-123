import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../api.js'
import { useAuth } from '../App.jsx'
import CorrectModal from '../components/CorrectModal.jsx'
import ReviewModal from '../components/ReviewModal.jsx'

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('optometry')
  const [showCorrect, setShowCorrect] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [reviewAction, setReviewAction] = useState('approve')

  const [uploadCategory, setUploadCategory] = useState('optometry')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploadRequired, setUploadRequired] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const loadDetail = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/orders/${id}`)
      setOrder(res.data)
    } catch (e) {
      alert('加载失败：' + (e.response?.data?.detail || e.message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
  }, [id])

  if (loading || !order) {
    return <div className="empty-state" style={{ fontSize: 16 }}>加载中...</div>
  }

  const canReview = user.role === 'ophthalmologist' &&
    order.status === 'pending_review' &&
    (!order.current_handler_name || order.current_handler_name === user.real_name)

  const canCorrect = user.role === 'optometrist' &&
    (order.status === 'returned_for_correction' || order.status === 'pending_review')

  const canSync = user.role === 'operations_manager' &&
    order.status === 'review_approved'

  const doUpload = async () => {
    if (!uploadFile) { alert('请选择文件'); return }
    const formData = new FormData()
    formData.append('file', uploadFile)
    formData.append('category', uploadCategory)
    formData.append('description', uploadDesc)
    formData.append('is_required', uploadRequired ? 'true' : 'false')
    setUploading(true)
    try {
      const res = await api.post(`/orders/${order.id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setOrder(res.data)
      setUploadFile(null)
      setUploadDesc('')
      setUploadRequired(false)
      const fileInput = document.getElementById('fileInput')
      if (fileInput) fileInput.value = ''
      const defectsCleared = !res.data.has_defect && order.has_defect
      const resolvedCount = res.data.exceptions.filter(e => e.resolved).length -
        order.exceptions.filter(e => e.resolved).length
      alert(
        `上传成功！\n` +
        `附件区：已更新为 ${res.data.attachments.length} 条\n` +
        `处理记录：已写入\n` +
        `审计备注：已写入\n` +
        (resolvedCount > 0 ? `异常原因：已自动解决 ${resolvedCount} 条\n` : '') +
        (defectsCleared ? '缺项标记：已清除 ✓' :
          (res.data.has_defect ? `缺项标记：仍存在（${res.data.defect_description}）` : '缺项标记：无'))
      )
    } catch (e) {
      alert('上传失败：' + (e.response?.data?.detail || e.message))
    } finally {
      setUploading(false)
    }
  }

  const urgencyMap = { normal: ['正常', 'normal'], warning: ['临期', 'warning'], overdue: ['逾期', 'overdue'] }
  const urgencyText = urgencyMap[order.urgency_status]?.[0] || order.urgency_status
  const urgencyClass = urgencyMap[order.urgency_status]?.[1] || 'normal'

  const renderStatus = (s) => ({
    pending_review: '待审核', review_approved: '审核通过',
    synced: '已同步', returned_for_correction: '退回补正'
  }[s] || s)

  return (
    <div>
      <div className="back-btn" onClick={() => navigate('/orders')}>← 返回订单列表</div>

      <div className="page-header">
        <h2>
          {order.order_no}
          <span className={`status-tag ${order.status}`} style={{ marginLeft: 12 }}>{renderStatus(order.status)}</span>
          <span className={`urgency-tag ${urgencyClass}`} style={{ marginLeft: 8 }}>{urgencyText}</span>
          {order.has_defect && <span className="defect-badge">材料不齐</span>}
        </h2>
        <div className="order-meta">
          <span>客户：<strong style={{ color: '#262626' }}>{order.customer_name}</strong> ({order.customer_phone})</span>
          <span>业务区：{order.business_area}</span>
          <span>版本：v{order.version}</span>
          <span>提交人：{order.submitted_by_name || '-'}</span>
          <span>当前处理人：{order.current_handler_name || '-'}</span>
          {order.reviewed_by_name && <span>审核人：{order.reviewed_by_name}</span>}
          {order.synced_by_name && <span>同步人：{order.synced_by_name}</span>}
        </div>
      </div>

      {order.last_opinion && (
        <div className="opinion-box">
          <div className="label">上一处理人意见（{order.last_operator_name}）</div>
          <div className="content">
            <span className="operator">{order.last_operator_name}：</span>
            {order.last_opinion}
          </div>
        </div>
      )}

      {order.has_defect && order.defect_description && (
        <div className="alert-box warning">⚠️ 缺项提醒：{order.defect_description}</div>
      )}

      <div className="action-bar">
        <div className="left">
          <strong>当前可执行操作：</strong>
          {!canReview && !canCorrect && !canSync && <span style={{ color: '#8c8c8c' }}>无（角色或状态不匹配）</span>}
        </div>
        <div className="right">
          {canReview && (
            <>
              <button className="btn btn-success" onClick={() => { setReviewAction('approve'); setShowReview(true) }}>
                ✓ 审核通过
              </button>
              <button className="btn btn-warning" onClick={() => { setReviewAction('return'); setShowReview(true) }}>
                ↺ 退回补正
              </button>
            </>
          )}
          {canCorrect && (
            <button className="btn btn-primary" onClick={() => setShowCorrect(true)}>
              ✎ 补正资料并提交
            </button>
          )}
          {canSync && (
            <button className="btn btn-primary" onClick={() => { setReviewAction('sync'); setShowReview(true) }}>
              ⇌ 同步订单
            </button>
          )}
        </div>
      </div>

      <div className="detail-page">
        <div>
          <div className="detail-card mb-16">
            <div className="card-header"><h3>业务模块</h3></div>
            <div className="card-body">
              <div className="business-tabs">
                <div className={`tab ${activeTab === 'optometry' ? 'active' : ''}`}
                  onClick={() => setActiveTab('optometry')}>🔬 验光档案</div>
                <div className={`tab ${activeTab === 'lens' ? 'active' : ''}`}
                  onClick={() => setActiveTab('lens')}>🔍 镜片订购</div>
                <div className={`tab ${activeTab === 'registration' ? 'active' : ''}`}
                  onClick={() => setActiveTab('registration')}>📋 配镜订单登记</div>
              </div>

              {activeTab === 'optometry' && (
                <div>
                  {order.optometry_record ? (
                    <div>
                      <div className="alert-box" style={
                        order.optometry_record.is_complete
                          ? { background: '#f6ffed', borderColor: '#b7eb8f', color: '#389e0d' }
                          : { background: '#fff1f0', borderColor: '#ffa39e', color: '#cf1322' }
                      }>
                        {order.optometry_record.is_complete ? '✅ 验光档案信息完整' : '❌ 验光档案信息不完整，请补正'}
                      </div>
                      <div className="info-grid">
                        <div className="info-item"><span className="label">左眼 球镜</span><span className="value">{order.optometry_record.left_sphere ?? '-'} D</span></div>
                        <div className="info-item"><span className="label">右眼 球镜</span><span className="value">{order.optometry_record.right_sphere ?? '-'} D</span></div>
                        <div className="info-item"><span className="label">左眼 柱镜</span><span className="value">{order.optometry_record.left_cylinder ?? '-'} D</span></div>
                        <div className="info-item"><span className="label">右眼 柱镜</span><span className="value">{order.optometry_record.right_cylinder ?? '-'} D</span></div>
                        <div className="info-item"><span className="label">左眼 轴位</span><span className="value">{order.optometry_record.left_axis ?? '-'}°</span></div>
                        <div className="info-item"><span className="label">右眼 轴位</span><span className="value">{order.optometry_record.right_axis ?? '-'}°</span></div>
                        <div className="info-item"><span className="label">左眼 矫正视力</span><span className="value">{order.optometry_record.left_visual_acuity || '-'}</span></div>
                        <div className="info-item"><span className="label">右眼 矫正视力</span><span className="value">{order.optometry_record.right_visual_acuity || '-'}</span></div>
                        <div className="info-item"><span className="label">瞳距 PD</span><span className="value">{order.optometry_record.pd ?? '-'} mm</span></div>
                        <div className="info-item full-width"><span className="label">验光备注</span><span className="value">{order.optometry_record.exam_notes || '-'}</span></div>
                      </div>
                    </div>
                  ) : (
                    <div className="alert-box error">⚠️ 尚未填写验光档案，可从「补正资料」补填</div>
                  )}
                </div>
              )}

              {activeTab === 'lens' && (
                <div>
                  {order.lens_order ? (
                    <div>
                      <div className="alert-box" style={
                        order.lens_order.is_complete
                          ? { background: '#f6ffed', borderColor: '#b7eb8f', color: '#389e0d' }
                          : { background: '#fff1f0', borderColor: '#ffa39e', color: '#cf1322' }
                      }>
                        {order.lens_order.is_complete ? '✅ 镜片订购信息完整' : '❌ 镜片订购信息不完整，请补正'}
                      </div>
                      <div className="info-grid">
                        <div className="info-item"><span className="label">左眼镜片类型</span><span className="value">{order.lens_order.left_lens_type || '-'}</span></div>
                        <div className="info-item"><span className="label">右眼镜片类型</span><span className="value">{order.lens_order.right_lens_type || '-'}</span></div>
                        <div className="info-item"><span className="label">左眼镜片品牌</span><span className="value">{order.lens_order.left_lens_brand || '-'}</span></div>
                        <div className="info-item"><span className="label">右眼镜片品牌</span><span className="value">{order.lens_order.right_lens_brand || '-'}</span></div>
                        <div className="info-item"><span className="label">左眼镜片价格</span><span className="value">¥ {order.lens_order.left_lens_price ?? '-'}</span></div>
                        <div className="info-item"><span className="label">右眼镜片价格</span><span className="value">¥ {order.lens_order.right_lens_price ?? '-'}</span></div>
                        <div className="info-item"><span className="label">镜架品牌</span><span className="value">{order.lens_order.frame_brand || '-'}</span></div>
                        <div className="info-item"><span className="label">镜架型号</span><span className="value">{order.lens_order.frame_model || '-'}</span></div>
                        <div className="info-item"><span className="label">镜架价格</span><span className="value">¥ {order.lens_order.frame_price ?? '-'}</span></div>
                        <div className="info-item"><span className="label">供应商</span><span className="value">{order.lens_order.supplier || '-'}</span></div>
                        <div className="info-item full-width"><span className="label">订单总价</span><span className="value" style={{ fontWeight: 600, color: '#cf1322' }}>¥ {order.lens_order.total_price ?? '-'}</span></div>
                      </div>
                    </div>
                  ) : (
                    <div className="alert-box error">⚠️ 尚未填写镜片订购，可从「补正资料」补填</div>
                  )}
                </div>
              )}

              {activeTab === 'registration' && (
                <div>
                  {order.registration ? (
                    <div>
                      <div className="info-grid">
                        <div className="info-item"><span className="label">业务人员</span><span className="value">{order.registration.sales_person || '-'}</span></div>
                        <div className="info-item"><span className="label">登记时间</span><span className="value">{order.registration.registered_at ? dayjs(order.registration.registered_at).format('YYYY-MM-DD HH:mm') : '-'}</span></div>
                        <div className="info-item"><span className="label">收款方式</span><span className="value">{order.registration.payment_method || '-'}</span></div>
                        <div className="info-item"><span className="label">订金金额</span><span className="value">¥ {order.registration.deposit_amount ?? '-'}</span></div>
                        <div className="info-item"><span className="label">交付方式</span><span className="value">{order.registration.delivery_method || '-'}</span></div>
                        <div className="info-item"><span className="label">预计交货日期</span><span className="value">{order.registration.expected_delivery || '-'}</span></div>
                        <div className="info-item full-width"><span className="label">登记备注</span><span className="value">{order.registration.notes || '-'}</span></div>
                      </div>
                    </div>
                  ) : (
                    <div className="alert-box warning">⚠️ 尚未填写订单登记，可从「补正资料」补填</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="detail-card mb-16">
            <div className="card-header"><h3>📎 附件材料（{order.attachments.length}）</h3></div>
            <div className="card-body">
              {canCorrect && (
                <div className="form-section" style={{ marginBottom: 16 }}>
                  <h4>上传附件（补正材料）</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>附件类别</label>
                      <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                        <option value="optometry">验光档案</option>
                        <option value="lens">镜片订购</option>
                        <option value="registration">订单登记</option>
                        <option value="other">其他</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>描述</label>
                      <input value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} placeholder="可选" />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ whiteSpace: 'nowrap', marginRight: 8, marginBottom: 0 }}>
                        <input type="checkbox" checked={uploadRequired} onChange={(e) => setUploadRequired(e.target.checked)}
                          style={{ marginRight: 4 }} />
                        设为必填证据
                      </label>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>选择文件</label>
                    <div className="upload-area" onClick={() => document.getElementById('fileInput').click()}>
                      {uploadFile ? uploadFile.name : '点击选择文件上传'}
                      <input id="fileInput" type="file" style={{ display: 'none' }}
                        onChange={(e) => setUploadFile(e.target.files[0])} />
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={doUpload} disabled={uploading}>
                    {uploading ? '上传中...' : '确认上传'}
                  </button>
                </div>
              )}
              {order.attachments.length === 0 ? (
                <div className="empty-state" style={{ padding: 30 }}>暂无附件</div>
              ) : (
                <div className="attachment-list">
                  {order.attachments.map(a => (
                    <div key={a.id} className="attachment-item">
                      <div className="file-info">
                        <span className="file-icon">📄</span>
                        <span><strong>{a.file_name}</strong></span>
                        <span className="category-tag">{a.category_display}</span>
                        {a.is_required && <span className="required-tag">必填</span>}
                        {a.description && <span style={{ color: '#8c8c8c', fontSize: 12 }}>- {a.description}</span>}
                      </div>
                      <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                        {a.uploaded_by} · {dayjs(a.created_at).format('MM-DD HH:mm')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="detail-card mb-16">
            <div className="card-header"><h3>📋 处理记录（{order.processing_records.length}）</h3></div>
            <div className="card-body">
              {order.processing_records.length === 0 ? (
                <div className="empty-state" style={{ padding: 30 }}>暂无处理记录</div>
              ) : (
                <ul className="timeline">
                  {order.processing_records.map(r => (
                    <li key={r.id} className={`timeline-item ${r.action}`}>
                      <div className="timeline-dot"></div>
                      <div className="timeline-content">
                        <div className="title">
                          <strong>{r.action_display}</strong>
                          {r.from_status && r.to_status && (
                            <span style={{ color: '#8c8c8c', fontWeight: 400, fontSize: 12 }}>
                              （{renderStatus(r.from_status)} → {renderStatus(r.to_status)}）
                            </span>
                          )}
                          <span style={{ color: '#8c8c8c', fontWeight: 400, fontSize: 12, marginLeft: 8 }}>v{r.version}</span>
                        </div>
                        <div className="meta">{r.operator} · {dayjs(r.created_at).format('YYYY-MM-DD HH:mm:ss')}</div>
                        {r.opinion && <div className="opinion">{r.opinion}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="detail-card mb-16">
            <div className="card-header"><h3>⏰ 到期预警</h3></div>
            <div className="card-body">
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">提交时间</span>
                  <span className="value">{order.submitted_at ? dayjs(order.submitted_at).format('YYYY-MM-DD HH:mm') : '-'}</span>
                </div>
                <div className="info-item">
                  <span className="label">审核截止</span>
                  <span className="value" style={{
                    color: order.urgency_status === 'overdue' && order.status === 'pending_review' ? '#ff4d4f'
                      : order.urgency_status === 'warning' && order.status === 'pending_review' ? '#faad14' : '#262626'
                  }}>
                    {order.review_due_at ? dayjs(order.review_due_at).format('YYYY-MM-DD HH:mm') : '-'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">审核时间</span>
                  <span className="value">{order.reviewed_at ? dayjs(order.reviewed_at).format('YYYY-MM-DD HH:mm') : '-'}</span>
                </div>
                <div className="info-item">
                  <span className="label">同步截止</span>
                  <span className="value" style={{
                    color: order.urgency_status === 'overdue' && order.status === 'review_approved' ? '#ff4d4f'
                      : order.urgency_status === 'warning' && order.status === 'review_approved' ? '#faad14' : '#262626'
                  }}>
                    {order.sync_due_at ? dayjs(order.sync_due_at).format('YYYY-MM-DD HH:mm') : '-'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">同步时间</span>
                  <span className="value">{order.synced_at ? dayjs(order.synced_at).format('YYYY-MM-DD HH:mm') : '-'}</span>
                </div>
                <div className="info-item">
                  <span className="label">预警状态</span>
                  <span className="value"><span className={`urgency-tag ${urgencyClass}`}>{urgencyText}</span></span>
                </div>
              </div>
              {order.urgency_status === 'overdue' && (
                <div className="alert-box error mt-16">
                  ⚠️ 该订单已逾期，责任人为：<strong>{order.current_handler_name || '未分配'}</strong>
                </div>
              )}
            </div>
          </div>

          <div className="detail-card mb-16">
            <div className="card-header"><h3>❌ 异常原因（{order.exceptions.length}）</h3></div>
            <div className="card-body">
              {order.exceptions.length === 0 ? (
                <div className="empty-state" style={{ padding: 20, fontSize: 12 }}>暂无异常记录</div>
              ) : (
                order.exceptions.map(ex => (
                  <div key={ex.id} className={`exception-item ${ex.resolved ? 'resolved' : ''}`}>
                    <div className="type">{ex.resolved ? '✅ 已解决' : '⚠️ '}{ex.exception_type_display}</div>
                    <div>{ex.description}</div>
                    <div className="meta">
                      检测人：{ex.detected_by} · {dayjs(ex.created_at).format('MM-DD HH:mm')}
                      {ex.resolved && ` · 解决人：${ex.resolved_by} · ${ex.resolution_note}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="detail-card">
            <div className="card-header"><h3>🔍 审计备注（{order.audit_notes.length}）</h3></div>
            <div className="card-body">
              {order.audit_notes.length === 0 ? (
                <div className="empty-state" style={{ padding: 20, fontSize: 12 }}>暂无审计记录</div>
              ) : (
                order.audit_notes.map(n => (
                  <div key={n.id} className={`audit-note ${n.note_type === 'error' ? 'error' : ''}`}>
                    <div className="meta">{n.operator} · {dayjs(n.created_at).format('YYYY-MM-DD HH:mm:ss')}</div>
                    <div>{n.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showCorrect && (
        <CorrectModal
          order={order}
          onClose={() => setShowCorrect(false)}
          onSuccess={() => { setShowCorrect(false); loadDetail() }}
        />
      )}

      {showReview && (
        <ReviewModal
          order={order}
          action={reviewAction}
          onClose={() => setShowReview(false)}
          onSuccess={() => { setShowReview(false); loadDetail() }}
        />
      )}
    </div>
  )
}
