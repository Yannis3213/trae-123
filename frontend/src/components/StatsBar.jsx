export default function StatsBar({ store }) {
  const { stats } = store
  const s = stats || {
    total: 0,
    pending_assign: 0,
    transferred: 0,
    revisited: 0,
    overdue: 0,
    near_due: 0
  }

  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className="label">隐患单总数</div>
        <div className="value">{s.total}</div>
      </div>
      <div className="stat-card pending">
        <div className="label">待分派</div>
        <div className="value">{s.pending_assign}</div>
      </div>
      <div className="stat-card">
        <div className="label">已转办</div>
        <div className="value">{s.transferred}</div>
      </div>
      <div className="stat-card">
        <div className="label">已回访</div>
        <div className="value">{s.revisited}</div>
      </div>
      <div className="stat-card near">
        <div className="label">临期（3天内）</div>
        <div className="value">{s.near_due}</div>
      </div>
      <div className="stat-card overdue">
        <div className="label">逾期</div>
        <div className="value">{s.overdue}</div>
      </div>
    </div>
  )
}
