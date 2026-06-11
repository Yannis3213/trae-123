import { useEffect, useState } from 'react'
import { getProcessingRecords, getAuditNotes } from '../lib/audit'

export default function AuditTrail({
  applicationId,
}: {
  applicationId: number
}) {
  const [records, setRecords] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const [recordsRes, notesRes] = await Promise.all([
          getProcessingRecords(applicationId),
          getAuditNotes(applicationId),
        ])
        if (mounted) {
          setRecords(recordsRes.data)
          setNotes(notesRes.data)
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchData()
    return () => {
      mounted = false
    }
  }, [applicationId])

  if (loading)
    return (
      <div style={{ color: '#6b7280', padding: 20 }}>加载中...</div>
    )

  return (
    <div>
      <h3 style={{ fontSize: 15, marginBottom: 12 }}>处理记录</h3>
      <div className="table-wrapper" style={{ marginBottom: 24 }}>
        <table className="audit-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>操作人</th>
              <th>角色</th>
              <th>动作</th>
              <th>前状态</th>
              <th>后状态</th>
              <th>备注</th>
              <th>失败原因</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ textAlign: 'center', color: '#9ca3af' }}
                >
                  暂无记录
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.created_at?.replace('T', ' ').slice(0, 19)}
                  </td>
                  <td>{r.operator}</td>
                  <td>{r.operator_role}</td>
                  <td>{r.action}</td>
                  <td>{r.from_status}</td>
                  <td>{r.to_status}</td>
                  <td>{r.remark}</td>
                  <td>{r.failure_reason || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 15, marginBottom: 12 }}>审计备注</h3>
      <div className="table-wrapper">
        <table className="audit-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>操作人</th>
              <th>角色</th>
              <th>备注</th>
              <th>异常原因</th>
            </tr>
          </thead>
          <tbody>
            {notes.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ textAlign: 'center', color: '#9ca3af' }}
                >
                  暂无备注
                </td>
              </tr>
            ) : (
              notes.map((n) => (
                <tr key={n.id}>
                  <td>
                    {n.created_at?.replace('T', ' ').slice(0, 19)}
                  </td>
                  <td>{n.operator}</td>
                  <td>{n.operator_role}</td>
                  <td>{n.note}</td>
                  <td>{n.failure_reason || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
