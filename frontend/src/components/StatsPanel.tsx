import { useState, useEffect } from 'react'
import type { User, Stats, ExceptionLog } from '../types'
import { STATUS_LABELS, PRIORITY_LABELS, EXCEPTION_TYPE_LABELS } from '../types'
import * as api from '../api'

interface StatsPanelProps {
  user: User
}

export function StatsPanel({ user }: StatsPanelProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [exceptions, setExceptions] = useState<ExceptionLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, excData] = await Promise.all([
          api.getStats(),
          api.listExceptions({ resolved: '0' }),
        ])
        setStats(statsData)
        setExceptions(excData.exceptions || [])
      } catch {}
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="empty-state"><div className="icon">⏳</div><p>加载中...</p></div>
  }

  if (!stats) return null

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total_count}</div>
          <div className="stat-label">总数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.by_status?.pending_review || 0}</div>
          <div className="stat-label">待审核</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.by_status?.approved || 0}</div>
          <div className="stat-label">审核通过</div>
        </div>
        <div className="stat-card synced">
          <div className="stat-value">{stats.by_status?.synced || 0}</div>
          <div className="stat-label">已同步</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.by_status?.returned || 0}</div>
          <div className="stat-label">已退回</div>
        </div>
        <div className="stat-card near-due">
          <div className="stat-value">{stats.near_due_count}</div>
          <div className="stat-label">临期</div>
        </div>
        <div className="stat-card overdue">
          <div className="stat-value">{stats.overdue_count}</div>
          <div className="stat-label">逾期</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">按状态分布</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {Object.entries(stats.by_status || {}).map(([status, count]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`status-tag status-${status}`}>{STATUS_LABELS[status] || status}</span>
              <span style={{ fontWeight: 600 }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">按优先级分布</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {Object.entries(stats.by_priority || {}).map(([priority, count]) => (
            <div key={priority} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`priority-${priority}`}><span className="priority-dot" />{PRIORITY_LABELS[priority] || priority}</span>
              <span style={{ fontWeight: 600 }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">未解决异常 ({exceptions.length})</div>
        {exceptions.length === 0 ? (
          <p style={{ fontSize: 13, color: '#8c8c8c' }}>暂无未解决异常</p>
        ) : (
          exceptions.map(exc => (
            <div key={exc.id} className="exception-item">
              <div>
                <div className="exc-type">{EXCEPTION_TYPE_LABELS[exc.exception_type] || exc.exception_type}</div>
                <div className="exc-desc">{exc.description}</div>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                  单据：{exc.entry_title || `#${exc.entry_id}`}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
