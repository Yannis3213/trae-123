import { createSignal, createEffect, For, Show } from 'solid-js'
import type { ProcessRecord, AuditNote, ExceptionReason } from '../types'

type TimelineEntry = {
  id: number
  time: string
  action: string
  operator: string
  remark: string
  type: 'process' | 'audit' | 'exception'
  from_status: string
  to_status: string
}

interface AuditTrailProps {
  orderId: number
  records: ProcessRecord[]
  auditNotes: AuditNote[]
  exceptionReasons: ExceptionReason[]
}

function AuditTrail(props: AuditTrailProps) {
  const [trailData, setTrailData] = createSignal<TimelineEntry[]>([])

  createEffect(() => {
    const entries: TimelineEntry[] = []

    for (const r of props.records) {
      entries.push({
        id: r.id,
        time: r.created_at,
        action: r.action,
        operator: r.operator_role,
        remark: r.remark,
        type: 'process' as const,
        from_status: r.from_status,
        to_status: r.to_status
      })
    }

    for (const n of props.auditNotes) {
      entries.push({
        id: n.id + 10000,
        time: n.created_at,
        action: '审计备注',
        operator: n.author_role,
        remark: n.note,
        type: 'audit' as const,
        from_status: '',
        to_status: ''
      })
    }

    for (const e of props.exceptionReasons) {
      entries.push({
        id: e.id + 20000,
        time: e.created_at,
        action: `异常[${e.reason_type}]`,
        operator: '',
        remark: e.description,
        type: 'exception' as const,
        from_status: '',
        to_status: ''
      })
    }

    entries.sort((a, b) => {
      const ta = new Date(a.time).getTime()
      const tb = new Date(b.time).getTime()
      return ta - tb
    })

    setTrailData(entries)
  })

  const formatTime = (t: string) => {
    if (!t) return ''
    return new Date(t).toLocaleString('zh-CN')
  }

  const getStatusLabel = (status: string): string => {
    return status || ''
  }

  return (
    <Show when={trailData().length > 0} fallback={<p style={{ color: 'var(--text-secondary)' }}>暂无流转记录</p>}>
      <div class="timeline">
        <For each={trailData()}>
          {(entry) => (
            <div class={`timeline-item ${entry.type}`}>
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class={`timeline-action badge ${entry.type === 'process' ? 'badge-in-progress' : entry.type === 'audit' ? 'badge-accepted' : 'badge-returned'}`}>
                    {entry.action}
                  </span>
                  <Show when={entry.from_status && entry.to_status}>
                    <span class="timeline-status-change">
                      {getStatusLabel(entry.from_status)} → {getStatusLabel(entry.to_status)}
                    </span>
                  </Show>
                  <span class="timeline-time">{formatTime(entry.time)}</span>
                </div>
                <Show when={entry.operator}>
                  <div class="timeline-operator">操作人：{entry.operator}</div>
                </Show>
                <Show when={entry.remark}>
                  <div class="timeline-remark">{entry.remark}</div>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  )
}

export default AuditTrail
