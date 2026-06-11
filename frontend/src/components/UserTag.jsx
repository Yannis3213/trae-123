import React from 'react'
import { Tag, Tooltip } from 'antd'
import { formatUser, getUserRoleColor } from '../utils/helpers.js'

export default function UserTag({ user, showRole = true, size = 'default' }) {
  if (!user) {
    return <Tag color="default">-</Tag>
  }

  if (typeof user === 'string') {
    return <Tag color="default">{user}</Tag>
  }

  const displayText = formatUser(user)
  const color = getUserRoleColor(user.role)

  if (!showRole) {
    return <Tag color={color}>{user.username || user.user_name || '-'}</Tag>
  }

  return (
    <Tooltip title={displayText}>
      <Tag color={color}>{displayText}</Tag>
    </Tooltip>
  )
}
