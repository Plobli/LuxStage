import { api } from './client.js'

export const fetchTemplates = ()     => api.get('/api/templates')
export const deleteTemplate = (name) => api.delete(`/api/templates/${name}`)

export async function fetchTemplateChannels(name) {
  return api.get(`/api/templates/${name}`)  // returns array directly
}

export async function saveTemplate(name, channels) {
  return api.put(`/api/templates/${name}`, channels)
}

export async function uploadTemplate({ name, text }) {
  // CSV-Text von Datei-Upload: parsen und als Array senden
  const lines = text.trim().split('\n').filter(Boolean)
  const headerIdx = lines.findIndex(l => l.startsWith('channel'))
  if (headerIdx === -1) return
  const headers = lines[headerIdx].split(';').map(h => h.trim())
  const channels = lines.slice(headerIdx + 1).map(line => {
    const vals = line.split(';')
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]))
  })
  return api.put(`/api/templates/${name}`, channels)
}
