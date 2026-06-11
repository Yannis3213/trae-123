import client from './apiClient'

export function getProcessingRecords(applicationId: number) {
  return client.get(`/audit/applications/${applicationId}/records`)
}
export function getAuditNotes(applicationId: number) {
  return client.get(`/audit/applications/${applicationId}/notes`)
}
export function getExpiryWarnings() {
  return client.get('/audit/warnings')
}
