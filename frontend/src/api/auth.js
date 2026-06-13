import request from './interceptor'

export function loginApi(data) {
  return request({
    url: '/auth/login',
    method: 'post',
    data
  })
}

export function getCurrentUserApi() {
  return request({
    url: '/auth/me',
    method: 'get'
  })
}

export function getUsersApi() {
  return request({
    url: '/auth/users',
    method: 'get'
  })
}
