import { api } from './client'

export const fetchShows         = (): Promise<any[]> => api.get('/api/shows')
export const fetchShow          = (id: string): Promise<any> => api.get(`/api/shows/${id}`)
export const createShow         = (data: any): Promise<any> => api.post('/api/shows', data)
export const updateMeta         = (id: string, fields: any): Promise<any> => api.put(`/api/shows/${id}/meta`, fields)
export const archiveShow         = (id: string): Promise<any> => api.delete(`/api/shows/${id}`)
export const deleteShowPermanent = (id: string): Promise<any> => api.delete(`/api/shows/${id}/permanent`)
export const fetchArchivedShows  = (): Promise<any[]> => api.get('/api/shows/archived')
export const restoreShow         = (id: string): Promise<any> => api.post(`/api/shows/${id}/restore`, {})

export function fetchHistory(showId: string): Promise<any[]> {
  return api.get(`/api/shows/${showId}/history`)
}

export function fetchHistoryEntry(showId: string, historyId: string): Promise<any> {
  return api.get(`/api/shows/${showId}/history/${historyId}`)
}

export function restoreHistory(showId: string, historyId: string): Promise<any> {
  return api.post(`/api/shows/${showId}/history/${historyId}/restore`, {})
}

export function createSnapshot(showId: string): Promise<any> {
  return api.post(`/api/shows/${showId}/history/snapshot`, {})
}

