const LABELS: Record<string, string> = {
  normal: '正常',
  near_expiry: '临期',
  overdue: '逾期',
}

export default function ExpiryIndicator({ status }: { status: string }) {
  if (!status) return null
  const cls =
    status === 'normal'
      ? 'expiry-normal'
      : status === 'near_expiry'
        ? 'expiry-near'
        : 'expiry-overdue'
  return (
    <span className={`expiry-indicator ${cls}`}>
      <span className="expiry-dot" />
      {LABELS[status] || status}
    </span>
  )
}
