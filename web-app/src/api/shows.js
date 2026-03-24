import { api } from './client.js'

export const fetchShows         = ()           => api.get('/api/shows')
export const fetchShow          = (id)         => api.get(`/api/shows/${id}`)
export const createShow         = (data)       => api.post('/api/shows', data)
export const updateMeta         = (id, fields) => api.put(`/api/shows/${id}/meta`, fields)
export const archiveShow        = (id)         => api.delete(`/api/shows/${id}`)
export const fetchArchivedShows = ()           => api.get('/api/shows/archived')
export const restoreShow        = (id)         => api.post(`/api/shows/${id}/restore`, {})
