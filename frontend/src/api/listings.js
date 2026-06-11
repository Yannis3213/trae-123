import client from './client'

export function getListings(params) {
  return client.get('/listings/', { params })
}

export function getListing(id) {
  return client.get(`/listings/${id}`)
}

export function createListing(data) {
  return client.post('/listings/', data)
}

export function submitListing(id, status, version) {
  return client.post(`/listings/${id}/submit`, { status, version })
}

export function supplementListing(id, data, status, version) {
  return client.post(`/listings/${id}/supplement`, { ...data, status, version })
}

export function processListing(id, data, status, version) {
  return client.post(`/listings/${id}/process`, { ...data, status, version })
}

export function reviewListing(id, data, status, version) {
  return client.post(`/listings/${id}/review`, { ...data, status, version })
}
