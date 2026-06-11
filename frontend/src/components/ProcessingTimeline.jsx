import React from 'react'
import { Timeline, Empty } from 'antd'
import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { formatDate } from '../utils/helpers.js'
import { ACTION_LABELS } from '../utils/constants.js'
import UserTag from './UserTag.jsx'

function getIcon(action) {
  if (!action) return <ClockCircleOutlined style={{ color: '#1677ff' }} />
  const actionStr = String(action).toLowerCase()
  if (actionStr.includes('approve') || actionStr.includes('approved') || action === 'verify') {
    return <CheckCircleOutlined style={{ color: '#52c41a' }} />
  }
  if (actionStr.includes('reject') || actionStr.includes('failed') || action === 'verify_failed') {
    return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
  }
  if (actionStr.includes('submit')) {
    return <ClockCircleOutlined style={{ color: '#1677ff' }} />
  }
  if (actionStr.includes('review') || actionStr.includes('archive') || actionStr.includes('advance')) {
    return <CheckCircleOutlined style={{ color: '#722ed1' }} />
  }
  if (actionStr.includes('correct') || actionStr.includes('exception')) {
    return <ExclamationCircleOutlined style={{ color: '#faad14' }} />
  }
  return <ClockCircleOutlined style={{ color: '#1677ff' }} />
}

function getTimelineColor(action) {
  if (!action) return 'blue'
  const actionStr = String(action).toLowerCase()
  if (actionStr.includes('reject') || actionStr.includes('failed') || action === 'verify_failed') return 'red'
  if (actionStr.includes('approve') || actionStr.includes('approved') || action === 'verify') return 'green'
  if (actionStr.includes('review') || actionStr.includes('archive')) return 'purple'
  if (actionStr.includes('submit')) return 'blue'
  if (actionStr.includes('correct') || actionStr.includes('exception')) return 'gold'
  return 'blue'
}

function getActionLabel(action) {
  if (!action) return '未知动作'
  return ACTION_LABELS[action] || action
}

export default function ProcessingTimeline({ records }) {
  if (!records || records.length === 0) {
    return <Empty description="暂无处理记录" style={{ padding: '24px 0' }} />
  }

  const sortedRecords = [...records].sort((a, b) => {
    const timeA = new Date(a.created_at || a.createdAt || 0).getTime()
    const timeB = new Date(b.created_at || b.createdAt || 0).getTime()
    return timeA - timeB
  })

  return (
    <div className="timeline-container">
      <Timeline
        mode="left"
        items={sortedRecords.map((record, index) => {
          const action = record.action || record.action_type
          const operator = record.handler || record.operator || record.operator_name || record.operatorName || '系统'
          const createdAt = record.created_at || record.createdAt
          const remark = record.remark || record.note || record.comment
          return {
            dot: getIcon(action),
            color: getTimelineColor(action),
            children: (
              <div>
                <div style={{ fontWeight: 500 }}>
                  {getActionLabel(action)}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>
                  <UserTag user={operator} showRole={false} /> · {formatDate(createdAt)}
                </div>
                {remark && (
                  <div style={{ marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 4, fontSize: 13 }}>
                    {remark}
                  </div>
                )}
              </div>
            )
          }
        })}
      />
    </div>
  )
}
