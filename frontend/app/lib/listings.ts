import client from './apiClient'

export function getListings(params: any) {
  return client.get('/listings/', { params })
}
export function getListing(id: number) {
  return client.get(`/listings/${id}`)
}
export function createListing(data: any) {
  return client.post('/listings/', data)
}
export function submitListing(id: number, status: string, version: number) {
  return client.post(`/listings/${id}/submit`, { status, version })
}
export function supplementListing(
  id: number,
  data: any,
  status: string,
  version: number
) {
  return client.post(`/listings/${id}/supplement`, { ...data, status, version })
}
export function processListing(
  id: number,
  data: any,
  status: string,
  version: number
) {
  return client.post(`/listings/${id}/process`, { ...data, status, version })
}
export function reviewListing(
  id: number,
  data: any,
  status: string,
  version: number
) {
  return client.post(`/listings/${id}/review`, { ...data, status, version })
}
