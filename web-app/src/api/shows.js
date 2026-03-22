import { api } from './client.js'

export const fetchShows    = ()            => api.get('/api/shows')
export const fetchShow     = (id)          => api.get(`/api/shows/${id}`)
export const createShow    = (data)        => api.post('/api/shows', data)
export const updateContent = (id, content) => api.put(`/api/shows/${id}/content`, { content })
export const archiveShow   = (id)          => api.delete(`/api/shows/${id}`)
export const fetchArchivedShows = () => api.get('/api/shows?archived=true')
export const restoreShow = (id) => api.post(`/api/shows/${id}/restore`, {})
