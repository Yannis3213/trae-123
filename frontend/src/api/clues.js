import request from '../utils/request';

export function getClueList(params) {
  return request.get('/clues', { params });
}

export function getClueDetail(id) {
  return request.get(`/clues/${id}`);
}

export function getClueStats() {
  return request.get('/clues/stats');
}

export function processClue(id, data) {
  return request.post(`/clues/${id}/process`, data);
}

export function processBatch(items, action) {
  return request.post('/clues/batch', { items, action });
}

export function getBatchResults(batchNo) {
  return request.get(`/clues/batch/${batchNo}`);
}

export function addAuditNote(id, note) {
  return request.post(`/clues/${id}/audit-notes`, { note });
}

export function getAbnormalLogs(id) {
  return request.get(`/clues/${id}/abnormal-logs`);
}
