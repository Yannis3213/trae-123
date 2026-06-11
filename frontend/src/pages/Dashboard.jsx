import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { http, STATUS_COLOR, WARNING_COLOR, WARNING_LABEL, ROLE_LABEL } from '../api.js'
import { useApp } from '../App.jsx'

function StatCard({ label, value, type = 'info', onClick }) {
  return (
    <div className={'stat-card ' + type} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

export default function Dashboard() {
  const nav = useNavigate()
  const { refreshKey, role } = useApp()
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const s = await http.get('/dashboard/stats')
      setStats(s)
      const list = await http.get('/patrol-orders', { params: { page: 1, page_size: 8, sort_by: 'updated_at', sort_desc: 1 } })
      setRecent(list.list || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [refreshKey])

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

  return (
    <div>
      <div className="page-title">
        <span>工作台 - 欢迎回来，{ROLE_LABEL[role]}模式</span>
        <div>
          <button className="btn btn-primary" onClick={() => nav('/orders/create')}>+ 新建投保申请</button>
        </div>
      </div>

      {stats && (
        <div className="stats-grid">
          <StatCard label="投保申请总数" value={stats.total} type="info" onClick={() => nav('/orders/register')} />
          <StatCard label="待审核" value={stats.pending} type="warning" onClick={() => nav('/orders/verify')} />
          <StatCard label="待补正" value={stats.supplement} type="warning" onClick={() => nav('/orders/register')} />
          <StatCard label="审核通过" value={stats.approved} type="normal" onClick={() => nav('/orders/review')} />
          <StatCard label="已同步" value={stats.synced} type="success" />
          <StatCard label="已归档" value={stats.completed} />
          <StatCard label="逾期" value={stats.overdue} type="overdue" onClick={() => nav('/warnings')} />
          <StatCard label="临期(3天内)" value={stats.approaching} type="approaching" onClick={() => nav('/warnings')} />
        </div>
      )}

      <div className="card">
        <div className="card-title">📋 最近更新的投保申请</div>
        {loading ? <div className="empty-state">加载中...</div> :
          recent.length === 0 ? <div className="empty-state">暂无数据</div> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>申请单号</th>
                  <th>客户姓名</th>
                  <th>险种</th>
                  <th>投保金额</th>
                  <th>状态</th>
                  <th>预警</th>
                  <th>当前处理人</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600, color: '#1677ff' }}>{o.order_no}</td>
                    <td>{o.customer_name}</td>
                    <td>{o.insurance_type}</td>
                    <td>¥{o.insurance_amount.toLocaleString()}</td>
                    <td>{statusTag(o.status)}</td>
                    <td>{warningTag(o.warning)}</td>
                    <td>{o.current_handler || '-'}</td>
                    <td>{new Date(o.updated_at).toLocaleString('zh-CN')}</td>
                    <td>
                      <button className="btn btn-sm btn-primary" onClick={() => nav(`/orders/${o.id}`)}>查看</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}
