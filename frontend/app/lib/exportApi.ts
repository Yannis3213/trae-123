import client from './apiClient'

export function exportListings(params: any) {
  return client.get('/export/listings', { params, responseType: 'blob' })
}
