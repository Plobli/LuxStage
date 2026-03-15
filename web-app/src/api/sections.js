import { api } from './client.js'

export const fetchTemplateSections = (name) =>
  api.get(`/api/templates/${encodeURIComponent(name)}/sections`)

export const saveTemplateSections = (name, sections) =>
  api.put(`/api/templates/${encodeURIComponent(name)}/sections`, { sections })

export const fetchShowSections = (id) =>
  api.get(`/api/shows/${id}/sections`)

export const saveShowSections = (id, raw) =>
  api.put(`/api/shows/${id}/sections`, { raw })

export const migrateShowSections = (id) =>
  api.post(`/api/shows/${id}/migrate-sections`)

export const fetchShowSectionDefs = (id) =>
  api.get(`/api/shows/${id}/section-defs`)

export const saveShowSectionDefs = (id, sections) =>
  api.put(`/api/shows/${id}/section-defs`, { sections })

export function parseSectionsMd(raw) {
  const map = new Map()
  if (!raw) return map
  const parts = raw.split(/^---section:\s*(.+?)---$/m)
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i].trim()
    const content = (parts[i + 1] || '').trim()
    map.set(id, content)
  }
  return map
}

export function serializeSectionsMd(map) {
  let out = ''
  for (const [id, content] of map) {
    out += `---section: ${id}---\n${content}\n`
  }
  return out
}
