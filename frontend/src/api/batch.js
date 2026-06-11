import client from './client'

export function batchProcess(items) {
  return client.post('/batch/process', items)
}

export function batchAdvanceOverdue() {
  return client.post('/batch/advance-overdue')
}
