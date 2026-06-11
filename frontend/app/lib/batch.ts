import client from './apiClient'

export function batchProcess(items: any[]) {
  return client.post('/batch/process', items)
}
export function batchAdvanceOverdue() {
  return client.post('/batch/advance-overdue')
}
