import client from './apiClient'

export function login(username: string) {
  return client.post('/auth/login', { username })
}
export function logout() {
  return client.post('/auth/logout')
}
export function getMe() {
  return client.get('/auth/me')
}
export function getOperators() {
  return client.get('/auth/operators')
}
