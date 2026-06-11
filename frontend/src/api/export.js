import client from './client'

export function exportListings(params) {
  return client.get('/export/listings', { params, responseType: 'blob' })
}
