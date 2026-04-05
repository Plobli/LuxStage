import { api } from './client.js'

export const fetchShows         = ()           => api.get('/api/shows')
export const fetchShow          = (id)         => api.get(`/api/shows/${id}`)
export const createShow         = (data)       => api.post('/api/shows', data)
export const updateMeta         = (id, fields) => api.put(`/api/shows/${id}/meta`, fields)
export const archiveShow         = (id)        => api.delete(`/api/shows/${id}`)
export const deleteShowPermanent = (id)        => api.delete(`/api/shows/${id}/permanent`)
export const fetchArchivedShows  = ()          => api.get('/api/shows/archived')
export const restoreShow         = (id)        => api.post(`/api/shows/${id}/restore`, {})

export function fetchHistory(showId) {
  return api.get(`/api/shows/${showId}/history`)
}

export function fetchHistoryEntry(showId, historyId) {
  return api.get(`/api/shows/${showId}/history/${historyId}`)
}

export function restoreHistory(showId, historyId) {
  return api.post(`/api/shows/${showId}/history/${historyId}/restore`, {})
}
