import request from './interceptor'

export function getChronicRecordApi(idCard) {
  return request({
    url: `/chronic-record/${idCard}`,
    method: 'get'
  })
}

export function createChronicRecordApi(data) {
  return request({
    url: '/chronic-record',
    method: 'post',
    data
  })
}

export function updateChronicRecordApi(id, data) {
  return request({
    url: `/chronic-record/${id}`,
    method: 'put',
    data
  })
}
