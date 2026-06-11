import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  http, STATUS_LIST, STATUS_COLOR, WARNING_COLOR, WARNING_LABEL,
  ROLE_LABEL, INSURANCE_TYPES, ACTION_LABEL, ROLES, getCurrentRole,
} from '../api.js'
import { useApp } from '../App.jsx'
import ActionModal from '../components/ActionModal.jsx'
import BatchResultModal from '../components/BatchResultModal.jsx'

const MODE_CONFIG = {
  register: {
    title: '📝 投保申请登记',
    desc: '创建投保申请，补正资料，重新提交退回件',
    statusOptions: ['待审核', '待补正', '审核退回'],
    defaultStatus: '',
    canCreate: true,
    onlyMine: true,
  },
  verify: {
    title: '✅ 过程核验',
    desc: '核保专员审核投保申请，必要时退回补正',
    statusOptions: ['待审核', '待补正'],
    defaultStatus: '',
    canCreate: false,
    onlyMine: false,
  },
  review: {
    title: '📁 复核归档',
    desc: '业务负责人核对出单确认证据，同步归档',
    statusOptions: ['审核通过', '已同步', '已归档'],
    defaultStatus: '',
    canCreate: false,
    onlyMine: false,
  },
}

export default function OrderList({ mode }) {
  const cfg = MODE_CONFIG[mode]
  const nav = useNavigate()
  const { role, refreshKey, triggerRefresh } = useApp()

  const [list, setList] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState(cfg.defaultStatus)
  const [insuranceType, setInsuranceType] = useState('')
  const [warning, setWarning] = useState('')
  const [onlyMine, setOnlyMine] = useState(cfg.onlyMine && role === 'customer_manager')
  const [selected, setSelected] = useState({})
  const [actionModal, setActionModal] = useState(null)
  const [batchModal, setBatchModal] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = {
        page, page_size: pageSize,
        keyword: keyword || undefined,
        status: status || undefined,
        insurance_type: insuranceType || undefined,
        warning: warning || undefined,
        only_mine: onlyMine ? '1' : undefined,
      }
      const data = await http.get('/patrol-orders', { params })
      setList(data.list || [])
      setTotal(data.total || 0)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [page, refreshKey])

  const handleSearch = () => { setPage(1); load() }

  const selectedIds = Object.keys(selected).filter(k => selected[k]).map(Number)
  const allSelected = list.length > 0 && list.every(o => selected[o.id])

  const toggleAll = () => {
    const next = { ...selected }
    if (allSelected) list.forEach(o => delete next[o.id])
    else list.forEach(o => next[o.id] = true)
    setSelected(next)
  }

  const statusTag = (s) => (
    <span className="tag" style={{ background: STATUS_COLOR[s] + '22', color: STATUS_COLOR[s], border: `1px solid ${STATUS_COLOR[s]}55` }}>
      {s}
    </span>
  )
  const warningTag = (w) => (
    <span className="tag" style={{ background: WARNING_COLOR[w] + '22', color: WARNING_COLOR[w], border: `1px solid ${WARNING_COLOR[w]}55` }}>
      {WARNING_LABEL[w]}
    </span>
  )

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
    if (selectedIds.length === 0) return alert('请先勾选记录')
    setActionModal({ type: 'batch', action, ids: selectedIds, versions: list.reduce((m, o) => { if (selected[o.id]) m[o.id] = o.version; return m }, {}) })
  }

  const handleSingleAction = (order, action) => {
    setActionModal({ type: 'single', action, order })
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
      alert('操作失败：' + (e.Message || e.message || '未知错误') + (e.Detail ? '\n' + e.Detail : ''))
    }
  }

  const totalPages = Math.ceil(total / pageSize)

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
          <div style={{ fontSize: 20 }}>{cfg.title}</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, fontWeight: 400 }}>{cfg.desc}</div>
        </div>
        {cfg.canCreate && role === 'customer_manager' && (
          <button className="btn btn-primary" onClick={() => nav('/orders/create')}>+ 新建投保申请</button>
        )}
      </div>

      <div className="card">
        <div className="filter-bar">
          <input className="input" placeholder="搜索单号/客户/证件/手机" value={keyword}
            onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">全部状态</option>
            {(cfg.statusOptions || STATUS_LIST).map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="select" value={insuranceType} onChange={(e) => setInsuranceType(e.target.value)}>
            <option value="">全部险种</option>
            {INSURANCE_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <select className="select" value={warning} onChange={(e) => setWarning(e.target.value)}>
            <option value="">全部预警</option>
            <option value="normal">正常</option>
            <option value="approaching">临期</option>
            <option value="overdue">逾期</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4b5563' }}>
            <input type="checkbox" className="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            只看我的
          </label>
          <button className="btn btn-primary" onClick={handleSearch}>🔍 筛选</button>
          <button className="btn" onClick={() => { setKeyword(''); setStatus(cfg.defaultStatus); setInsuranceType(''); setWarning(''); setOnlyMine(cfg.onlyMine && role === 'customer_manager'); handleSearch() }}>重置</button>
        </div>

        {selectedIds.length > 0 && (
          <div className="action-bar">
            <span className="selected-count">已选 <b style={{ color: '#1677ff' }}>{selectedIds.length}</b> 条</span>
            {availableActions.map(a => (
              <button key={a.key} className={'btn ' + a.btnClass} onClick={() => handleBatch(a.key)}>
                批量{a.label}
              </button>
            ))}
            <button className="btn" onClick={() => setSelected({})}>取消选择</button>
          </div>
        )}

        {loading ? <div className="empty-state">加载中...</div> :
          total === 0 ? <div className="empty-state">暂无数据，点击新建投保申请开始登记</div> : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input type="checkbox" className="checkbox" checked={allSelected} onChange={toggleAll} />
                    </th>
                    <th>申请单号</th>
                    <th>客户姓名</th>
                    <th>证件号</th>
                    <th>险种</th>
                    <th>投保金额</th>
                    <th>保费</th>
                    <th>状态</th>
                    <th>预警</th>
                    <th>截止日期</th>
                    <th>当前处理人</th>
                    <th>证据</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(o => (
                    <tr key={o.id} style={o.warning === 'overdue' ? { background: '#fff7f7' } : (o.warning === 'approaching' ? { background: '#fffdf5' } : {})}>
                      <td>
                        <input type="checkbox" className="checkbox" checked={!!selected[o.id]}
                          onChange={(e) => setSelected({ ...selected, [o.id]: e.target.checked })} />
                      </td>
                      <td style={{ fontWeight: 600, color: '#1677ff', cursor: 'pointer' }} onClick={() => nav(`/orders/${o.id}`)}>{o.order_no}</td>
                      <td>{o.customer_name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.id_number}</td>
                      <td>{o.insurance_type}</td>
                      <td>¥{o.insurance_amount.toLocaleString()}</td>
                      <td>¥{o.premium.toLocaleString()}</td>
                      <td>{statusTag(o.status)}</td>
                      <td>{warningTag(o.warning)} {o.days_left !== -1 && <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>{o.days_left >= 0 ? o.days_left + '天' : Math.abs(o.days_left) + '天前'}</span>}</td>
                      <td style={{ fontSize: 12 }}>{o.deadline ? dayjs(o.deadline).format('YYYY-MM-DD') : '-'}</td>
                      <td style={{ fontSize: 12 }}>{o.current_handler || '-'}</td>
                      <td>
                        {o.attachments_count > 0 && <span className="tag tag-info">{o.attachments_count}份</span>}
                        {o.confirm_evidence && <span className="tag tag-success" style={{ marginLeft: 4 }}>已核验</span>}
                      </td>
                      <td>
                        <button className="btn btn-sm" onClick={() => nav(`/orders/${o.id}`)}>详情</button>
                        {canOperate(o) && (
                          role === 'customer_manager' ? (
                            o.status === '待补正' && (
                              <>
                                <button className="btn btn-sm btn-warning" onClick={() => handleSingleAction(o, 'supplement')}>补正</button>
                                <button className="btn btn-sm btn-primary" onClick={() => handleSingleAction(o, 'resubmit')}>重提</button>
                              </>
                            )
                          ) : role === 'underwriter' ? (
                            <>
                              <button className="btn btn-sm btn-success" onClick={() => handleSingleAction(o, 'approve')}>通过</button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleSingleAction(o, 'reject')}>退回</button>
                            </>
                          ) : (
                            o.status === '审核通过' ? (
                              <button className="btn btn-sm btn-primary" onClick={() => handleSingleAction(o, 'sync')}>同步</button>
                            ) : o.status === '已同步' ? (
                              <button className="btn btn-sm btn-success" onClick={() => handleSingleAction(o, 'archive')}>归档</button>
                            ) : null
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pagination">
                <span style={{ color: '#6b7280', fontSize: 13, marginRight: 12 }}>共 {total} 条</span>
                <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pn = i + 1
                  if (totalPages > 7) {
                    if (page > 4) pn = page - 3 + i
                    if (pn > totalPages) pn = totalPages - 6 + i
                  }
                  return (
                    <button key={pn} className={'page-btn' + (pn === page ? ' active' : '')}
                      onClick={() => setPage(pn)} disabled={pn < 1 || pn > totalPages}>{pn}</button>
                  )
                })}
                <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</button>
              </div>
            </>
          )}
      </div>

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
