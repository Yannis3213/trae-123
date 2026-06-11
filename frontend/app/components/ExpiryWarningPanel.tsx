import { useNavigate } from '@tanstack/react-router'
import StatusBadge from './StatusBadge'
import ExpiryIndicator from './ExpiryIndicator'

interface WarningGroup {
  status_label: string
  items: any[]
}

export default function ExpiryWarningPanel({
  warnings,
}: {
  warnings: WarningGroup[]
}) {
  const navigate = useNavigate()

  const groups: Record<string, WarningGroup | null> = {
    normal: null,
    near_expiry: null,
    overdue: null,
  }

  warnings?.forEach((g) => {
    if (g.status_label === '正常') groups.normal = g
    else if (g.status_label === '临期') groups.near_expiry = g
    else if (g.status_label === '逾期') groups.overdue = g
  })

  return (
    <div>
      {(
        [
          { key: 'overdue', group: groups.overdue, headerCls: 'expiry-panel-header-overdue' },
          { key: 'near_expiry', group: groups.near_expiry, headerCls: 'expiry-panel-header-near' },
          { key: 'normal', group: groups.normal, headerCls: 'expiry-panel-header-normal' },
        ] as const
      ).map(({ key, group, headerCls }) =>
        group ? (
          <div key={key} className="expiry-panel-group">
            <div className={`expiry-panel-header ${headerCls}`}>
              {group.status_label}
              <span className="expiry-panel-count">
                （{group.items.length} 条）
              </span>
            </div>
            <div className="expiry-panel-list">
              {group.items.length === 0 ? (
                <div
                  style={{
                    padding: '8px 12px',
                    color: '#9ca3af',
                    fontSize: 13,
                  }}
                >
                  暂无
                </div>
              ) : (
                group.items.map((item) => (
                  <div
                    key={item.id}
                    className="expiry-panel-item"
                    onClick={() =>
                      navigate({
                        to: '/listings/$id',
                        params: { id: item.id },
                      })
                    }
                  >
                    <span style={{ marginRight: 8 }}>
                      {item.application_no}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: 13 }}>
                      {item.brand} {item.model_name}
                    </span>
                    <span style={{ marginLeft: 8 }}>
                      <StatusBadge label={item.page_label} />
                    </span>
                    <span style={{ marginLeft: 8 }}>
                      <ExpiryIndicator status={item.expiry_status} />
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null
      )}
    </div>
  )
}
