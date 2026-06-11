import client from './client'

export function getProcessingRecords(applicationId) {
  return client.get(`/audit/applications/${applicationId}/records`)
}

export function getAuditNotes(applicationId) {
  return client.get(`/audit/applications/${applicationId}/notes`)
}

export function getExpiryWarnings() {
  return client.get('/audit/warnings')
}
