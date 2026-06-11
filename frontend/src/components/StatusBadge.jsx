import React from 'react'
import { Tag } from 'antd'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  MODULE_STATUS_LABELS,
  MODULE_STATUS_COLORS,
  WARNING_COLORS,
  WARNING_LABELS,
  MODULE_TYPE_LABELS
} from '../utils/constants.js'
import { getWarningLevel, getWarningLevelFromDays } from '../utils/helpers.js'

export function OrderStatusBadge({ status }) {
  if (!status) return null
  return (
    <Tag color={ORDER_STATUS_COLORS[status]}>
      {ORDER_STATUS_LABELS[status] || status}
    </Tag>
  )
}

export function DueWarningBadge({ deadline, daysLeft }) {
  let level
  if (daysLeft !== undefined && daysLeft !== null) {
    level = getWarningLevelFromDays(daysLeft)
  } else {
    if (!deadline) return null
    level = getWarningLevel(deadline)
  }
  return (
    <Tag color={WARNING_COLORS[level]}>
      {WARNING_LABELS[level]}
    </Tag>
  )
}

export function ModuleStatusBadge({ status }) {
  if (!status) {
    return <Tag color="default">未开始</Tag>
  }
  return (
    <Tag color={MODULE_STATUS_COLORS[status]}>
      {MODULE_STATUS_LABELS[status] || status}
    </Tag>
  )
}

export function ModuleTypeBadge({ type }) {
  if (!type) return null
  const colorMap = {
    REQUIREMENT: 'blue',
    SCHEDULE: 'purple',
    DELIVERY: 'delivery' in MODULE_TYPE_LABELS ? 'green' : 'blue'
  }
  return (
    <Tag color={colorMap[type] || 'blue'}>
      {MODULE_TYPE_LABELS[type] || type}
    </Tag>
  )
}

export default OrderStatusBadge
