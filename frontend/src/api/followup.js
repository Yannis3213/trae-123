import request from './interceptor'

export function getFollowupListApi(params) {
  return request({
    url: '/followup',
    method: 'get',
    params
  })
}

export function getFollowupStatsApi() {
  return request({
    url: '/followup/stats',
    method: 'get'
  })
}

export function getFollowupDetailApi(id) {
  return request({
    url: `/followup/${id}`,
    method: 'get'
  })
}

export function createFollowupApi(data) {
  return request({
    url: '/followup',
    method: 'post',
    data
  })
}

export function updateFollowupApi(id, data) {
  return request({
    url: `/followup/${id}`,
    method: 'put',
    data
  })
}

export function submitFollowupApi(id, data) {
  return request({
    url: `/followup/${id}/submit`,
    method: 'post',
    data
  })
}

export function resubmitFollowupApi(id, data) {
  return request({
    url: `/followup/${id}/resubmit`,
    method: 'post',
    data
  })
}

export function processFollowupApi(id, data) {
  return request({
    url: `/followup/${id}/process`,
    method: 'post',
    data
  })
}

export function reviewFollowupApi(id, data) {
  return request({
    url: `/followup/${id}/review`,
    method: 'post',
    data
  })
}

export function completeFollowupApi(id, data) {
  return request({
    url: `/followup/${id}/complete`,
    method: 'post',
    data
  })
}

export function returnFollowupApi(id, data) {
  return request({
    url: `/followup/${id}/return`,
    method: 'post',
    data
  })
}

export function archiveFollowupApi(id, data) {
  return request({
    url: `/followup/${id}/archive`,
    method: 'post',
    data
  })
}

export function uploadAttachmentApi(id, data) {
  return request({
    url: `/followup/${id}/attachment`,
    method: 'post',
    data
  })
}

export function deleteAttachmentApi(id, attId) {
  return request({
    url: `/followup/${id}/attachment/${attId}`,
    method: 'delete'
  })
}
