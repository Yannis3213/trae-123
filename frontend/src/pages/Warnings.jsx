import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { http, STATUS_COLOR, WARNING_COLOR, WARNING_LABEL, ACTION_LABEL, ROLE_LABEL } from '../api.js'
import { useApp } from '../App.jsx'
import ActionModal from '../components/ActionModal.jsx'
import BatchResultModal from '../components/BatchResultModal.jsx'

export default function Warnings() {
  const nav = useNavigate()
  const { role, refreshKey, triggerRefresh } = useApp()

  const [data, setData] = useState({ overdue: [], approaching: [], normal: [] })
  const [loading, setLoading] = useState(true)
  const [roleOnly, setRoleOnly] = useState(false)
  const [selected, setSelected] = useState({})
  const [section, setSection] = useState('overdue')
  const [actionModal, setActionModal] = useState(null)
  const [batchModal, setBatchModal] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const d = await http.get('/warnings', { params: { role_only: roleOnly ? '1' : '0' } })
      setData(d)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [roleOnly, refreshKey])

  const allList = [
    { key: 'overdue', list: data.overdue, title: '🔴 已逾期（需立即处理）', icon: 'overdue', count: data.overdue.length },
    { key: 'approaching', list: data.approaching, title: '🟡 临期（3天内到期）', icon: 'approaching', count: data.approaching.length },
    { key: 'normal', list: data.normal, title: '🟢 正常（充足时间）', icon: 'normal', count: data.normal.length },
  ]

  const totalCount = data.overdue.length + data.approaching.length + data.normal.length

  const statusTag = (s) => (
    <span className="tag" style={{ background: STATUS_COLOR[s] + '22', color: STATUS_COLOR[s], border: `1px solid ${STATUS_COLOR[s]}55` }}>
      {s}
    </span>
  )

  const selectedCount = Object.keys(selected).filter(k => selected[k]).length

  const availableActions = useMemo(() => {
    const acts = []
    if (role === 'customer_manager') {
      acts.push({ key: 'resubmit', label: '重新提交', btnClass: 'btn-primary' })
      acts.push({ key: 'supplement', label: '补正资料', btnClass: 'btn-warning' })
    }
    if (role === 'underwriter') {
      acts.push({ key: 'approve', label: '审核通过', btnClass: 'btn-success' })
      acts.push({ key: 'reject', label: '退回补正', btnClass: 'btn-danger' })
    }
    if (role === 'business_owner') {
      acts.push({ key: 'sync', label: '同步出单', btnClass: 'btn-primary' })
      acts.push({ key: 'archive', label: '归档', btnClass: 'btn-success' })
    }
    return acts
  }, [role])

  const handleBatch = (action) => {
    if (selectedCount === 0) return alert('请先勾选记录')
    const selIds = Object.keys(selected).filter(k => selected[k]).map(Number)
    const allOrders = [...data.overdue, ...data.approaching, ...data.normal]
    const versions = allOrders.reduce((m, o) => { if (selected[o.id]) m[o.id] = o.version; return m }, {})
    setActionModal({ type: 'batch', action, ids: selIds, versions })
  }

  const confirmAction = async (payload) => {
    try {
      if (actionModal.type === 'single') {
        const result = await http.post(`/patrol-orders/${actionModal.order.id}/action`, payload)
        alert('操作成功：' + ACTION_LABEL[payload.action] + ' → ' + result.next_status)
      } else {
        const resp = await http.post('/patrol-orders/batch-action', payload)
        setBatchModal(resp)
      }
      setActionModal(null)
      setSelected({})
      triggerRefresh()
      load()
    } catch (e) {
      alert('操作失败：' + (e.Message || e.message || '') + (e.Detail ? '\n\n详情：' + e.Detail : ''))
    }
  }

  const toggleAll = (list) => {
    const next = { ...selected }
    const allChecked = list.length > 0 && list.every(o => next[o.id])
    if (allChecked) list.forEach(o => delete next[o.id])
    else list.forEach(o => next[o.id] = true)
    setSelected(next)
  }

  const canOperate = (o) => {
    if (role === 'customer_manager') return ['待补正', '审核退回'].includes(o.status)
    if (role === 'underwriter') return o.status === '待审核'
    if (role === 'business_owner') return ['审核通过', '已同步'].includes(o.status)
    return false
  }

  return (
    <div>
      <div className="page-title">
        <div>
          <div style={{ fontSize: 20 }}>⏰ 月底到期预警</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, fontWeight: 400 }}>
            按时间紧迫度分为三队 · 共 <b style={{ color: '#1677ff' }}>{totalCount}</b> 条待办
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" className="checkbox" checked={roleOnly} onChange={(e) => setRoleOnly(e.target.checked)} />
            只看我相关的（{ROLE_LABEL[role]}）
          </label>
          <button className="btn" onClick={load}>🔄 刷新</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card overdue" style={{ cursor: 'pointer', border: section === 'overdue' ? '2px solid #ff4d4f' : '' }}
          onClick={() => setSection('overdue')}>
          <div className="stat-label">🔴 已逾期</div>
          <div className="stat-value">{data.overdue.length}</div>
        </div>
        <div className="stat-card approaching" style={{ cursor: 'pointer', border: section === 'approaching' ? '2px solid #faad14' : '' }}
          onClick={() => setSection('approaching')}>
          <div className="stat-label">🟡 临期（3天内）</div>
          <div className="stat-value">{data.approaching.length}</div>
        </div>
        <div className="stat-card normal" style={{ cursor: 'pointer', border: section === 'normal' ? '2px solid #52c41a' : '' }}
          onClick={() => setSection('normal')}>
          <div className="stat-label">🟢 正常</div>
          <div className="stat-value">{data.normal.length}</div>
        </div>
        <div className="stat-card info">
          <div className="stat-label">👤 已选中</div>
          <div className="stat-value">{selectedCount}</div>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="action-bar">
          <span className="selected-count">已选 <b style={{ color: '#1677ff' }}>{selectedCount}</b> 条（逾期批量推进将逐条校验）</span>
          {availableActions.map(a => (
            <button key={a.key} className={'btn ' + a.btnClass} onClick={() => handleBatch(a.key)}>
              批量{a.label}
            </button>
          ))}
          <button className="btn" onClick={() => setSelected({})}>取消选择</button>
        </div>
      )}

      {loading ? <div className="card"><div className="empty-state">加载中...</div></div> : (
        <div>
          {allList.map(sec => (
            (section === 'all' || section === sec.key) && (
              <div key={sec.key} className="card warning-section">
                <div className="card-title">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className={'warning-section-title ' + sec.icon} style={{ marginBottom: 0, padding: '4px 12px' }}>
                      {sec.title}
                      <span className="warning-count" style={{ marginLeft: 10, background: '#fff', color: WARNING_COLOR[sec.key] }}>
                        {sec.count}
                      </span>
                    </div>
                  </div>
                  {sec.list.length > 0 && (
                    <button className="btn btn-sm" onClick={() => toggleAll(sec.list)}>
                      {sec.list.every(o => selected[o.id]) ? '取消全选' : '全选本队'}
                    </button>
                  )}
                </div>
                {sec.list.length === 0 ? (
                  <div className="empty-state" style={{ padding: 30 }}>🎉 本队暂无任务</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>
                          <input type="checkbox" className="checkbox"
                            checked={sec.list.length > 0 && sec.list.every(o => selected[o.id])}
                            onChange={() => toggleAll(sec.list)} />
                        </th>
                        <th>申请单号</th>
                        <th>客户</th>
                        <th>险种</th>
                        <th>金额</th>
                        <th>状态</th>
                        <th>截止日期</th>
                        <th>超期/剩余</th>
                        <th>责任人</th>
                        <th>超时责任人</th>
                        <th>异常原因</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sec.list.map(o => {
                        const dl = o.deadline ? dayjs(o.deadline) : null
                        const days = dl ? dl.diff(dayjs(), 'day') : null
                        const responsible = (
                          o.status === '待审核' ? o.current_handler :
                          o.status === '待补正' ? o.creator_name :
                          o.status === '审核通过' ? o.current_handler :
                          o.creator_name
                        )
                        return (
                          <tr key={o.id} style={sec.key === 'overdue' ? { background: '#fff7f7' } : sec.key === 'approaching' ? { background: '#fffdf5' } : {}}>
                            <td>
                              <input type="checkbox" className="checkbox" checked={!!selected[o.id]}
                                onChange={(e) => setSelected({ ...selected, [o.id]: e.target.checked })} />
                            </td>
                            <td style={{ fontWeight: 600, color: '#1677ff', cursor: 'pointer' }} onClick={() => nav(`/orders/${o.id}`)}>{o.order_no}</td>
                            <td>{o.customer_name}</td>
                            <td>{o.insurance_type}</td>
                            <td>¥{o.insurance_amount.toLocaleString()}</td>
                            <td>{statusTag(o.status)}</td>
                            <td style={{ fontSize: 12 }}>{dl ? dl.format('YYYY-MM-DD') : '-'}</td>
                            <td style={{ color: WARNING_COLOR[sec.key], fontWeight: 600 }}>
                              {days != null ? (days < 0 ? `逾期 ${Math.abs(days)} 天` : `剩 ${days} 天`) : '-'}
                            </td>
                            <td style={{ fontSize: 12 }}>{o.current_handler || o.creator_name}</td>
                            <td style={{ fontSize: 12, color: sec.key === 'overdue' ? '#cf1322' : '#6b7280', fontWeight: sec.key === 'overdue' ? 600 : 400 }}>
                              {sec.key === 'overdue' ? responsible : '-'}
                            </td>
                            <td style={{ fontSize: 12, color: '#cf1322', maxWidth: 200 }}>{o.abnormal_reason || o.supplement_reason || '-'}</td>
                            <td>
                              <button className="btn btn-sm" onClick={() => nav(`/orders/${o.id}`)}>详情</button>
                              {canOperate(o) && (
                                role === 'underwriter' ? (
                                  <>
                                    <button className="btn btn-sm btn-success" onClick={() => setActionModal({ type: 'single', action: 'approve', order: o })}>通过</button>
                                    <button className="btn btn-sm btn-danger" onClick={() => setActionModal({ type: 'single', action: 'reject', order: o })}>退回</button>
                                  </>
                                ) : role === 'business_owner' ? (
                                  o.status === '审核通过' ? (
                                    <button className="btn btn-sm btn-primary" onClick={() => setActionModal({ type: 'single', action: 'sync', order: o })}>同步</button>
                                  ) : o.status === '已同步' ? (
                                    <button className="btn btn-sm btn-success" onClick={() => setActionModal({ type: 'single', action: 'archive', order: o })}>归档</button>
                                  ) : null
                                ) : (
                                  <>
                                    {o.status === '待补正' && <button className="btn btn-sm btn-warning" onClick={() => setActionModal({ type: 'single', action: 'supplement', order: o })}>补正</button>}
                                    {(o.status === '待补正' || o.status === '审核退回') && <button className="btn btn-sm btn-primary" onClick={() => setActionModal({ type: 'single', action: 'resubmit', order: o })}>重提</button>}
                                  </>
                                )
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
            {allList.map(s => (
              <button key={s.key} className={'btn ' + (section === s.key ? 'btn-primary' : '')} onClick={() => setSection(section === s.key ? 'all' : s.key)}>
                {s.key === 'overdue' ? '🔴' : s.key === 'approaching' ? '🟡' : '🟢'} {s.count}条
              </button>
            ))}
            <button className={'btn ' + (section === 'all' ? 'btn-primary' : '')} onClick={() => setSection('all')}>全部显示</button>
          </div>
        </div>
      )}

      {actionModal && (
        <ActionModal
          type={actionModal.type}
          action={actionModal.action}
          order={actionModal.order}
          ids={actionModal.ids}
          versions={actionModal.versions}
          onClose={() => setActionModal(null)}
          onConfirm={confirmAction}
        />
      )}
      {batchModal && (
        <BatchResultModal data={batchModal} onClose={() => setBatchModal(null)} />
      )}
    </div>
  )
}
