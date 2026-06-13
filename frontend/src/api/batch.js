import request from './interceptor'

export function batchProcessApi(data) {
  return request({
    url: '/batch/process',
    method: 'post',
    data
  })
}

export function batchCompleteApi(data) {
  return request({
    url: '/batch/complete',
    method: 'post',
    data
  })
}

export function batchReturnApi(data) {
  return request({
    url: '/batch/return',
    method: 'post',
    data
  })
}
