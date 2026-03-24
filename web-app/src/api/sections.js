import { api } from './client.js'

export const fetchTemplateSections = (name) =>
  api.get(`/api/templates/${encodeURIComponent(name)}/sections`)

export const saveTemplateSections = (name, sections) =>
  api.put(`/api/templates/${encodeURIComponent(name)}/sections`, { sections })

export const fetchShowSections = (id) =>
  api.get(`/api/shows/${id}/sections`)  // returns [{ id, content }]

export const saveShowSections = (id, sections) =>
  api.put(`/api/shows/${id}/sections`, sections)  // sends [{ id, content }]

export const fetchShowSectionDefs = (id) =>
  api.get(`/api/shows/${id}/section-defs`)

export const saveShowSectionDefs = (id, sections) =>
  api.put(`/api/shows/${id}/section-defs`, { sections })
