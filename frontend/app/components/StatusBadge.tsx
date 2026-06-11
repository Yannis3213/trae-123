export default function StatusBadge({ label }: { label: string }) {
  if (label === '待补正')
    return (
      <span className="status-badge status-badge-orange">待补正</span>
    )
  if (label === '复核中')
    return (
      <span className="status-badge status-badge-blue">复核中</span>
    )
  if (label === '办结')
    return (
      <span className="status-badge status-badge-green">办结</span>
    )
  return (
    <span
      className="status-badge"
      style={{ background: '#f3f4f6', color: '#6b7280' }}
    >
      {label}
    </span>
  )
}
