import { For, Show } from 'solid-js'
import type { ProcessRecord } from '../types'

interface AuditTrailProps {
  orderId: number
  records: ProcessRecord[]
}

type TimelineEntry = {
  id: number
  time: string
  action: string
  operator: string
  remark: string
  type: 'process' | 'audit' | 'exception'
}

function AuditTrail(props: AuditTrailProps) {
  const entries = (): TimelineEntry[] => {
    return props.records.map((r) => ({
      id: r.id,
      time: r.created_at,
      action: r.action,
      operator: `${r.operator_role}`,
      remark: r.remark,
      type: 'process' as const
    }))
  }

  const formatTime = (t: string) => {
    if (!t) return ''
    return new Date(t).toLocaleString('zh-CN')
  }

  return (
    <Show when={entries().length > 0} fallback={<p style={{ color: 'var(--text-secondary)' }}>暂无流转记录</p>}>
      <div class="timeline">
        <For each={entries()}>
          {(entry) => (
            <div class={`timeline-item ${entry.type}`}>
              <div class="timeline-time">{formatTime(entry.time)}</div>
              <div class="timeline-action">{entry.action}</div>
              <div class="timeline-operator">操作人：{entry.operator}</div>
              <Show when={entry.remark}>
                <div class="timeline-remark">{entry.remark}</div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </Show>
  )
}

export default AuditTrail
